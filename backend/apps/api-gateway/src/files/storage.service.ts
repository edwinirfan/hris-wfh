import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import * as Minio from 'minio';
import { dirname, resolve, sep } from 'path';
import { Readable } from 'stream';
import { APP_TIMEZONE, AttendanceType, dayjs } from '@app/common';

const KEY_PATTERN = /^attendance\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]{36}\/(check_in|check_out)-[0-9a-f-]{36}\.jpg$/;

export function buildPhotoKey(employeeId: string, type: AttendanceType, now = new Date()): string {
  const datePath = dayjs(now).tz(APP_TIMEZONE).format('YYYY/MM/DD');
  return `attendance/${datePath}/${employeeId}/${type.toLowerCase()}-${randomUUID()}.jpg`;
}

export function isValidPhotoKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

interface StorageDriver {
  init(): Promise<void>;
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  ping(): Promise<void>;
}

class LocalStorageDriver implements StorageDriver {
  private readonly root: string;

  constructor(dir: string) {
    this.root = resolve(dir);
  }

  async init() {
    await fs.mkdir(this.root, { recursive: true });
  }

  /** Cegah path traversal: hasil resolve wajib tetap di dalam root */
  private path(key: string): string {
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + sep)) throw new NotFoundException('Foto tidak ditemukan');
    return full;
  }

  async put(key: string, data: Buffer) {
    const target = this.path(key);
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.writeFile(target, data, { flag: 'wx' });
  }

  async get(key: string) {
    const target = this.path(key);
    try {
      await fs.access(target);
    } catch {
      throw new NotFoundException('Foto tidak ditemukan');
    }
    return createReadStream(target);
  }

  async delete(key: string) {
    await fs.rm(this.path(key), { force: true });
  }

  async ping() {
    await fs.access(this.root);
  }
}

class S3StorageDriver implements StorageDriver {
  constructor(
    private readonly client: Minio.Client,
    private readonly bucket: string,
  ) {}

  async init() {
    if (!(await this.client.bucketExists(this.bucket))) await this.client.makeBucket(this.bucket);
  }

  async put(key: string, data: Buffer, contentType: string) {
    await this.client.putObject(this.bucket, key, data, data.length, { 'Content-Type': contentType });
  }

  async get(key: string) {
    try {
      return await this.client.getObject(this.bucket, key);
    } catch {
      throw new NotFoundException('Foto tidak ditemukan');
    }
  }

  async delete(key: string) {
    await this.client.removeObject(this.bucket, key);
  }

  async ping() {
    await this.client.bucketExists(this.bucket);
  }
}

/** Abstraksi penyimpanan foto: S3-compatible (RustFS/MinIO/AWS S3) via SDK minio untuk Docker, disk lokal untuk dev tanpa Docker */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: StorageDriver;

  constructor(config: ConfigService) {
    if (config.get<string>('STORAGE_DRIVER') === 's3') {
      const client = new Minio.Client({
        endPoint: config.getOrThrow<string>('S3_ENDPOINT'),
        port: config.getOrThrow<number>('S3_PORT'),
        useSSL: config.get<boolean>('S3_USE_SSL') ?? false,
        accessKey: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      });
      this.driver = new S3StorageDriver(client, config.getOrThrow<string>('S3_BUCKET'));
    } else {
      this.driver = new LocalStorageDriver(config.getOrThrow<string>('STORAGE_LOCAL_DIR'));
    }
  }

  /** Storage bisa belum siap saat container gateway start → coba ulang beberapa kali */
  async onModuleInit() {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.driver.init();
        this.logger.log(`Storage driver: ${this.driver.constructor.name}`);
        return;
      } catch (error) {
        if (attempt >= 10) throw error;
        this.logger.warn(`Storage belum siap (percobaan ${attempt}/10), mencoba lagi...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  put(key: string, data: Buffer, contentType: string) {
    return this.driver.put(key, data, contentType);
  }

  get(key: string) {
    if (!isValidPhotoKey(key)) throw new NotFoundException('Foto tidak ditemukan');
    return this.driver.get(key);
  }

  async deleteQuietly(key: string) {
    try {
      await this.driver.delete(key);
    } catch (error) {
      this.logger.error(`Gagal menghapus foto ${key}`, error instanceof Error ? error.stack : String(error));
    }
  }

  ping() {
    return this.driver.ping();
  }
}
