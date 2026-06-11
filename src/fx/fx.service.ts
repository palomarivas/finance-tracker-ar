import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { Currency } from '../common/enums/currency.enum';
import { todayInArgentina, toSlashDate } from '../common/utils/ar-date';
import {
  ArgentinaDatosQuote,
  DolarApiQuote,
} from './dto/external-quote.interface';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { RateType } from './enums/rate-type.enum';
import {
  ARGENTINADATOS_BASE_URL,
  CASA_TO_RATE_TYPE,
  DOLARAPI_BASE_URL,
  RATE_TYPE_TO_CASA,
} from './fx.constants';
import { convertUsdCentsToArsCents, pesosToCents } from './fx.util';

@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);

  constructor(
    @InjectRepository(ExchangeRate)
    private readonly rates: Repository<ExchangeRate>,
    private readonly http: HttpService,
  ) {}

  /** Pulls every casa from dolarapi.com in one call and upserts today's rates. */
  async syncToday(): Promise<{ synced: number; date: string }> {
    const date = todayInArgentina();
    const { data } = await firstValueFrom(
      this.http.get<DolarApiQuote[]>(`${DOLARAPI_BASE_URL}/dolares`),
    );

    let synced = 0;
    for (const quote of data) {
      const rateType = CASA_TO_RATE_TYPE[quote.casa];
      if (!rateType || quote.compra == null || quote.venta == null) {
        continue; // casa we don't track, or an incomplete quote
      }
      await this.upsertRate({
        rateType,
        date,
        buyCents: pesosToCents(quote.compra),
        sellCents: pesosToCents(quote.venta),
        source: 'dolarapi',
      });
      synced++;
    }
    this.logger.log(`Synced ${synced} rates for ${date}`);
    return { synced, date };
  }

  /** Latest stored rate for a type (most recent date), or null. */
  latest(rateType: RateType): Promise<ExchangeRate | null> {
    return this.rates.findOne({ where: { rateType }, order: { date: 'DESC' } });
  }

  /** The most recent rate of every type (one row per RateType). */
  async latestAll(): Promise<ExchangeRate[]> {
    const all = await this.rates.find({ order: { date: 'DESC' } });
    const newestPerType = new Map<RateType, ExchangeRate>();
    for (const rate of all) {
      if (!newestPerType.has(rate.rateType)) {
        newestPerType.set(rate.rateType, rate);
      }
    }
    return [...newestPerType.values()];
  }

  /**
   * Rate for a type on a specific date. If not stored, fetches it from
   * ArgentinaDatos, persists it, and returns it.
   */
  async onDate(rateType: RateType, date: string): Promise<ExchangeRate> {
    const existing = await this.rates.findOne({ where: { rateType, date } });
    if (existing) {
      return existing;
    }

    const casa = RATE_TYPE_TO_CASA[rateType];
    const url = `${ARGENTINADATOS_BASE_URL}/cotizaciones/dolares/${casa}/${toSlashDate(date)}`;
    const { data } = await firstValueFrom(
      this.http.get<ArgentinaDatosQuote>(url),
    );
    if (data?.compra == null || data?.venta == null) {
      throw new NotFoundException(`No ${rateType} rate available for ${date}`);
    }
    return this.upsertRate({
      rateType,
      date,
      buyCents: pesosToCents(data.compra),
      sellCents: pesosToCents(data.venta),
      source: 'argentinadatos',
    });
  }

  /**
   * Convert an amount to ARS cents. ARS passes through unchanged; USD is valued
   * at `rateType` for `date` (default today), using the sell side by default.
   */
  async toArsCents(
    amountCents: number,
    fromCurrency: Currency,
    opts: { rateType: RateType; date?: string; side?: 'buy' | 'sell' },
  ): Promise<number> {
    if (fromCurrency === Currency.ARS) {
      return amountCents;
    }

    const rate = opts.date
      ? await this.onDate(opts.rateType, opts.date)
      : ((await this.latest(opts.rateType)) ??
        (await this.onDate(opts.rateType, todayInArgentina())));

    const priceCents =
      (opts.side ?? 'sell') === 'buy' ? rate.buyCents : rate.sellCents;
    return convertUsdCentsToArsCents(amountCents, priceCents);
  }

  /** Daily sync (server local time). */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleDailySync(): Promise<void> {
    try {
      await this.syncToday();
    } catch (err) {
      this.logger.error('Daily FX sync failed', err as Error);
    }
  }

  /** Backfill the last `days` days from ArgentinaDatos (used by the seed script). */
  async seedRecent(days = 5): Promise<number> {
    let count = 0;
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      const iso = todayInArgentina(day);
      for (const rateType of Object.values(RateType)) {
        try {
          await this.onDate(rateType, iso);
          count++;
        } catch {
          // No quote for that casa/date (weekend, holiday, untracked) — skip.
        }
      }
    }
    return count;
  }

  private async upsertRate(input: {
    rateType: RateType;
    date: string;
    buyCents: number;
    sellCents: number;
    source: string;
  }): Promise<ExchangeRate> {
    await this.rates.upsert(
      {
        rateType: input.rateType,
        date: input.date,
        baseCurrency: Currency.USD,
        quoteCurrency: Currency.ARS,
        buyCents: input.buyCents,
        sellCents: input.sellCents,
        source: input.source,
      },
      { conflictPaths: ['rateType', 'date'] },
    );
    return this.rates.findOneOrFail({
      where: { rateType: input.rateType, date: input.date },
    });
  }
}
