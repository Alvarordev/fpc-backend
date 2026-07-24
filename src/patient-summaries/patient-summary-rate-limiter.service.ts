import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PatientSummaryRateLimit } from '../database/entities/patient-summary-rate-limit.entity';

const GEMINI_RATE_LIMIT_KEY = 'gemini';

@Injectable()
export class PatientSummaryRateLimiterService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async tryAcquire(now = new Date()): Promise<boolean> {
    const limit = this.config.getOrThrow<number>('PATIENT_SUMMARY_RATE_LIMIT');
    const windowMs =
      this.config.getOrThrow<number>(
        'PATIENT_SUMMARY_RATE_LIMIT_WINDOW_SECONDS',
      ) * 1000;

    return this.dataSource.transaction(async (manager) => {
      const bucket = await manager
        .getRepository(PatientSummaryRateLimit)
        .createQueryBuilder('bucket')
        .setLock('pessimistic_write')
        .where('bucket.key = :key', { key: GEMINI_RATE_LIMIT_KEY })
        .getOneOrFail();

      if (now.valueOf() - bucket.windowStartedAt.valueOf() >= windowMs) {
        bucket.windowStartedAt = now;
        bucket.usedCount = 0;
      }
      if (bucket.usedCount >= limit) return false;

      bucket.usedCount += 1;
      await manager.getRepository(PatientSummaryRateLimit).save(bucket);
      return true;
    });
  }
}
