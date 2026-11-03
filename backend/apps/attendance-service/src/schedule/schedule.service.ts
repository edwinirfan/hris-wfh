import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { APP_TIMEZONE } from '@app/common';
import { WorkSchedule } from '../entities/work-schedule.entity';

export interface ScheduleView {
  workStart: string;
  workEnd: string;
  lateToleranceMinutes: number;
  timezone: string;
}

const FALLBACK: ScheduleView = {
  workStart: '08:00',
  workEnd: '17:00',
  lateToleranceMinutes: 15,
  timezone: APP_TIMEZONE,
};
const CACHE_TTL_MS = 60_000;

@Injectable()
export class ScheduleService {
  private cache?: { value: ScheduleView; expiresAt: number };

  constructor(@InjectRepository(WorkSchedule) private readonly schedules: Repository<WorkSchedule>) {}

  async getDefault(): Promise<ScheduleView> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.value;

    const schedule = await this.schedules.findOneBy({ isDefault: true });
    const value: ScheduleView = schedule
      ? {
          workStart: schedule.workStart.slice(0, 5),
          workEnd: schedule.workEnd.slice(0, 5),
          lateToleranceMinutes: schedule.lateToleranceMinutes,
          timezone: schedule.timezone,
        }
      : FALLBACK;
    this.cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  }
}
