import { Category } from '../categories/entities/category.entity';
import { RuleMatchType } from '../rules/enums/rule-match-type.enum';
import { CategorizationService } from './categorization.service';

const cat = (name: string) => ({ name }) as Category;

const rule = (
  matchType: RuleMatchType,
  pattern: string,
  priority: number,
  category: Category,
) => ({ matchType, pattern, priority, category });

describe('CategorizationService', () => {
  const service = new CategorizationService();
  const comida = cat('Comida');
  const transporte = cat('Transporte');
  const servicios = cat('Servicios');

  it('matches CONTAINS case-insensitively', () => {
    const rules = [rule(RuleMatchType.CONTAINS, 'sube', 0, transporte)];
    expect(service.categorize('Pago SUBE Viajes', rules)).toBe(transporte);
  });

  it('matches STARTS_WITH', () => {
    const rules = [rule(RuleMatchType.STARTS_WITH, 'rappi', 0, comida)];
    expect(service.categorize('RAPPI ARG S.A.S.', rules)).toBe(comida);
    expect(service.categorize('PROPINA*RAPPI', rules)).toBeNull();
  });

  it('matches REGEX', () => {
    const rules = [rule(RuleMatchType.REGEX, 'merpago\\*\\w+', 0, servicios)];
    expect(service.categorize('MERPAGO*FULLENLINEA', rules)).toBe(servicios);
  });

  it('higher priority wins when several rules match', () => {
    const rules = [
      rule(RuleMatchType.CONTAINS, 'pago', 1, servicios),
      rule(RuleMatchType.CONTAINS, 'sube', 10, transporte),
    ];
    expect(service.categorize('Pago SUBE Viajes', rules)).toBe(transporte);
  });

  it('returns null when nothing matches (left for manual review)', () => {
    const rules = [rule(RuleMatchType.CONTAINS, 'netflix', 0, servicios)];
    expect(service.categorize('Transferencia recibida', rules)).toBeNull();
  });

  it('a broken user regex never throws, just skips', () => {
    const rules = [
      rule(RuleMatchType.REGEX, '([invalid', 10, servicios),
      rule(RuleMatchType.CONTAINS, 'sube', 0, transporte),
    ];
    expect(service.categorize('Pago SUBE', rules)).toBe(transporte);
  });
});
