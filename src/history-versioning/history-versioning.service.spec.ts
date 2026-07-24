import { DataSource } from 'typeorm';
import { HistoryVersioningService } from './history-versioning.service';

describe('HistoryVersioningService', () => {
  it('retires the current version before creating its replacement in one transaction', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    const where = jest.fn().mockReturnValue({ execute });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const create = jest.fn((value: Record<string, unknown>) => value);
    const save = jest.fn().mockResolvedValue({ id: 'replacement' });
    const manager = {
      getRepository: () => ({
        createQueryBuilder: () => ({ update }),
        create,
        save,
      }),
    };
    const transaction = jest.fn(
      (work: (value: typeof manager) => Promise<unknown>): Promise<unknown> =>
        work(manager),
    );
    const service = new HistoryVersioningService({
      transaction,
    } as unknown as DataSource);

    await expect(
      service.replaceCurrent(
        class Record {
          isCurrent = true;
        },
        { patientId: 'patient-id', isCurrent: true } as never,
        { patientId: 'patient-id' } as never,
      ),
    ).resolves.toEqual({ id: 'replacement' });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ isCurrent: false });
    expect(where).toHaveBeenCalledWith({
      patientId: 'patient-id',
      isCurrent: true,
    });
    expect(create).toHaveBeenCalledWith({
      patientId: 'patient-id',
      isCurrent: true,
    });
  });
});
