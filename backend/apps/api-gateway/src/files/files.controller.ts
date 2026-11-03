import { Controller, ForbiddenException, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/decorators';
import { SignedUrlService } from './signed-url.service';
import { StorageService } from './storage.service';

@ApiExcludeController()
@Controller('files')
export class FilesController {
  constructor(
    private readonly signer: SignedUrlService,
    private readonly storage: StorageService,
  ) {}

  /** Akses dijamin oleh tanda tangan URL, bukan oleh header Authorization (dipakai langsung di <img src>) */
  @Public()
  @SkipThrottle()
  @Get(':token')
  async download(
    @Param('token') token: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const key = this.signer.verify(token, exp, sig);
    if (!key) throw new ForbiddenException('Tautan foto tidak valid atau sudah kedaluwarsa');

    const stream = await this.storage.get(key);
    response.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=300',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(stream);
  }
}
