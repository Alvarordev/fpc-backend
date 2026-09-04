import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FollowUp } from '../../../database/entities/follow-up.entity';
import { HealthCenter } from '../../../database/entities/health-center.entity';
import { PatientDiagnosis } from '../../../database/entities/patient-diagnosis.entity';
import { PatientDiagnosisMode } from '../../../database/entities/patient-diagnosis-mode.enum';
import {
  InsuranceType,
  PatientInsurance,
} from '../../../database/entities/patient-insurance.entity';
import { PatientMedicalAppointment } from '../../../database/entities/patient-medical-appointment.entity';
import { PatientTreatment } from '../../../database/entities/patient-treatment.entity';
import { HistoryVersioningService } from '../history-versioning/history-versioning.service';
import { PatientInsuranceService } from './insurance/patient-insurance.service';
import { PatientMedicalAppointmentsService } from './medical-appointments/patient-medical-appointments.service';
import { PatientTreatmentsService } from './treatments/patient-treatments.service';
import { TreatmentMedicationsService } from './treatments/medications/treatment-medications.service';
import { PatientDiagnosesService } from './diagnoses/patient-diagnoses.service';
import { DurationUnit } from '../../../database/entities/duration-unit.enum';
import { WaitTimeSource } from '../../../database/entities/wait-time-source.enum';
import { PatientsService } from '../patients.service';
import { PatientSummaryInvalidationService } from '../../patient-summaries/patient-summary-invalidation.service';
import { N8nTransactionalDispatchService } from '../../../integrations/n8n/transactional-dispatch.service';
import { DataSource, EntityManager } from 'typeorm';

