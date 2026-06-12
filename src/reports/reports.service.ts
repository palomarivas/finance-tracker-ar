import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../accounts/entities/account.entity';
import { Budget } from '../budgets/entities/budget.entity';
import { Currency } from '../common/enums/currency.enum';
import { ExchangeRate } from '../fx/entities/exchange-rate.entity';
import { RateType } from '../fx/enums/rate-type.enum';
import { FxService } from '../fx/fx.service';
import { convertUsdCentsToArsCents } from '../fx/fx.util';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { User } from '../users/entities/user.entity';
import { frozenArsCents } from './report-cost.util';

export interface SpendByCategoryItem {
  categoryId: string | null;
  categoryName: string;
  spentArsCents: number;
  sharePct: number;
}

export interface BudgetVsActualItem {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  budgetCents: number;
  actualCents: number;
  remainingCents: number;
  usedPct: number;
}

export interface NetWorthAccount {
  accountId: string;
  name: string;
  type: string;
  balances: Partial<Record<Currency, number>>;
  valueArsCents: number;
  rateUsed: { rateType: RateType; date: string; buyCents: number } | null;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    @InjectRepository(Budget)
    private readonly budgets: Repository<Budget>,
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
    private readonly fx: FxService,
  ) {}

  /** Month income vs expense, FX-resolved to ARS. Transfers excluded. */
  async summary(user: User, month: string) {
    const txs = await this.monthTransactions(user, month);
    let incomeArsCents = 0;
    let expenseArsCents = 0;
    for (const tx of txs) {
      if (tx.type === TransactionType.TRANSFER) {
        continue;
      }
      const ars = await this.resolveArsCents(tx);
      if (tx.type === TransactionType.INCOME) {
        incomeArsCents += ars;
      } else {
        expenseArsCents += ars;
      }
    }
    return {
      month,
      incomeArsCents,
      expenseArsCents,
      netArsCents: incomeArsCents + expenseArsCents,
    };
  }

  /** Expenses of the month grouped by category, largest first. */
  async spendByCategory(user: User, month: string) {
    const txs = await this.monthTransactions(user, month);
    const groups = new Map<string | null, { name: string; cents: number }>();
    let totalArsCents = 0;

    for (const tx of txs) {
      if (tx.type !== TransactionType.EXPENSE) {
        continue;
      }
      const ars = await this.resolveArsCents(tx);
      const key = tx.category?.id ?? null;
      const group = groups.get(key) ?? {
        name: tx.category?.name ?? 'Sin categoría',
        cents: 0,
      };
      group.cents += ars;
      groups.set(key, group);
      totalArsCents += ars;
    }

    const items: SpendByCategoryItem[] = [...groups.entries()]
      .map(([categoryId, g]) => ({
        categoryId,
        categoryName: g.name,
        spentArsCents: g.cents,
        sharePct:
          totalArsCents !== 0
            ? Math.round((1000 * g.cents) / totalArsCents) / 10
            : 0,
      }))
      .sort((a, b) => a.spentArsCents - b.spentArsCents); // most negative first

    return { month, totalArsCents, items };
  }

  /** Each budget of the month against the actual categorized spend. */
  async budgetVsActual(user: User, month: string) {
    const budgets = await this.budgets.find({
      where: { user: { id: user.id }, periodMonth: `${month}-01` },
      relations: { category: true },
    });
    const spend = await this.spendByCategory(user, month);
    const spentByCategory = new Map(
      spend.items.map((i) => [i.categoryId, i.spentArsCents]),
    );

    const items: BudgetVsActualItem[] = budgets.map((budget) => {
      // Spend is negative cents; budgets are positive caps.
      const actualCents = Math.abs(spentByCategory.get(budget.category.id) ?? 0);
      return {
        budgetId: budget.id,
        categoryId: budget.category.id,
        categoryName: budget.category.name,
        budgetCents: budget.amountCents,
        actualCents,
        remainingCents: budget.amountCents - actualCents,
        usedPct: Math.round((1000 * actualCents) / budget.amountCents) / 10,
      };
    });
    return { month, items };
  }

  /**
   * Net worth across accounts:
   *  - ARS rows sum natively.
   *  - USD card spend uses its frozen, settlement-resolved peso cost.
   *  - other USD balances are marked to market at the account's valuation
   *    rate (default MEP), buy side — what a casa would pay for the dollars.
   */
  async netWorth(user: User) {
    const accounts = await this.accounts.find({
      where: { user: { id: user.id } },
      order: { createdAt: 'ASC' },
    });

    const buckets = await this.transactions
      .createQueryBuilder('t')
      .select('t.account_id', 'accountId')
      .addSelect('t.currency', 'currency')
      .addSelect('COALESCE(SUM(t.amount_cents), 0)', 'nativeSum')
      .addSelect(
        `COALESCE(SUM(CASE WHEN t.base_ars_cents IS NOT NULL
           THEN t.base_ars_cents + CASE WHEN t.perception_reversed THEN 0 ELSE COALESCE(t.perception_ars_cents, 0) END
           ELSE 0 END), 0)`,
        'frozenArsSum',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN t.base_ars_cents IS NULL THEN t.amount_cents ELSE 0 END), 0)',
        'unfrozenNativeSum',
      )
      .where('t.user_id = :userId', { userId: user.id })
      .groupBy('t.account_id')
      .addGroupBy('t.currency')
      .getRawMany<{
        accountId: string;
        currency: Currency;
        nativeSum: string;
        frozenArsSum: string;
        unfrozenNativeSum: string;
      }>();

    const rateCache = new Map<RateType, ExchangeRate>();
    const result: NetWorthAccount[] = [];
    let totalArsCents = 0;

    for (const account of accounts) {
      const own = buckets.filter((b) => b.accountId === account.id);
      const balances: Partial<Record<Currency, number>> = {};
      let valueArsCents = 0;
      let rateUsed: NetWorthAccount['rateUsed'] = null;

      for (const bucket of own) {
        const native = Number(bucket.nativeSum);
        balances[bucket.currency] = (balances[bucket.currency] ?? 0) + native;

        if (bucket.currency === Currency.ARS) {
          valueArsCents += native;
          continue;
        }
        // USD: frozen card costs are already pesos…
        valueArsCents += Number(bucket.frozenArsSum);
        // …the rest is a holding, valued live at the account's rate.
        const unfrozen = Number(bucket.unfrozenNativeSum);
        if (unfrozen !== 0) {
          const rateType = account.valuationRateType ?? RateType.MEP;
          const rate = await this.latestRate(rateType, rateCache);
          valueArsCents += convertUsdCentsToArsCents(unfrozen, rate.buyCents);
          rateUsed = { rateType, date: rate.date, buyCents: rate.buyCents };
        }
      }

      result.push({
        accountId: account.id,
        name: account.name,
        type: account.type,
        balances,
        valueArsCents,
        rateUsed,
      });
      totalArsCents += valueArsCents;
    }

    return { asOf: new Date().toISOString(), totalArsCents, accounts: result };
  }

  // ---------------------------------------------------------------- helpers

  private async monthTransactions(user: User, month: string): Promise<Transaction[]> {
    const [year, mm] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, mm - 1, 1));
    const end = new Date(Date.UTC(year, mm, 1));
    return this.transactions
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.account', 'account')
      .where('t.user_id = :userId', { userId: user.id })
      .andWhere('t.posted_at >= :start AND t.posted_at < :end', { start, end })
      .getMany();
  }

  /**
   * Effective ARS value of one transaction: native for ARS, frozen cost for
   * valued card spend, otherwise converted at the account's valuation rate
   * (default MEP) on the posting date.
   */
  private async resolveArsCents(tx: Transaction): Promise<number> {
    if (tx.currency === Currency.ARS) {
      return tx.amountCents;
    }
    const frozen = frozenArsCents(tx);
    if (frozen !== null) {
      return frozen;
    }
    return this.fx.toArsCents(tx.amountCents, tx.currency, {
      rateType: tx.account?.valuationRateType ?? RateType.MEP,
      date: tx.postedAt.toISOString().slice(0, 10),
      side: 'buy',
    });
  }

  private async latestRate(
    rateType: RateType,
    cache: Map<RateType, ExchangeRate>,
  ): Promise<ExchangeRate> {
    const cached = cache.get(rateType);
    if (cached) {
      return cached;
    }
    const rate =
      (await this.fx.latest(rateType)) ??
      (await this.fx.onDate(rateType, new Date().toISOString().slice(0, 10)));
    cache.set(rateType, rate);
    return rate;
  }
}
