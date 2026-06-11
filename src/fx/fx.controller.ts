import { Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { LatestRateQueryDto } from './dto/rate-query.dto';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { FxService } from './fx.service';

@Controller('fx')
export class FxController {
  constructor(private readonly fx: FxService) {}

  /** Most recent rate of every type. */
  @Get('rates')
  rates(): Promise<ExchangeRate[]> {
    return this.fx.latestAll();
  }

  /** Latest rate for a type, or the rate on a given date if `date` is provided. */
  @Get('latest')
  latest(@Query() query: LatestRateQueryDto): Promise<ExchangeRate | null> {
    return query.date
      ? this.fx.onDate(query.rateType, query.date)
      : this.fx.latest(query.rateType);
  }

  /** Manually trigger a sync of today's rates from dolarapi. */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  sync(): Promise<{ synced: number; date: string }> {
    return this.fx.syncToday();
  }
}
