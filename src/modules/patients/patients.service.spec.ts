import { ConflictException, NotFoundException } from '@nestjs/common';
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
    // assertPatientRole only reads the patients repository. The other 14
    // constructor dependencies are never reached, so they are stubbed
    // wholesale rather than imported one by one just to be discarded.
    const dependencies = [
      { findOne },
      ...Array.from({ length: 14 }, () => ({})),
    ] as unknown as ConstructorParameters<typeof PatientsService>;
    service = new PatientsService(...dependencies);
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
