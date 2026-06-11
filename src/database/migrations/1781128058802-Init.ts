import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1781128058802 implements MigrationInterface {
    name = 'Init1781128058802'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Provides uuid_generate_v4() used by the uuid primary keys below.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TYPE "public"."users_base_currency_enum" AS ENUM('ARS', 'USD')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "base_currency" "public"."users_base_currency_enum" NOT NULL DEFAULT 'ARS', CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TYPE "public"."accounts_type_enum" AS ENUM('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'WALLET', 'CASH')`);
        await queryRunner.query(`CREATE TYPE "public"."accounts_currency_enum" AS ENUM('ARS', 'USD')`);
        await queryRunner.query(`CREATE TYPE "public"."accounts_valuation_rate_type_enum" AS ENUM('OFICIAL', 'TARJETA', 'BLUE', 'MEP', 'CCL', 'MAYORISTA', 'CRIPTO')`);
        await queryRunner.query(`CREATE TABLE "accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "type" "public"."accounts_type_enum" NOT NULL, "institution" character varying, "currency" "public"."accounts_currency_enum" NOT NULL, "valuation_rate_type" "public"."accounts_valuation_rate_type_enum", "user_id" uuid NOT NULL, CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."categories_kind_enum" AS ENUM('INCOME', 'EXPENSE')`);
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "kind" "public"."categories_kind_enum" NOT NULL, "user_id" uuid, "parent_id" uuid, CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."credit_card_statements_payment_currency_enum" AS ENUM('ARS', 'USD')`);
        await queryRunner.query(`CREATE TYPE "public"."credit_card_statements_status_enum" AS ENUM('OPEN', 'PAID')`);
        await queryRunner.query(`CREATE TABLE "credit_card_statements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "closing_date" date NOT NULL, "due_date" date NOT NULL, "payment_currency" "public"."credit_card_statements_payment_currency_enum" NOT NULL, "status" "public"."credit_card_statements_status_enum" NOT NULL DEFAULT 'OPEN', "user_id" uuid NOT NULL, "account_id" uuid NOT NULL, CONSTRAINT "PK_c341e09611ffa8f98c0414dc98d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."import_batches_status_enum" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "import_batches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "filename" character varying NOT NULL, "status" "public"."import_batches_status_enum" NOT NULL DEFAULT 'PENDING', "rows_imported" integer NOT NULL DEFAULT '0', "rows_skipped" integer NOT NULL DEFAULT '0', "error_message" text, "user_id" uuid NOT NULL, "account_id" uuid NOT NULL, CONSTRAINT "PK_6162597a2576c03e04bb2c1a2dd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_type_enum" AS ENUM('INCOME', 'EXPENSE', 'TRANSFER')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_currency_enum" AS ENUM('ARS', 'USD')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_source_enum" AS ENUM('MANUAL', 'IMPORT', 'EMAIL')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" "public"."transactions_type_enum" NOT NULL, "amount_cents" bigint NOT NULL, "currency" "public"."transactions_currency_enum" NOT NULL, "description" text, "merchant" character varying, "posted_at" TIMESTAMP WITH TIME ZONE NOT NULL, "source" "public"."transactions_source_enum" NOT NULL DEFAULT 'MANUAL', "fingerprint" character varying NOT NULL, "transfer_group_id" uuid, "base_ars_cents" bigint, "perception_ars_cents" bigint, "perception_reversed" boolean NOT NULL DEFAULT false, "user_id" uuid NOT NULL, "account_id" uuid NOT NULL, "category_id" uuid, "import_batch_id" uuid, "credit_card_statement_id" uuid, CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9e645dc01eedaf52951b18a4b7" ON "transactions" ("transfer_group_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_da43117aa52f8f0a9f9ff79cf5" ON "transactions" ("posted_at") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ece418b0e1b1f4de9df583715d" ON "transactions" ("account_id", "fingerprint") `);
        await queryRunner.query(`CREATE TYPE "public"."rules_match_type_enum" AS ENUM('CONTAINS', 'STARTS_WITH', 'REGEX')`);
        await queryRunner.query(`CREATE TABLE "rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "match_type" "public"."rules_match_type_enum" NOT NULL, "pattern" character varying NOT NULL, "priority" integer NOT NULL DEFAULT '0', "user_id" uuid NOT NULL, "category_id" uuid NOT NULL, CONSTRAINT "PK_10fef696a7d61140361b1b23608" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."exchange_rates_rate_type_enum" AS ENUM('OFICIAL', 'TARJETA', 'BLUE', 'MEP', 'CCL', 'MAYORISTA', 'CRIPTO')`);
        await queryRunner.query(`CREATE TYPE "public"."exchange_rates_base_currency_enum" AS ENUM('ARS', 'USD')`);
        await queryRunner.query(`CREATE TYPE "public"."exchange_rates_quote_currency_enum" AS ENUM('ARS', 'USD')`);
        await queryRunner.query(`CREATE TABLE "exchange_rates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "rate_type" "public"."exchange_rates_rate_type_enum" NOT NULL, "base_currency" "public"."exchange_rates_base_currency_enum" NOT NULL DEFAULT 'USD', "quote_currency" "public"."exchange_rates_quote_currency_enum" NOT NULL DEFAULT 'ARS', "date" date NOT NULL, "buy_cents" bigint NOT NULL, "sell_cents" bigint NOT NULL, "source" character varying NOT NULL, CONSTRAINT "PK_33a614bad9e61956079d817ebe2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8ad681c12a0a86d3c109a7fdd0" ON "exchange_rates" ("rate_type", "date") `);
        await queryRunner.query(`CREATE TABLE "budgets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "amount_cents" bigint NOT NULL, "period_month" date NOT NULL, "user_id" uuid NOT NULL, "category_id" uuid NOT NULL, CONSTRAINT "PK_9c8a51748f82387644b773da482" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0acd6cf3468d11b6cf05bb8f8e" ON "budgets" ("user_id", "category_id", "period_month") `);
        await queryRunner.query(`ALTER TABLE "accounts" ADD CONSTRAINT "FK_3000dad1da61b29953f07476324" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_2296b7fe012d95646fa41921c8b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_88cea2dc9c31951d06437879b40" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "credit_card_statements" ADD CONSTRAINT "FK_7a01bf03129e3f1ed9847690032" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "credit_card_statements" ADD CONSTRAINT "FK_5608a3881985b4e8dd19ea8acc1" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "import_batches" ADD CONSTRAINT "FK_b75a8496dcd95067be919bba660" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "import_batches" ADD CONSTRAINT "FK_7ef70ec6616d8cb7a4ad99ddae1" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_49c0d6e8ba4bfb5582000d851f0" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_5978bd3c7a98004633cbc472022" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_cc40fcb1fbb0634e7f24a5fec3f" FOREIGN KEY ("credit_card_statement_id") REFERENCES "credit_card_statements"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rules" ADD CONSTRAINT "FK_a25301750f8ef387215a9c6043b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rules" ADD CONSTRAINT "FK_82d72999266cf5aed89fc4614f3" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "budgets" ADD CONSTRAINT "FK_5d25d8bbd6c209261dfe04558f1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "budgets" ADD CONSTRAINT "FK_4bb589bf6db49e8c1fd6af05f49" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "FK_4bb589bf6db49e8c1fd6af05f49"`);
        await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "FK_5d25d8bbd6c209261dfe04558f1"`);
        await queryRunner.query(`ALTER TABLE "rules" DROP CONSTRAINT "FK_82d72999266cf5aed89fc4614f3"`);
        await queryRunner.query(`ALTER TABLE "rules" DROP CONSTRAINT "FK_a25301750f8ef387215a9c6043b"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_cc40fcb1fbb0634e7f24a5fec3f"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_5978bd3c7a98004633cbc472022"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_c9e41213ca42d50132ed7ab2b0f"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_49c0d6e8ba4bfb5582000d851f0"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b"`);
        await queryRunner.query(`ALTER TABLE "import_batches" DROP CONSTRAINT "FK_7ef70ec6616d8cb7a4ad99ddae1"`);
        await queryRunner.query(`ALTER TABLE "import_batches" DROP CONSTRAINT "FK_b75a8496dcd95067be919bba660"`);
        await queryRunner.query(`ALTER TABLE "credit_card_statements" DROP CONSTRAINT "FK_5608a3881985b4e8dd19ea8acc1"`);
        await queryRunner.query(`ALTER TABLE "credit_card_statements" DROP CONSTRAINT "FK_7a01bf03129e3f1ed9847690032"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_88cea2dc9c31951d06437879b40"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_2296b7fe012d95646fa41921c8b"`);
        await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT "FK_3000dad1da61b29953f07476324"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0acd6cf3468d11b6cf05bb8f8e"`);
        await queryRunner.query(`DROP TABLE "budgets"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ad681c12a0a86d3c109a7fdd0"`);
        await queryRunner.query(`DROP TABLE "exchange_rates"`);
        await queryRunner.query(`DROP TYPE "public"."exchange_rates_quote_currency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."exchange_rates_base_currency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."exchange_rates_rate_type_enum"`);
        await queryRunner.query(`DROP TABLE "rules"`);
        await queryRunner.query(`DROP TYPE "public"."rules_match_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ece418b0e1b1f4de9df583715d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da43117aa52f8f0a9f9ff79cf5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e645dc01eedaf52951b18a4b7"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_source_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_currency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
        await queryRunner.query(`DROP TABLE "import_batches"`);
        await queryRunner.query(`DROP TYPE "public"."import_batches_status_enum"`);
        await queryRunner.query(`DROP TABLE "credit_card_statements"`);
        await queryRunner.query(`DROP TYPE "public"."credit_card_statements_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."credit_card_statements_payment_currency_enum"`);
        await queryRunner.query(`DROP TABLE "categories"`);
        await queryRunner.query(`DROP TYPE "public"."categories_kind_enum"`);
        await queryRunner.query(`DROP TABLE "accounts"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_valuation_rate_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_currency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounts_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_base_currency_enum"`);
    }

}
