import { Injectable } from '@nestjs/common';

/** Sumber waktu server; di-mock di unit test untuk menguji batas jam/tanggal */
@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }
}
