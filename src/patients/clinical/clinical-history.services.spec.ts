import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { PatientDiagnosis } from '../entities/patient-diagnosis.entity';
import { PatientInsurance } from '../entities/patient-insurance.entity';
import { PatientMedicalAppointment } from '../entities/patient-medical-appointment.entity';
import { PatientTreatment } from '../entities/patient-treatment.entity';
import { HistoryVersioningService } from '../history-versioning/history-versioning.service';
import { PatientInsuranceService } from './insurance/patient-insurance.service';
import { PatientMedicalAppointmentsService } from './medical-appointments/patient-medical-appointments.service';
import { PatientTreatmentsService } from './treatments/patient-treatments.service';
import { PatientsService } from '../patients.service';
import { PatientSummaryInvalidationService } from '../../patient-summaries/patient-summary-invalidation.service';
import { N8nTransactionalDispatchService } from '../../webhooks/transactional-dispatch.service';

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
      insuranceType: 'SIS',
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

  it('rejects treatments that reference another patient diagnosis', async () => {
    const diagnoses = {
      findOne: jest.fn().mockResolvedValue({ patientId: 'other-patient' }),
    } as unknown as Repository<PatientDiagnosis>;
    (followUps.existsBy as jest.Mock).mockResolvedValue(true);
    const service = new PatientTreatmentsService(
      {} as Repository<PatientTreatment>,
      diagnoses,
      followUps,
      patients,
      versioning,
      invalidations,
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
