const AR_TIME_ZONE = 'America/Argentina/Buenos_Aires';

/**
 * Today's date in Argentina as `YYYY-MM-DD`. Using the AR time zone (UTC-3)
 * avoids the off-by-one that a naive UTC date would cause late in the evening.
 */
export function todayInArgentina(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** `2026-06-11` -> `2026/06/11` for ArgentinaDatos' path-style date. */
export function toSlashDate(isoDate: string): string {
  return isoDate.replace(/-/g, '/');
}
