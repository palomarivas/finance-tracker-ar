import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

/**
 * Wires TypeORM to Postgres using the validated env config.
 * `synchronize` is intentionally false — schema changes go through migrations
 * (see src/database/data-source.ts and the db:* npm scripts).
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        const ssl =
          config.get<string>('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false;
        return {
          type: 'postgres' as const,
          // DATABASE_URL (hosted Postgres) wins; otherwise individual params (local).
          ...(url
            ? { url }
            : {
                host: config.get<string>('DB_HOST'),
                port: config.get<number>('DB_PORT'),
                username: config.get<string>('DB_USERNAME'),
                password: config.get<string>('DB_PASSWORD'),
                database: config.get<string>('DB_NAME'),
              }),
          ssl,
          namingStrategy: new SnakeNamingStrategy(),
          autoLoadEntities: true,
          synchronize: false,
          // Run pending migrations on boot when enabled (the deployed API).
          migrationsRun: config.get<string>('DB_MIGRATIONS_RUN') === 'true',
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
        };
      },
    }),
  ],
})
export class DatabaseModule {}
