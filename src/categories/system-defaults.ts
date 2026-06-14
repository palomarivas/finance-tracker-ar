import { CategoryKind } from './enums/category-kind.enum';

/**
 * Shared system-default categories (user IS NULL), used by both the seed
 * script and the boot-time seeding in CategoriesService. es-AR names.
 */
export const SYSTEM_CATEGORY_DEFAULTS: Record<CategoryKind, string[]> = {
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
