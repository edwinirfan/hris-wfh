import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { PHOTO_MIN_HEIGHT, PHOTO_MIN_WIDTH } from '@app/common';

export interface ProcessedImage {
  buffer: Buffer;
  sha256: string;
  width: number;
  height: number;
  size: number;
  mime: 'image/jpeg';
}

type ImageFormat = 'jpeg' | 'png' | 'webp';

/** Deteksi format dari magic bytes — tidak percaya ekstensi file maupun header Content-Type */
export function detectImageFormat(buffer: Buffer): ImageFormat | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

@Injectable()
export class ImageService {
  /**
   * 1. magic bytes harus JPEG/PNG/WebP
   * 2. harus bisa di-decode utuh oleh sharp dan formatnya cocok dengan magic bytes
   * 3. dimensi minimal 320×240 (orientasi bebas)
   * 4. re-encode ke JPEG: menerapkan orientasi EXIF lalu membuang seluruh metadata
   *    (termasuk GPS) dan menetralkan payload tersembunyi (polyglot file)
   */
  async process(input: Buffer | undefined): Promise<ProcessedImage> {
    if (!input?.length) throw new BadRequestException('Foto wajib diunggah');

    const format = detectImageFormat(input);
    if (!format) throw new BadRequestException('File bukan gambar yang valid (hanya JPEG, PNG, atau WebP)');

    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 }).metadata();
    } catch {
      throw new BadRequestException('File gambar rusak atau tidak dapat dibaca');
    }
    if (metadata.format !== format) throw new BadRequestException('Isi file tidak sesuai dengan format gambarnya');

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const minSide = Math.min(width, height);
    const maxSide = Math.max(width, height);
    if (minSide < PHOTO_MIN_HEIGHT || maxSide < PHOTO_MIN_WIDTH) {
      throw new BadRequestException(`Resolusi foto minimal ${PHOTO_MIN_WIDTH}×${PHOTO_MIN_HEIGHT} piksel`);
    }

    const { data, info } = await sharp(input, { failOn: 'error' })
      .rotate()
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      // hash file ASLI → file yang sama persis tidak bisa dipakai absen dua kali
      sha256: createHash('sha256').update(input).digest('hex'),
      width: info.width,
      height: info.height,
      size: info.size,
      mime: 'image/jpeg',
    };
  }
}
