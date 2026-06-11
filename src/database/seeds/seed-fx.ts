import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { FxService } from '../../fx/fx.service';

/**
 * Seeds the exchange_rates table: today's rates from dolarapi plus a few recent
 * days backfilled from ArgentinaDatos. Run with `npm run seed:fx`.
 */
async function run(): Promise<void> {
  const logger = new Logger('seed:fx');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const fx = app.get(FxService);

    const today = await fx.syncToday();
    logger.log(`Synced ${today.synced} rates for ${today.date} (dolarapi)`);

    const backfilled = await fx.seedRecent(5);
    logger.log(`Backfilled ${backfilled} historical rows (argentinadatos)`);
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
