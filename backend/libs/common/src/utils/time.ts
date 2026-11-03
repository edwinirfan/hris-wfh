import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { APP_TIMEZONE } from '../constants';
import { AttendanceStatus } from '../enums';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export { dayjs };

export const DATE_FORMAT = 'YYYY-MM-DD';

/** Tanggal kalender (YYYY-MM-DD) dari sebuah instant di zona waktu tertentu */
export function toLocalDate(instant: Date, tz = APP_TIMEZONE): string {
  return dayjs(instant).tz(tz).format(DATE_FORMAT);
}

export function isValidDateOnly(value: unknown): value is string {
  return typeof value === 'string' && dayjs(value, DATE_FORMAT, true).isValid();
}

export function addDays(date: string, days: number): string {
  return dayjs(date, DATE_FORMAT, true).add(days, 'day').format(DATE_FORMAT);
}

export function diffDays(from: string, to: string): number {
  return dayjs(to, DATE_FORMAT, true).diff(dayjs(from, DATE_FORMAT, true), 'day');
}

/** "08:00" / "08:00:00" pada tanggal lokal tertentu → instant */
export function localDateTime(date: string, time: string, tz = APP_TIMEZONE): Date {
  const hhmm = time.slice(0, 5);
  return dayjs.tz(`${date} ${hhmm}`, 'YYYY-MM-DD HH:mm', tz).toDate();
}

export interface LatenessResult {
  status: AttendanceStatus;
  lateMinutes: number;
}

/**
 * Terlambat jika check-in melewati jam masuk + toleransi.
 * late_minutes dihitung dari jam masuk (bukan dari batas toleransi).
 */
export function computeLateness(
  checkInAt: Date,
  workStart: string,
  toleranceMinutes: number,
  tz = APP_TIMEZONE,
): LatenessResult {
  const start = localDateTime(toLocalDate(checkInAt, tz), workStart, tz);
  const minutesAfterStart = Math.floor((checkInAt.getTime() - start.getTime()) / 60_000);
  if (minutesAfterStart > toleranceMinutes) {
    return { status: AttendanceStatus.LATE, lateMinutes: minutesAfterStart };
  }
  return { status: AttendanceStatus.PRESENT, lateMinutes: 0 };
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
}

export function ageInYears(birthDate: string, today = new Date()): number {
  return dayjs(today).diff(dayjs(birthDate, DATE_FORMAT, true), 'year');
}
