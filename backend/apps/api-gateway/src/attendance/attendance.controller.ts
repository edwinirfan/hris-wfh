import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import type { JwtPayload } from '@app/common';
import {
  AttendanceCaptureDto,
  AttendanceHistoryQueryDto,
  AttendancePatterns,
  AttendanceQueryDto,
  AttendanceType,
  DateQueryDto,
  PHOTO_MAX_BYTES,
  Role,
  StatsQueryDto,
} from '@app/common';
import { clientInfo } from '../common/client-info';
import { CurrentUser, ResponseMessage, Roles } from '../common/decorators';
import { AttendanceFacade } from './attendance.facade';

const photoUpload = FileInterceptor('photo', {
  storage: memoryStorage(),
  limits: { fileSize: PHOTO_MAX_BYTES, files: 1, fields: 20, fieldSize: 1024 },
});

const captureBodySchema = {
  schema: {
    type: 'object',
    required: ['photo', 'faceCount', 'faceConfidence', 'livenessPassed'],
    properties: {
      photo: { type: 'string', format: 'binary', description: 'JPEG/PNG/WebP, maks 2 MB, min 320×240' },
      faceCount: { type: 'integer', example: 1 },
      faceConfidence: { type: 'number', example: 0.93 },
      livenessPassed: { type: 'boolean', example: true },
      clientTime: { type: 'string', format: 'date-time' },
      latitude: { type: 'number', example: -6.2 },
      longitude: { type: 'number', example: 106.816666 },
      accuracy: { type: 'number', example: 25 },
      note: { type: 'string', maxLength: 255 },
    },
  },
};

/** employeeId SELALU diambil dari JWT, tidak pernah dari body/query (mencegah IDOR) */
@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly facade: AttendanceFacade) {}

  /* ---------- Karyawan (data milik sendiri) ---------- */

  @Get('schedule')
  schedule() {
    return this.facade.query(AttendancePatterns.SCHEDULE, {});
  }

  @Get('today')
  today(@CurrentUser() user: JwtPayload) {
    return this.facade.query(AttendancePatterns.TODAY, { employeeId: user.employeeId });
  }

  @Post('check-in')
  @UseInterceptors(photoUpload)
  @ApiConsumes('multipart/form-data')
  @ApiBody(captureBodySchema)
  @ResponseMessage('Check-in berhasil')
  checkIn(
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() capture: AttendanceCaptureDto,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request,
  ) {
    return this.facade.record(AttendanceType.CHECK_IN, photo, capture, user, clientInfo(request));
  }

  @Post('check-out')
  @UseInterceptors(photoUpload)
  @ApiConsumes('multipart/form-data')
  @ApiBody(captureBodySchema)
  @ResponseMessage('Check-out berhasil')
  checkOut(
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Body() capture: AttendanceCaptureDto,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request,
  ) {
    return this.facade.record(AttendanceType.CHECK_OUT, photo, capture, user, clientInfo(request));
  }

  @Get('me')
  myHistory(@Query() query: AttendanceHistoryQueryDto, @CurrentUser() user: JwtPayload) {
    return this.facade.query(AttendancePatterns.MY_HISTORY, { employeeId: user.employeeId, query });
  }

  /* ---------- Monitoring HR (view-only: sengaja tidak ada PUT/PATCH/DELETE) ---------- */

  @Get()
  @Roles(Role.ADMIN_HR)
  findAll(@Query() query: AttendanceQueryDto) {
    return this.facade.query(AttendancePatterns.FIND_ALL, query);
  }

  @Get('summary')
  @Roles(Role.ADMIN_HR)
  summary(@Query() query: DateQueryDto) {
    return this.facade.query(AttendancePatterns.SUMMARY, query);
  }

  @Get('stats')
  @Roles(Role.ADMIN_HR)
  stats(@Query() query: StatsQueryDto) {
    return this.facade.query(AttendancePatterns.STATS, query);
  }

  @Get('absentees')
  @Roles(Role.ADMIN_HR)
  absentees(@Query() query: DateQueryDto) {
    return this.facade.query(AttendancePatterns.ABSENTEES, query);
  }

  /** HR: semua data; karyawan: hanya miliknya (dicek di attendance-service) */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.facade.query(AttendancePatterns.FIND_ONE, {
      id,
      requesterRole: user.role,
      requesterEmployeeId: user.employeeId,
    });
  }
}
