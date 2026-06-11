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
import { CategorizationService } from '../categorization/categorization.service';
import { Rule } from '../rules/entities/rule.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionSource } from '../transactions/enums/transaction-source.enum';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { User } from '../users/entities/user.entity';
import { ImportBatch } from './entities/import-batch.entity';
import { ImportBatchStatus } from './enums/import-batch-status.enum';
import { normalizeDescription } from './parsers/parse-ar.util';
import {
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly categorization: CategorizationService,
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
      const rows = await parser.parse(buffer);
      const summary = await this.persistRows(user, account, batch, rows);
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

  private async persistRows(
    user: User,
    account: Account,
    batch: ImportBatch,
    rows: ParsedRow[],
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

    // All inserts in one DB transaction: a mid-file failure rolls back cleanly.
    await this.dataSource.transaction(async (manager) => {
      for (const { row, fingerprint } of fingerprinted) {
        if (seen.has(fingerprint)) {
          skipped++; // overlapping statement re-upload — counted, not errored
          continue;
        }
        seen.add(fingerprint); // also dedupes within the same file

        const category = this.categorization.categorize(
          `${row.description} ${row.merchant ?? ''}`,
          userRules,
        );
        if (!category) {
          uncategorized++;
        }

        await manager.getRepository(Transaction).insert({
          user: { id: user.id },
          account: { id: account.id },
          category: category ? { id: category.id } : null,
          type:
            row.amountCents >= 0
              ? TransactionType.INCOME
              : TransactionType.EXPENSE,
          amountCents: row.amountCents,
          currency: row.currency,
          description: row.description || null,
          merchant: row.merchant ?? null,
          postedAt: row.postedAt,
          source: TransactionSource.IMPORT,
          fingerprint,
          importBatch: { id: batch.id },
          // FX valuation fields stay null here: ARS rows need none, and USD
          // card-spend freezing arrives with the credit-card statement parser.
        });
        imported++;
      }
    });

    return { imported, skipped, uncategorized };
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
