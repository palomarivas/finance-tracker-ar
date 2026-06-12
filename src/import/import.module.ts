import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/entities/account.entity';
import { CategorizationModule } from '../categorization/categorization.module';
import { Category } from '../categories/entities/category.entity';
import { FxModule } from '../fx/fx.module';
import { Rule } from '../rules/entities/rule.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { CreditCardStatement } from './entities/credit-card-statement.entity';
import { ImportBatch } from './entities/import-batch.entity';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { GenericCsvParser } from './parsers/generic-csv.parser';
import { MercadoPagoPdfParser } from './parsers/mercadopago-pdf.parser';
import { STATEMENT_PARSERS } from './parsers/statement-parser.interface';
import { VisaResumenPdfParser } from './parsers/visa-resumen-pdf.parser';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ImportBatch,
      CreditCardStatement,
      Transaction,
      Account,
      Rule,
      Category,
    ]),
    CategorizationModule,
    FxModule,
  ],
  controllers: [ImportController],
  providers: [
    ImportService,
    MercadoPagoPdfParser,
    VisaResumenPdfParser,
    GenericCsvParser,
    {
      // Ordered: specific parsers first, the generic CSV fallback last.
      provide: STATEMENT_PARSERS,
      inject: [MercadoPagoPdfParser, VisaResumenPdfParser, GenericCsvParser],
      useFactory: (
        ...parsers: (MercadoPagoPdfParser | VisaResumenPdfParser | GenericCsvParser)[]
      ) => parsers,
    },
  ],
  exports: [ImportService],
})
export class ImportModule {}
