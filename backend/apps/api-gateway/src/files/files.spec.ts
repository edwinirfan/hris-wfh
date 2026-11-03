import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { detectImageFormat, ImageService } from './image.service';
import { SignedUrlService } from './signed-url.service';
import { buildPhotoKey, isValidPhotoKey } from './storage.service';
import { AttendanceType } from '@app/common';

const noise = (width: number, height: number) => {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7919) % 256;
  return sharp(raw, { raw: { width, height, channels: 3 } });
};

describe('ImageService', () => {
  const service = new ImageService();

  it('mendeteksi format dari magic bytes', async () => {
    expect(detectImageFormat(await noise(10, 10).jpeg().toBuffer())).toBe('jpeg');
    expect(detectImageFormat(await noise(10, 10).png().toBuffer())).toBe('png');
    expect(detectImageFormat(await noise(10, 10).webp().toBuffer())).toBe('webp');
    expect(detectImageFormat(Buffer.from('GIF89a........'))).toBeNull();
  });

  it('menolak file teks yang berekstensi .jpg', async () => {
    await expect(service.process(Buffer.from('bukan gambar sama sekali'))).rejects.toThrow(BadRequestException);
  });

  it('menolak JPEG terpotong / rusak', async () => {
    const jpeg = await noise(640, 480).jpeg().toBuffer();
    await expect(service.process(jpeg.subarray(0, 200))).rejects.toThrow(BadRequestException);
  });

  it('menolak resolusi di bawah 320×240', async () => {
    await expect(service.process(await noise(300, 200).jpeg().toBuffer())).rejects.toThrow('Resolusi foto minimal');
  });

  it('re-encode ke JPEG, buang metadata EXIF/GPS, dan mengecilkan ke maks 1280px', async () => {
    const input = await noise(2000, 1500)
      .png()
      .withExif({ IFD0: { Copyright: 'rahasia' }, IFD3: { GPSLatitudeRef: 'S' } })
      .toBuffer();
    const result = await service.process(input);
    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();
    expect(Math.max(result.width, result.height)).toBe(1280);
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('SignedUrlService', () => {
  const config = {
    getOrThrow: (key: string) =>
      ({ FILE_URL_SECRET: 'x'.repeat(40), FILE_URL_TTL_SECONDS: 300, PUBLIC_BASE_URL: 'http://api.test/' })[key],
  };
  const signer = new SignedUrlService(config as never);
  const key = buildPhotoKey('e0000000-0000-4000-8000-000000000002', AttendanceType.CHECK_IN);

  const parse = (url: string) => {
    const parsed = new URL(url);
    return {
      token: parsed.pathname.split('/').pop()!,
      exp: parsed.searchParams.get('exp')!,
      sig: parsed.searchParams.get('sig')!,
    };
  };

  it('URL yang ditandatangani dapat diverifikasi kembali ke object key', () => {
    const { token, exp, sig } = parse(signer.sign(key));
    expect(signer.verify(token, exp, sig)).toBe(key);
    expect(isValidPhotoKey(key)).toBe(true);
  });

  it('signature atau masa berlaku yang diubah ditolak', () => {
    const { token, exp, sig } = parse(signer.sign(key));
    expect(signer.verify(token, String(Number(exp) + 1000), sig)).toBeNull();
    expect(signer.verify(token, exp, sig.replace(/.$/, sig.endsWith('0') ? '1' : '0'))).toBeNull();
    expect(signer.verify(Buffer.from('../../etc/passwd').toString('base64url'), exp, sig)).toBeNull();
  });

  it('URL kedaluwarsa ditolak', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-02T00:00:00Z'));
    const { token, exp, sig } = parse(signer.sign(key));
    jest.setSystemTime(new Date('2026-11-02T00:05:01Z'));
    expect(signer.verify(token, exp, sig)).toBeNull();
    jest.useRealTimers();
  });

  it('decorate mengganti semua *PhotoKey bersarang menjadi *PhotoUrl', () => {
    const result = signer.decorate({
      items: [{ checkInPhotoKey: key, checkOutPhotoKey: null, logs: [{ photoKey: key, type: 'CHECK_IN' }] }],
    });
    const item = result.items[0] as Record<string, unknown>;
    expect(item.checkInPhotoUrl).toMatch(/^http:\/\/api\.test\/api\/v1\/files\//);
    expect(item.checkOutPhotoUrl).toBeNull();
    expect(item).not.toHaveProperty('checkInPhotoKey');
    expect((item.logs as Record<string, unknown>[])[0]).toHaveProperty('photoUrl');
  });
});
