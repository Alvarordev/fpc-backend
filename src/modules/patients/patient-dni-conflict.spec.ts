import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { PatientsService } from './patients.service';
import {
  PATIENT_DNI_EXISTS,
  savePatientOrDniConflict,
} from './patient-dni-conflict';

function conflictCode(error: unknown) {
  expect(error).toBeInstanceOf(ConflictException);
  return (error as ConflictException).getResponse();
}

describe('savePatientOrDniConflict', () => {
  it('rejects a DNI that already exists before insert', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue({ id: 'existing' }),
      create: jest.fn(),
      save: jest.fn(),
    };

    await expect(
      savePatientOrDniConflict(repository as never, {
        fullName: 'Nuria',
        dni: '74778511',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('maps a unique-constraint race to PATIENT_DNI_EXISTS', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => input),
      save: jest.fn().mockRejectedValue(
        new QueryFailedError('INSERT', [], {
          code: '23505',
          constraint: 'UQ_b09e471222674eb27a9ed8881b6',
        }),
      ),
    };

    try {
      await savePatientOrDniConflict(repository as never, {
        fullName: 'Nuria',
        dni: ' 74778511 ',
      });
      throw new Error('expected conflict');
    } catch (error) {
      expect(conflictCode(error)).toEqual(
        expect.objectContaining({
          code: PATIENT_DNI_EXISTS,
          message: 'Ya existe un paciente con este DNI.',
        }),
      );
    }
  });

  it('does not treat a blank DNI as a duplicate', async () => {
    const repository = {
      findOne: jest.fn(),
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => input),
    };

    await savePatientOrDniConflict(repository as never, {
      fullName: 'Sin documento',
      dni: '  ',
    });

    expect(repository.findOne).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ dni: null }),
    );
  });
});

describe('PatientsService.create duplicate DNI', () => {
  it('returns the DNI conflict from the patients repository', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue({ id: 'existing' }),
      create: jest.fn(),
      save: jest.fn(),
    };
    const dependencies = [
      repository,
      ...Array.from({ length: 20 }, () => ({})),
    ] as unknown as ConstructorParameters<typeof PatientsService>;
    const service = new PatientsService(...dependencies);
    const manager = { getRepository: () => repository };

    await expect(
      service.create(
        { fullName: 'Nuria', dni: '74778511', primaryPhone: '948074088' },
        manager as never,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
