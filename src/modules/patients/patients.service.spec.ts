import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PatientDetails } from '../../database/entities/patient-details.entity';
import { PatientRole } from '../../database/entities/patient-role.enum';
import { PatientStatus } from '../../database/entities/patient-status.enum';
import { Patient } from '../../database/entities/patient.entity';
import { PatientsService } from './patients.service';

describe('PatientsService.assertPatientRole', () => {
  const patient = {
    id: 'patient-id',
    role: PatientRole.PATIENT,
    status: PatientStatus.ENROLLED,
  } as Patient;
  let findOne: jest.Mock;
  let service: PatientsService;

  beforeEach(() => {
    findOne = jest.fn();
    service = new PatientsService(
      { findOne } as unknown as Repository<Patient>,
      {} as Repository<PatientDetails>,
    );
  });

  it('returns a patient with the expected role and status', async () => {
    findOne.mockResolvedValue(patient);
    await expect(
      service.assertPatientRole(
        patient.id,
        PatientRole.PATIENT,
        PatientStatus.ENROLLED,
      ),
    ).resolves.toBe(patient);
  });

  it('rejects a different role', async () => {
    findOne.mockResolvedValue(patient);
    await expect(
      service.assertPatientRole(patient.id, PatientRole.COMPANION),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a different status', async () => {
    findOne.mockResolvedValue(patient);
    await expect(
      service.assertPatientRole(
        patient.id,
        PatientRole.PATIENT,
        PatientStatus.UNENROLLED,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a missing patient', async () => {
    findOne.mockResolvedValue(null);
    await expect(
      service.assertPatientRole(patient.id, PatientRole.PATIENT),
    ).rejects.toThrow(NotFoundException);
  });
});
