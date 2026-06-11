/**
 * Pure helpers for Argentine statement formats: "1.054.628,11" numbers and
 * DD-MM-YYYY / DD/MM/YY dates. Kept I/O-free so they're trivially unit-testable.
 */

/**
 * "$ -1.054.628,11" | "1.234,56" | "-U$S 100,00" -> signed integer cents.
 * Returns null when the string isn't a parseable amount.
 */
export function arAmountToCents(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, '');
  if (!cleaned) {
    return null;
  }
  const negative = cleaned.startsWith('-') || raw.trim().endsWith('-');
  // Strip thousands dots, swap decimal comma for a dot.
  const normalized = cleaned
    .replace(/-/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const cents = Math.round(parseFloat(normalized) * 100);
  return negative ? -cents : cents;
}

/**
 * "01-05-2026" or "01/05/26" -> Date at noon UTC (noon avoids timezone
 * off-by-one when only the calendar date matters).
 */
export function arDateToDate(raw: string): Date | null {
  const match = /^(\d{2})[-/](\d{2})[-/](\d{2}|\d{4})$/.exec(raw.trim());
  if (!match) {
    return null;
  }
  const [, dd, mm, yy] = match;
  const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day, 12));
}

/** Lowercase + collapse whitespace, for stable fingerprints. */
export function normalizeDescription(description: string): string {
  return description.toLowerCase().replace(/\s+/g, ' ').trim();
}
