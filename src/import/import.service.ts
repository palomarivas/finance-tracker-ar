import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { Account } from '../accounts/entities/account.entity';
import { AccountType } from '../accounts/enums/account-type.enum';
import { CategorizationService } from '../categorization/categorization.service';
import { Currency } from '../common/enums/currency.enum';
import { RateType } from '../fx/enums/rate-type.enum';
import { FxService } from '../fx/fx.service';
import { Rule } from '../rules/entities/rule.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionSource } from '../transactions/enums/transaction-source.enum';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { User } from '../users/entities/user.entity';
import { CreditCardStatement } from './entities/credit-card-statement.entity';
import { ImportBatch } from './entities/import-batch.entity';
import { ImportBatchStatus } from './enums/import-batch-status.enum';
import { StatementStatus } from './enums/statement-status.enum';
import { normalizeDescription } from './parsers/parse-ar.util';
import {
  CreditCardMeta,
  ParsedRow,
  STATEMENT_PARSERS,
  StatementParser,
} from './parsers/statement-parser.interface';

export interface ImportSummary {
  batchId: string;
  parser: string;
  imported: number;
  skipped: number;
  uncategorized: number;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    @Inject(STATEMENT_PARSERS)
    private readonly parsers: StatementParser[],
    @InjectRepository(ImportBatch)
    private readonly batches: Repository<ImportBatch>,
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
    @InjectRepository(Rule)
    private readonly rules: Repository<Rule>,
    @InjectRepository(CreditCardStatement)
    private readonly statements: Repository<CreditCardStatement>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly categorization: CategorizationService,
    private readonly fx: FxService,
  ) {}

  async importStatement(
    user: User,
    accountId: string,
    filename: string,
    buffer: Buffer,
  ): Promise<ImportSummary> {
    const account = await this.accounts.findOne({
      where: { id: accountId, user: { id: user.id } },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const parser = await this.pickParser(filename, buffer);
    if (!parser) {
      throw new BadRequestException(
        'No parser recognizes this file format. Supported: MercadoPago account PDF, generic CSV.',
      );
    }

    // The batch lives outside the data transaction so a failed import still
    // leaves a FAILED record to show the user.
    const batch = await this.batches.save(
      this.batches.create({
        user,
        account,
        filename,
        status: ImportBatchStatus.PROCESSING,
      }),
    );

    try {
      const parsed = await parser.parse(buffer);
      const statement = await this.upsertStatement(
        user,
        account,
        parsed.creditCardMeta,
      );
      const summary = await this.persistRows(
        user,
        account,
        batch,
        parsed.rows,
        statement,
      );
      await this.batches.update(batch.id, {
        status: ImportBatchStatus.COMPLETED,
        rowsImported: summary.imported,
        rowsSkipped: summary.skipped,
      });
      this.logger.log(
        `Batch ${batch.id} (${parser.name}): ${summary.imported} imported, ${summary.skipped} skipped`,
      );
      return { batchId: batch.id, parser: parser.name, ...summary };
    } catch (err) {
      await this.batches.update(batch.id, {
        status: ImportBatchStatus.FAILED,
        errorMessage: (err as Error).message?.slice(0, 500) ?? 'Unknown error',
      });
      throw err;
    }
  }

  listBatches(user: User): Promise<ImportBatch[]> {
    return this.batches.find({
      where: { user: { id: user.id } },
      relations: { account: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** Undo a bad import: deleting the batch cascades to its transactions. */
  async deleteBatch(user: User, batchId: string): Promise<void> {
    const batch = await this.batches.findOne({
      where: { id: batchId, user: { id: user.id } },
    });
    if (!batch) {
      throw new NotFoundException('Import batch not found');
    }
    await this.batches.remove(batch);
  }

  private async pickParser(
    filename: string,
    buffer: Buffer,
  ): Promise<StatementParser | null> {
    for (const parser of this.parsers) {
      if (await parser.canParse(filename, buffer)) {
        return parser;
      }
    }
    return null;
  }

  /**
   * One resumen upload = one CreditCardStatement, keyed by (account, closing
   * date) so re-uploads reuse the same row. Non-card files return null.
   */
  private async upsertStatement(
    user: User,
    account: Account,
    meta: CreditCardMeta | undefined,
  ): Promise<CreditCardStatement | null> {
    if (!meta) {
      return null;
    }
    if (account.type !== AccountType.CREDIT_CARD) {
      throw new BadRequestException(
        'This file is a credit-card resumen; upload it to a CREDIT_CARD account',
      );
    }
    const existing = await this.statements.findOne({
      where: { account: { id: account.id }, closingDate: meta.closingDate },
    });
    if (existing) {
      return existing;
    }
    return this.statements.save(
      this.statements.create({
        user: { id: user.id } as User,
        account,
        closingDate: meta.closingDate,
        dueDate: meta.dueDate,
        // Until settled we assume pesos — the conservative full-cost case.
        paymentCurrency: Currency.ARS,
        status: StatementStatus.OPEN,
      }),
    );
  }

  private async persistRows(
    user: User,
    account: Account,
    batch: ImportBatch,
    rows: ParsedRow[],
    statement: CreditCardStatement | null,
  ): Promise<{ imported: number; skipped: number; uncategorized: number }> {
    const userRules = await this.rules.find({
      where: { user: { id: user.id } },
      relations: { category: true },
    });

    // Fingerprint everything first, then check existing ones in a single query.
    const fingerprinted = rows.map((row) => ({
      row,
      fingerprint: this.fingerprint(account.id, row),
    }));
    const existing = await this.dataSource
      .getRepository(Transaction)
      .find({
        select: { fingerprint: true },
        where: {
          account: { id: account.id },
          fingerprint: In(fingerprinted.map((f) => f.fingerprint)),
        },
      });
    const seen = new Set(existing.map((t) => t.fingerprint));

    let imported = 0;
    let skipped = 0;
    let uncategorized = 0;

    // FX valuation happens BEFORE the DB transaction: onDate() may call an
    // external API and we don't want to hold the transaction open meanwhile.
    const toInsert: {
      row: ParsedRow;
      fingerprint: string;
      valuation: { baseArsCents: number; perceptionArsCents: number } | null;
    }[] = [];
    for (const { row, fingerprint } of fingerprinted) {
      if (seen.has(fingerprint)) {
        skipped++; // overlapping statement re-upload — counted, not errored
        continue;
      }
      seen.add(fingerprint); // also dedupes within the same file
      toInsert.push({
        row,
        fingerprint,
        valuation: await this.valuateUsdCardSpend(account, statement, row),
      });
    }

    // All inserts in one DB transaction: a mid-file failure rolls back cleanly.
    await this.dataSource.transaction(async (manager) => {
      for (const { row, fingerprint, valuation } of toInsert) {
        const category = this.categorization.categorize(
          `${row.description} ${row.merchant ?? ''}`,
          userRules,
        );
        const isTransfer = row.typeHint === TransactionType.TRANSFER;
        if (!category && !isTransfer) {
          uncategorized++;
        }

        await manager.getRepository(Transaction).insert({
          user: { id: user.id },
          account: { id: account.id },
          category: category && !isTransfer ? { id: category.id } : null,
          type:
            row.typeHint ??
            (row.amountCents >= 0
              ? TransactionType.INCOME
              : TransactionType.EXPENSE),
          amountCents: row.amountCents,
          currency: row.currency,
          description: row.description || null,
          merchant: row.merchant ?? null,
          postedAt: row.postedAt,
          source: TransactionSource.IMPORT,
          fingerprint,
          importBatch: { id: batch.id },
          creditCardStatement: statement ? { id: statement.id } : null,
          baseArsCents: valuation?.baseArsCents ?? null,
          perceptionArsCents: valuation?.perceptionArsCents ?? null,
        });
        imported++;
      }
    });

    return { imported, skipped, uncategorized };
  }

  /**
   * The dólar-tarjeta freeze. A USD purchase on a credit card costs, in pesos:
   *   - baseArsCents: the amount at that day's OFICIAL rate, plus
   *   - perceptionArsCents: the surcharge, derived as (TARJETA − OFICIAL)
   *     conversion for that date — never a hardcoded 30%, the rules change.
   * Whether the perception sticks is decided at settlement (see settleStatement).
   */
  private async valuateUsdCardSpend(
    account: Account,
    statement: CreditCardStatement | null,
    row: ParsedRow,
  ): Promise<{ baseArsCents: number; perceptionArsCents: number } | null> {
    const isCardSpend =
      statement !== null &&
      account.type === AccountType.CREDIT_CARD &&
      row.currency === Currency.USD &&
      row.typeHint !== TransactionType.TRANSFER;
    if (!isCardSpend) {
      return null;
    }
    const date = row.postedAt.toISOString().slice(0, 10);
    const magnitude = Math.abs(row.amountCents);
    const base = await this.fx.toArsCents(magnitude, Currency.USD, {
      rateType: RateType.OFICIAL,
      date,
    });
    const tarjeta = await this.fx.toArsCents(magnitude, Currency.USD, {
      rateType: RateType.TARJETA,
      date,
    });
    const sign = Math.sign(row.amountCents) || 1;
    return {
      baseArsCents: sign * base,
      perceptionArsCents: sign * (tarjeta - base),
    };
  }

  /**
   * Resolves a resumen at payment time:
   *  - paid in ARS → full cost stands (base + perception).
   *  - paid in USD (between closing and due date) → the bank reverses the
   *    perception: mark it reversed so reports cost only baseArsCents.
   */
  async settleStatement(
    user: User,
    statementId: string,
    paymentCurrency: Currency,
  ): Promise<CreditCardStatement> {
    const statement = await this.statements.findOne({
      where: { id: statementId, user: { id: user.id } },
    });
    if (!statement) {
      throw new NotFoundException('Credit-card statement not found');
    }
    statement.paymentCurrency = paymentCurrency;
    statement.status = StatementStatus.PAID;
    await this.statements.save(statement);

    if (paymentCurrency === Currency.USD) {
      await this.dataSource
        .getRepository(Transaction)
        .update(
          { creditCardStatement: { id: statement.id }, currency: Currency.USD },
          { perceptionReversed: true },
        );
    }
    return statement;
  }

  listStatements(user: User): Promise<CreditCardStatement[]> {
    return this.statements.find({
      where: { user: { id: user.id } },
      relations: { account: true },
      order: { closingDate: 'DESC' },
    });
  }

  /**
   * Dedup hash. With a provider-stable externalId the fingerprint survives
   * description/format changes; otherwise fall back to the content tuple.
   * The amount is part of the key even with an externalId: MercadoPago reuses
   * one operation id for linked movements (e.g. a debin's credit + debit legs).
   */
  private fingerprint(accountId: string, row: ParsedRow): string {
    const key = row.externalId
      ? `${accountId}|ext|${row.externalId}|${row.amountCents}`
      : `${accountId}|${row.postedAt.toISOString().slice(0, 10)}|${row.amountCents}|${normalizeDescription(row.description)}`;
    return createHash('sha256').update(key).digest('hex');
  }
}
