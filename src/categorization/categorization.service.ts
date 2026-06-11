import { Injectable, Logger } from '@nestjs/common';
import { Category } from '../categories/entities/category.entity';
import { Rule } from '../rules/entities/rule.entity';
import { RuleMatchType } from '../rules/enums/rule-match-type.enum';

/**
 * Pure rules engine, separate from the Rules CRUD so both the import pipeline
 * and manual entry can reuse it. No repositories here — callers pass the rules
 * in; this keeps the logic synchronous and trivially testable.
 */
@Injectable()
export class CategorizationService {
  private readonly logger = new Logger(CategorizationService.name);

  /**
   * Returns the category of the highest-priority rule matching the text, or
   * null (leave uncategorized for manual review). Ties break by priority desc.
   */
  categorize(
    text: string,
    rules: Pick<Rule, 'matchType' | 'pattern' | 'priority' | 'category'>[],
  ): Category | null {
    const haystack = text.toLowerCase();
    const sorted = [...rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sorted) {
      if (this.matches(haystack, rule)) {
        return rule.category;
      }
    }
    return null;
  }

  private matches(
    haystack: string,
    rule: Pick<Rule, 'matchType' | 'pattern'>,
  ): boolean {
    const needle = rule.pattern.toLowerCase();
    switch (rule.matchType) {
      case RuleMatchType.CONTAINS:
        return haystack.includes(needle);
      case RuleMatchType.STARTS_WITH:
        return haystack.startsWith(needle);
      case RuleMatchType.REGEX:
        try {
          return new RegExp(rule.pattern, 'i').test(haystack);
        } catch {
          // A bad user-defined regex must never break an import.
          this.logger.warn(`Invalid rule regex skipped: ${rule.pattern}`);
          return false;
        }
      default:
        return false;
    }
  }
}
