import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/entities/account.entity';
import { Budget } from '../budgets/entities/budget.entity';
import { FxModule } from '../fx/fx.module';
import { Transaction } from '../transactions/entities/transaction.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/** Read-only aggregations — no entities of its own. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Budget, Account]),
    FxModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
