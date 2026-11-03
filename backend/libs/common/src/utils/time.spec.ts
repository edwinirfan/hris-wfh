import { AttendanceStatus } from '../enums';
import { addDays, ageInYears, computeLateness, diffDays, localDateTime, minutesBetween, toLocalDate } from './time';

describe('time utils (Asia/Jakarta, UTC+7)', () => {
  describe('toLocalDate', () => {
    it('23:59:59 WIB masih dihitung tanggal yang sama', () => {
      expect(toLocalDate(new Date('2026-11-02T16:59:59.999Z'))).toBe('2026-11-02');
    });

    it('00:00 WIB sudah berganti tanggal walau di UTC masih tanggal sebelumnya', () => {
      expect(toLocalDate(new Date('2026-11-02T17:00:00.000Z'))).toBe('2026-11-03');
    });
  });

  describe('computeLateness (jam masuk 08:00, toleransi 15 menit)', () => {
    const at = (hhmm: string) => localDateTime('2026-11-02', hhmm);

    it.each([
      ['07:30', AttendanceStatus.PRESENT, 0],
      ['08:00', AttendanceStatus.PRESENT, 0],
      ['08:15', AttendanceStatus.PRESENT, 0],
      ['08:16', AttendanceStatus.LATE, 16],
      ['09:45', AttendanceStatus.LATE, 105],
    ])('check-in %s → %s (%i menit)', (time, status, lateMinutes) => {
      expect(computeLateness(at(time), '08:00', 15)).toEqual({ status, lateMinutes });
    });

    it('menerima format jam "HH:mm:ss" dari kolom TIME MySQL', () => {
      expect(computeLateness(at('08:20'), '08:00:00', 15).status).toBe(AttendanceStatus.LATE);
    });
  });

  it('minutesBetween membulatkan ke bawah dan tidak pernah negatif', () => {
    const start = new Date('2026-11-02T01:00:00Z');
    expect(minutesBetween(start, new Date('2026-11-02T09:29:59Z'))).toBe(509);
    expect(minutesBetween(start, new Date('2026-11-01T09:00:00Z'))).toBe(0);
  });

  it('addDays & diffDays melewati batas bulan', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(diffDays('2026-10-30', '2026-11-02')).toBe(3);
  });

  it('ageInYears menghitung ulang tahun dengan tepat', () => {
    const today = new Date('2026-11-02T00:00:00Z');
    expect(ageInYears('2009-11-02', today)).toBe(17);
    expect(ageInYears('2009-11-03', today)).toBe(16);
  });
});
