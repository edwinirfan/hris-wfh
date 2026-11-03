import { createHash, randomInt } from 'crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '@#$%&*!';

const pick = (chars: string) => chars[randomInt(chars.length)];

/**
 * Password sementara 12 karakter yang selalu memenuhi kebijakan password
 * (huruf besar, kecil, angka) + simbol. Karakter ambigu (0/O, 1/l/I) dihindari.
 */
export function generateTemporaryPassword(length = 12): string {
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
