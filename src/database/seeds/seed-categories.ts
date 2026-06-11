import { Logger } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { CategoryKind } from '../../categories/enums/category-kind.enum';
import dataSource from '../data-source';

/**
 * Seeds the shared system-default categories (user IS NULL). Idempotent:
 * existing (name, kind) system rows are kept. Run with `npm run seed:categories`.
 */
const DEFAULTS: Record<CategoryKind, string[]> = {
  [CategoryKind.INCOME]: ['Sueldo', 'Inversiones', 'Ventas', 'Otros ingresos'],
  [CategoryKind.EXPENSE]: [
    'Supermercado',
    'Comida y delivery',
    'Transporte',
    'Servicios',
    'Hogar',
    'Salud',
    'Entretenimiento',
    'Ropa',
    'Educación',
    'Impuestos y comisiones',
    'Mascotas',
    'Otros gastos',
  ],
};

async function run(): Promise<void> {
  const logger = new Logger('seed:categories');
  await dataSource.initialize();
  try {
    const repo = dataSource.getRepository(Category);
    let created = 0;
    for (const [kind, names] of Object.entries(DEFAULTS) as [CategoryKind, string[]][]) {
      for (const name of names) {
        const exists = await repo.exists({
          where: { name, kind, user: IsNull() },
        });
        if (!exists) {
          await repo.save(repo.create({ name, kind, user: null }));
          created++;
        }
      }
    }
    logger.log(`System categories: ${created} created (rest already present)`);
  } finally {
    await dataSource.destroy();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
