import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

// Standalone DataSource used by the TypeORM CLI for migrations (outside Nest's DI).
loadEnv();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
