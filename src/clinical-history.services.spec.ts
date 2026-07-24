import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Interaction } from './database/entities/interaction.entity';
import { PatientDiagnosis } from './patients/entities/patient-diagnosis.entity';
import { PatientInsurance } from './patients/entities/patient-insurance.entity';
import { PatientMedicalAppointment } from './patients/entities/patient-medical-appointment.entity';
import { PatientTreatment } from './patients/entities/patient-treatment.entity';
import { HistoryVersioningService } from './patients/history-versioning/history-versioning.service';
import { PatientInsuranceService } from './patients/clinical/insurance/patient-insurance.service';
import { PatientMedicalAppointmentsService } from './patients/clinical/medical-appointments/patient-medical-appointments.service';
import { PatientTreatmentsService } from './patients/clinical/treatments/patient-treatments.service';
import { PatientsService } from './patients/patients.service';

describe('clinical history services', () => {
  const patients = {
    assertPatientRole: jest.fn(),
  } as unknown as PatientsService;
  const replaceCurrent = jest.fn();
  const versioning = { replaceCurrent } as unknown as HistoryVersioningService;
  const interactions = {
    existsBy: jest.fn(),
  } as unknown as Repository<Interaction>;

  beforeEach(() => jest.resetAllMocks());

  it('versions insurance by patient', async () => {
    (interactions.existsBy as jest.Mock).mockResolvedValue(true);
    replaceCurrent.mockResolvedValue({
      id: 'insurance-id',
    });
    const service = new PatientInsuranceService(
      {} as Repository<PatientInsurance>,
      interactions,
      patients,
      versioning,
    );

    await service.create('patient-id', {
      interactionId: 'interaction-id',
      insuranceType: 'SIS',
    });

    expect(replaceCurrent).toHaveBeenCalledWith(
      PatientInsurance,
      { patientId: 'patient-id', isCurrent: true },
      {
        patientId: 'patient-id',
        interactionId: 'interaction-id',
        insuranceType: 'SIS',
      },
    );
  });

  it('versions appointments independently by specialty', async () => {
    (interactions.existsBy as jest.Mock).mockResolvedValue(true);
    const service = new PatientMedicalAppointmentsService(
      {} as Repository<PatientMedicalAppointment>,
      interactions,
      patients,
      versioning,
    );

    await service.create('patient-id', {
      interactionId: 'interaction-id',
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
    (interactions.existsBy as jest.Mock).mockResolvedValue(true);
    const service = new PatientTreatmentsService(
      {} as Repository<PatientTreatment>,
      diagnoses,
      interactions,
      patients,
      versioning,
    );

    await expect(
      service.create('patient-id', {
        interactionId: 'interaction-id',
        diagnosisId: 'diagnosis-id',
        treatmentType: 'Chemotherapy',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
