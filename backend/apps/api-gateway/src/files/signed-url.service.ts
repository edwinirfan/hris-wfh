import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * URL foto bertanda tangan (HMAC-SHA256) dengan masa berlaku.
 * Bucket tetap privat; gateway hanya membuat URL setelah memastikan peminta berhak
 * (pemilik data atau ADMIN_HR), lalu URL itu sendiri yang menjadi izin akses sementara.
 */
@Injectable()
export class SignedUrlService {
  private readonly secret: string;
  private readonly ttlSeconds: number;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('FILE_URL_SECRET');
    this.ttlSeconds = config.getOrThrow<number>('FILE_URL_TTL_SECONDS');
    this.baseUrl = config.getOrThrow<string>('PUBLIC_BASE_URL').replace(/\/$/, '');
  }

  sign(key: string): string {
    const exp = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    const token = Buffer.from(key).toString('base64url');
    return `${this.baseUrl}/api/v1/files/${token}?exp=${exp}&sig=${this.signature(key, exp)}`;
  }

  /** @returns object key bila tanda tangan valid & belum kedaluwarsa, selain itu null */
  verify(token: string, exp: string | undefined, sig: string | undefined): string | null {
    if (!exp || !sig || !/^\d+$/.test(exp) || !/^[a-f0-9]{64}$/.test(sig)) return null;
    if (Number(exp) < Math.floor(Date.now() / 1000)) return null;

    const key = Buffer.from(token, 'base64url').toString('utf8');
    const expected = Buffer.from(this.signature(key, Number(exp)), 'hex');
    const given = Buffer.from(sig, 'hex');
    return expected.length === given.length && timingSafeEqual(expected, given) ? key : null;
  }

  /** Ganti setiap field `photoKey` / `*PhotoKey` menjadi `photoUrl` / `*PhotoUrl` bertanda tangan */
  decorate<T>(value: T): T {
    if (Array.isArray(value)) return value.map((item: unknown) => this.decorate(item)) as T;
    if (value === null || typeof value !== 'object') return value;

    const result: Record<string, unknown> = {};
    for (const [field, fieldValue] of Object.entries(value as Record<string, unknown>)) {
      if (field === 'photoKey' || field.endsWith('PhotoKey')) {
        result[field.replace(/Key$/, 'Url')] = typeof fieldValue === 'string' ? this.sign(fieldValue) : null;
      } else {
        result[field] = this.decorate(fieldValue);
      }
    }
    return result as T;
  }

  private signature(key: string, exp: number): string {
    return createHmac('sha256', this.secret).update(`${key}:${exp}`).digest('hex');
  }
}