describe('clinical history services', () => {
  const patients = {
    assertPatientRole: jest.fn(),
  } as unknown as PatientsService;
  const replaceCurrent = jest.fn();
  const versioning = { replaceCurrent } as unknown as HistoryVersioningService;
  const invalidations = {
    markDirty: jest.fn(),
  } as unknown as PatientSummaryInvalidationService;
  const followUps = {
    existsBy: jest.fn(),
  } as unknown as Repository<FollowUp>;
  const healthCenters = {} as Repository<HealthCenter>;
  const webhooks = {
    enqueue: jest.fn(),
  } as unknown as N8nTransactionalDispatchService;

  beforeEach(() => {
    jest.resetAllMocks();
    (patients.assertPatientRole as jest.Mock).mockResolvedValue({
      fullName: 'Paciente de Prueba',
      dni: '12345678',
      primaryPhone: '999999999',
      email: null,
    });
  });

  it('versions insurance by patient', async () => {
    (followUps.existsBy as jest.Mock).mockResolvedValue(true);
    replaceCurrent.mockResolvedValue({
      id: 'insurance-id',
    });
    const service = new PatientInsuranceService(
      {} as Repository<PatientInsurance>,
      followUps,
      patients,
      versioning,
      invalidations,
    );

    await service.create('patient-id', {
      followUpId: 'followUp-id',
      insuranceType: InsuranceType.SIS,
    });

    expect(replaceCurrent).toHaveBeenCalledWith(
      PatientInsurance,
      { patientId: 'patient-id', isCurrent: true },
      {
        patientId: 'patient-id',
        followUpId: 'followUp-id',
        insuranceType: 'SIS',
      },
    );
  });

  it('versions appointments independently by specialty', async () => {
    (followUps.existsBy as jest.Mock).mockResolvedValue(true);
    replaceCurrent.mockResolvedValue({
      id: 'appointment-id',
      difficulties: null,
      appointmentDate: null,
      appointmentTime: null,
      specialty: 'ONCOLOGY',
    });
    const service = new PatientMedicalAppointmentsService(
      {} as Repository<PatientMedicalAppointment>,
      followUps,
      patients,
      versioning,
      invalidations,
      webhooks,
    );

    await service.create('patient-id', {
      followUpId: 'followUp-id',
      specialty: 'ONCOLOGY',
    });

    expect(replaceCurrent).toHaveBeenCalledWith(
      PatientMedicalAppointment,
      { patientId: 'patient-id', specialty: 'ONCOLOGY', isCurrent: true },
      expect.objectContaining({
        patientId: 'patient-id',
        specialty: 'ONCOLOGY',
      }),
    );
  });

  it('computes long diagnosis waits using months', async () => {
    (followUps.existsBy as jest.Mock).mockResolvedValue(true);
    replaceCurrent.mockResolvedValue({ id: 'diagnosis-id' });
    const diagnoses = {
      findOne: jest.fn().mockResolvedValue({
        id: 'replacement-id',
        patientId: 'patient-id',
        isCurrent: true,
      }),
    } as unknown as Repository<PatientDiagnosis>;
    const service = new PatientDiagnosesService(
      diagnoses,
      followUps,
      healthCenters,
      patients,
      versioning,
      invalidations,
    );

    await service.create('patient-id', {
      followUpId: 'followUp-id',
      diagnosis: 'Breast cancer',
      mode: PatientDiagnosisMode.REPLACE,
      replacementDiagnosisId: 'replacement-id',
      firstSymptomsDate: '2026-01-01',
      diagnosisDate: '2026-03-02',
    });

    const calls = replaceCurrent.mock.calls as unknown as Array<
      [
        unknown,
        unknown,
        {
          waitTimeSource: WaitTimeSource;
          waitTimeForDiagnosis: { valueMin: string; unit: string };
        },
      ]
    >;
    const values = calls[0][2];
    expect(values.waitTimeSource).toBe(WaitTimeSource.COMPUTED);
    expect(values.waitTimeForDiagnosis).toMatchObject({
      valueMin: '2',
      unit: 'MONTH',
    });
  });

  it('keeps a reported diagnosis wait when dates are also provided', async () => {
    (followUps.existsBy as jest.Mock).mockResolvedValue(true);
    replaceCurrent.mockResolvedValue({ id: 'diagnosis-id' });
    const diagnoses = {
      findOne: jest.fn().mockResolvedValue({
        id: 'replacement-id',
        patientId: 'patient-id',
        isCurrent: true,
      }),
    } as unknown as Repository<PatientDiagnosis>;
    const service = new PatientDiagnosesService(
      diagnoses,
      followUps,
      healthCenters,
      patients,
      versioning,
      invalidations,
    );

    await service.create('patient-id', {
      followUpId: 'followUp-id',
      diagnosis: 'Breast cancer',
      mode: PatientDiagnosisMode.REPLACE,
      replacementDiagnosisId: 'replacement-id',
      firstSymptomsDate: '2026-01-01',
      diagnosisDate: '2026-03-02',
      waitTimeForDiagnosis: { valueMin: 1.5, unit: DurationUnit.MONTH },
    });

    const calls = replaceCurrent.mock.calls as unknown as Array<
      [
        unknown,
        unknown,
        {
          waitTimeSource: WaitTimeSource;
          waitTimeForDiagnosis: { valueMin: string; unit: string };
        },
      ]
    >;
    const values = calls[0][2];
    expect(values.waitTimeSource).toBe(WaitTimeSource.REPORTED);
    expect(values.waitTimeForDiagnosis).toMatchObject({
      valueMin: '1.5',
      unit: 'MONTH',
    });
  });

  it('adds a parallel active diagnosis without retiring another diagnosis', async () => {
    (followUps.existsBy as jest.Mock).mockResolvedValue(true);
    const created = {
      id: 'diagnosis-id',
      patientId: 'patient-id',
      isCurrent: true,
    } as PatientDiagnosis;
    const create = jest.fn((value: PatientDiagnosis) => value);
    const save = jest.fn().mockResolvedValue(created);
    const diagnoses = {
      create,
      save,
    } as unknown as Repository<PatientDiagnosis>;
    const service = new PatientDiagnosesService(
      diagnoses,
      followUps,
      healthCenters,
      patients,
      versioning,
      invalidations,
    );

    await expect(
      service.create('patient-id', {
        followUpId: 'followUp-id',
        diagnosis: 'Breast cancer',
        mode: PatientDiagnosisMode.PARALLEL,
      }),
    ).resolves.toBe(created);

    expect(replaceCurrent).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-id',
        diagnosis: 'Breast cancer',
        isCurrent: true,
      }),
    );
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-id',
        diagnosis: 'Breast cancer',
        isCurrent: true,
      }),
    );
  });

  it('replaces only the selected active diagnosis', async () => {
    (followUps.existsBy as jest.Mock).mockResolvedValue(true);
    replaceCurrent.mockResolvedValue({ id: 'new-diagnosis-id' });
    const diagnoses = {
      findOne: jest.fn().mockResolvedValue({
        id: 'replacement-id',
        patientId: 'patient-id',
        isCurrent: true,
      }),
    } as unknown as Repository<PatientDiagnosis>;
    const service = new PatientDiagnosesService(
      diagnoses,
      followUps,
      healthCenters,
      patients,
      versioning,
      invalidations,
    );

    await service.create('patient-id', {
      followUpId: 'followUp-id',
      diagnosis: 'Updated diagnosis',
      mode: PatientDiagnosisMode.REPLACE,
      replacementDiagnosisId: 'replacement-id',
    });

    expect(replaceCurrent).toHaveBeenCalledWith(
      PatientDiagnosis,
      {
        id: 'replacement-id',
        patientId: 'patient-id',
        isCurrent: true,
      },
      expect.objectContaining({
        patientId: 'patient-id',
        diagnosis: 'Updated diagnosis',
      }),
    );
  });

  it('rejects an inactive replacement diagnosis', async () => {
    (followUps.existsBy as jest.Mock).mockResolvedValue(true);
    const diagnoses = {
      findOne: jest.fn().mockResolvedValue({
        id: 'replacement-id',
        patientId: 'patient-id',
        isCurrent: false,
      }),
    } as unknown as Repository<PatientDiagnosis>;
    const service = new PatientDiagnosesService(
      diagnoses,
      followUps,
      healthCenters,
      patients,
      versioning,
      invalidations,
    );

    await expect(
      service.create('patient-id', {
        followUpId: 'followUp-id',
        diagnosis: 'Updated diagnosis',
        mode: PatientDiagnosisMode.REPLACE,
        replacementDiagnosisId: 'replacement-id',
      }),
    ).rejects.toThrow(ConflictException);
    expect(replaceCurrent).not.toHaveBeenCalled();
  });

  it('rejects a replacement diagnosis belonging to another patient', async () => {
    (followUps.existsBy as jest.Mock).mockResolvedValue(true);
    const diagnoses = {
      findOne: jest.fn().mockResolvedValue({
        id: 'replacement-id',
        patientId: 'other-patient',
        isCurrent: true,
      }),
    } as unknown as Repository<PatientDiagnosis>;
    const service = new PatientDiagnosesService(
      diagnoses,
      followUps,
      healthCenters,
      patients,
      versioning,
      invalidations,
    );

    await expect(
      service.create('patient-id', {
        followUpId: 'followUp-id',
        diagnosis: 'Updated diagnosis',
        mode: PatientDiagnosisMode.REPLACE,
        replacementDiagnosisId: 'replacement-id',
      }),
    ).rejects.toThrow(ConflictException);
    expect(replaceCurrent).not.toHaveBeenCalled();
  });

  it('rejects treatments that reference another patient diagnosis', async () => {
    const diagnoses = {
      findOne: jest.fn().mockResolvedValue({ patientId: 'other-patient' }),
    } as unknown as Repository<PatientDiagnosis>;
    (followUps.existsBy as jest.Mock).mockResolvedValue(true);
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === PatientDiagnosis) return diagnoses;
        if (entity === FollowUp) return followUps;
        return {} as Repository<PatientTreatment>;
      }),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn((cb: (manager: EntityManager) => unknown) =>
        cb(manager),
      ),
    } as unknown as DataSource;
    const medications = {} as unknown as TreatmentMedicationsService;
    const service = new PatientTreatmentsService(
      {} as Repository<PatientTreatment>,
      diagnoses,
      followUps,
      patients,
      versioning,
      invalidations,
      medications,
      dataSource,
    );

    await expect(
      service.create('patient-id', {
        followUpId: 'followUp-id',
        diagnosisId: 'diagnosis-id',
        treatmentType: 'Chemotherapy',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
