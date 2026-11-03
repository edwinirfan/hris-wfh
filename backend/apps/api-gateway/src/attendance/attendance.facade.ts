import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ATTENDANCE_SERVICE,
  AttendanceCaptureDto,
  AttendancePatterns,
  AttendanceType,
  JwtPayload,
  sendRpc,
} from '@app/common';
import { ImageService } from '../files/image.service';
import { SignedUrlService } from '../files/signed-url.service';
import { buildPhotoKey, StorageService } from '../files/storage.service';

@Injectable()
export class AttendanceFacade {
  constructor(
    @Inject(ATTENDANCE_SERVICE) private readonly attendanceClient: ClientProxy,
    private readonly images: ImageService,
    private readonly storage: StorageService,
    private readonly signer: SignedUrlService,
  ) {}

  /**
   * Alur check-in/check-out:
   *   1. validasi & re-encode foto (lokal, tanpa I/O jaringan)
   *   2. precheck ke attendance-service (aktif? sudah check-in?) — sebelum menyimpan foto
   *   3. simpan foto ke storage
   *   4. catat absensi; bila gagal → hapus foto (kompensasi) agar tidak ada file yatim
   */
  async record(
    type: AttendanceType,
    file: Express.Multer.File | undefined,
    capture: AttendanceCaptureDto,
    user: JwtPayload,
    client: { ip?: string; userAgent?: string },
  ) {
    const image = await this.images.process(file?.buffer);
    await sendRpc(this.attendanceClient, AttendancePatterns.PRECHECK, { employeeId: user.employeeId, type });

    const key = buildPhotoKey(user.employeeId, type);
    await this.storage.put(key, image.buffer, image.mime);

    try {
      const detail = await sendRpc(
        this.attendanceClient,
        type === AttendanceType.CHECK_IN ? AttendancePatterns.CHECK_IN : AttendancePatterns.CHECK_OUT,
        {
          employeeId: user.employeeId,
          photo: {
            key,
            sha256: image.sha256,
            size: image.size,
            width: image.width,
            height: image.height,
            mime: image.mime,
          },
          capture,
          ...client,
        },
      );
      return this.signer.decorate(detail);
    } catch (error) {
      await this.storage.deleteQuietly(key);
      throw error;
    }
  }

  /** Kirim request ke attendance-service lalu ubah photo key → URL bertanda tangan */
  async query<T>(pattern: string, payload: unknown): Promise<T> {
    return this.signer.decorate(await sendRpc<T>(this.attendanceClient, pattern, payload));
  }
}
