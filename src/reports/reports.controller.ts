import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { MonthQueryDto } from './dto/month-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Income vs expense for a month, in ARS. */
  @Get('summary')
  summary(@CurrentUser() user: User, @Query() query: MonthQueryDto) {
    return this.reports.summary(user, query.month);
  }

  /** Month's expenses grouped by category. */
  @Get('spend-by-category')
  spendByCategory(@CurrentUser() user: User, @Query() query: MonthQueryDto) {
    return this.reports.spendByCategory(user, query.month);
  }

  /** Budgets of the month vs what was actually spent. */
  @Get('budget-vs-actual')
  budgetVsActual(@CurrentUser() user: User, @Query() query: MonthQueryDto) {
    return this.reports.budgetVsActual(user, query.month);
  }

  /** All accounts valued in ARS (live USD valuation + resolved card costs). */
  @Get('net-worth')
  netWorth(@CurrentUser() user: User) {
    return this.reports.netWorth(user);
  }
}
