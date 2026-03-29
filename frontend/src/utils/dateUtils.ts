import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/** Arizona / Phoenix — Mountain Standard Time, no DST (UTC-7 year-round) */
export const AZ_TZ = 'America/Phoenix';

/**
 * Parse `date` as UTC then display in Arizona (Phoenix, MST) timezone.
 * Use for all API timestamp fields (created_at, submitted_at, request_sent_at, etc.)
 */
export const fmtAZ = (
  date: string | Date | null | undefined,
  fmt: string
): string => (date ? dayjs.utc(date as string).tz(AZ_TZ).format(fmt) : '');

/**
 * Format a date-only field (stored as midnight UTC) without timezone shift.
 * Use for loan_date and similar calendar-date fields.
 */
export const fmtDate = (date: string | Date | null | undefined): string =>
  date ? dayjs.utc(date as string).format('MM/DD/YYYY') : '';

/** Current Arizona time formatted */
export const nowAZ = (fmt: string): string => dayjs().tz(AZ_TZ).format(fmt);

export { dayjs };
