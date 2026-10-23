import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PatientSummaryRateLimiterService } from './patient-summary-rate-limiter.service';

describe('PatientSummaryRateLimiterService', () => {
  it('locks and consumes the shared bucket when quota remains', async () => {
    const bucket = {
      windowStartedAt: new Date('2026-01-01T00:00:00Z'),
      usedCount: 0,
    };
    const getOneOrFail = jest.fn().mockResolvedValue(bucket);
    const setLock = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({ getOneOrFail }),
    });
    const createQueryBuilder = jest.fn().mockReturnValue({ setLock });
    const save = jest.fn().mockResolvedValue(bucket);
    const getRepository = jest
      .fn()
      .mockReturnValue({ createQueryBuilder, save });
    const transaction = jest
      .fn()
      .mockImplementation((work: (manager: unknown) => Promise<boolean>) =>
        work({ getRepository }),
      );
    const service = new PatientSummaryRateLimiterService(
      { transaction } as unknown as DataSource,
      {
        getOrThrow: jest.fn().mockReturnValueOnce(2).mockReturnValueOnce(60),
      } as unknown as ConfigService,
    );

    await expect(
      service.tryAcquire(new Date('2026-01-01T00:00:01Z')),
    ).resolves.toBe(true);

    expect(setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(bucket.usedCount).toBe(1);
    expect(save).toHaveBeenCalledWith(bucket);
  });

  it('does not consume a token after the shared quota is exhausted', async () => {
    const bucket = {
      windowStartedAt: new Date('2026-01-01T00:00:00Z'),
      usedCount: 2,
    };
    const getOneOrFail = jest.fn().mockResolvedValue(bucket);
    const createQueryBuilder = jest.fn().mockReturnValue({
      setLock: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({ getOneOrFail }),
      }),
    });
    const save = jest.fn();
    const transaction = jest
      .fn()
      .mockImplementation((work: (manager: unknown) => Promise<boolean>) =>
        work({
          getRepository: () => ({ createQueryBuilder, save }),
        }),
      );
    const service = new PatientSummaryRateLimiterService(
      { transaction } as unknown as DataSource,
      {
        getOrThrow: jest.fn().mockReturnValueOnce(2).mockReturnValueOnce(60),
      } as unknown as ConfigService,
    );

    await expect(
      service.tryAcquire(new Date('2026-01-01T00:00:01Z')),
    ).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });
});
