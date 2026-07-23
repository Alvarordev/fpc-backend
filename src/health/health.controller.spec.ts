import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('checks the database connection', async () => {
    const healthCheck = jest
      .fn()
      .mockImplementation(async (indicators: Array<() => Promise<unknown>>) => {
        await Promise.all(indicators.map((indicator) => indicator()));
        return { status: 'ok' };
      });
    const health = {
      check: healthCheck,
    } as unknown as HealthCheckService;
    const pingCheck = jest
      .fn()
      .mockResolvedValue({ database: { status: 'up' } });
    const database = {
      pingCheck,
    } as unknown as TypeOrmHealthIndicator;
    const controller = new HealthController(health, database);

    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(pingCheck).toHaveBeenCalledWith('database');
  });
});
