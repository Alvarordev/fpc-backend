import { Repository } from 'typeorm';
import { Enrollment } from '../../database/entities/enrollment.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { PatientDiagnosis } from '../../database/entities/patient-diagnosis.entity';
import { PatientInsurance } from '../../database/entities/patient-insurance.entity';
import { PatientMedicalAppointment } from '../../database/entities/patient-medical-appointment.entity';
import { PatientSisAffiliation } from '../../database/entities/patient-sis-affiliation.entity';
import { PatientSymptomReport } from '../../database/entities/patient-symptom-report.entity';
import { PatientTreatment } from '../../database/entities/patient-treatment.entity';
import { Patient } from '../../database/entities/patient.entity';
import { PatientAddress } from '../../database/entities/patient-address.entity';
import { HealthCenter } from '../../database/entities/health-center.entity';
import { PatientSummaryPayloadService } from './patient-summary-payload.service';

describe('PatientSummaryPayloadService', () => {
  it('excludes direct identifiers and contact details from Gemini input', async () => {
    const patient = {
      id: 'patient-id',
      dni: '12345678',
      email: 'patient@example.com',
      primaryPhone: '555-0000',
      birthDate: '1980-01-01',
      gender: 'F',
      role: 'PATIENT',
      status: 'ENROLLED',
      activityStatus: 'ACTIVE',
      details: {
        travelTimeToHospital: { label: '30m' },
        requiresTranslation: false,
        primaryHealthCenterId: null,
      },
    } as unknown as Patient;
    const find = jest.fn().mockResolvedValue([]);
    const findOneAddress = jest.fn().mockResolvedValue({
      district: 'Lima',
      department: 'LIMA',
    });
    const service = new PatientSummaryPayloadService(
      {
        findOne: jest.fn().mockResolvedValue(patient),
      } as unknown as Repository<Patient>,
      { find } as unknown as Repository<PatientDiagnosis>,
      { find } as unknown as Repository<PatientInsurance>,
      { find } as unknown as Repository<PatientTreatment>,
      { find } as unknown as Repository<PatientMedicalAppointment>,
      { find } as unknown as Repository<PatientSisAffiliation>,
      { find } as unknown as Repository<PatientSymptomReport>,
      { find } as unknown as Repository<Enrollment>,
      { find } as unknown as Repository<FollowUp>,
      { findOne: findOneAddress } as unknown as Repository<PatientAddress>,
      {
        findOneBy: jest.fn().mockResolvedValue(null),
      } as unknown as Repository<HealthCenter>,
    );

    const prompt = await service.buildPrompt('patient-id');

    expect(prompt).not.toContain('12345678');
    expect(prompt).not.toContain('patient@example.com');
    expect(prompt).not.toContain('555-0000');
    expect(prompt).not.toContain('Secret address');
    expect(prompt).toContain('Lima');
  });

  it('includes medical appointments and difficulties in the prompt', async () => {
    const patient = {
      id: 'patient-id',
      dni: null,
      email: null,
      primaryPhone: null,
      birthDate: '1980-01-01',
      gender: 'F',
      role: 'PATIENT',
      status: 'ENROLLED',
      activityStatus: 'ACTIVE',
      details: null,
    } as unknown as Patient;
    const emptyFind = jest.fn().mockResolvedValue([]);
    const appointmentsFind = jest.fn().mockResolvedValue([
      {
        specialty: 'Oncologia',
        appointmentDate: '2026-01-10',
        nextAppointmentDate: '2026-02-10',
        nextAppointmentSpecialty: 'Oncologia',
        difficulties: 'Falta de transporte',
      },
    ]);
    const service = new PatientSummaryPayloadService(
      {
        findOne: jest.fn().mockResolvedValue(patient),
      } as unknown as Repository<Patient>,
      { find: emptyFind } as unknown as Repository<PatientDiagnosis>,
      { find: emptyFind } as unknown as Repository<PatientInsurance>,
      { find: emptyFind } as unknown as Repository<PatientTreatment>,
      { find: appointmentsFind } as unknown as Repository<PatientMedicalAppointment>,
      { find: emptyFind } as unknown as Repository<PatientSisAffiliation>,
      { find: emptyFind } as unknown as Repository<PatientSymptomReport>,
      { find: emptyFind } as unknown as Repository<Enrollment>,
      { find: emptyFind } as unknown as Repository<FollowUp>,
      {
        findOne: jest.fn().mockResolvedValue(null),
      } as unknown as Repository<PatientAddress>,
      {
        findOneBy: jest.fn().mockResolvedValue(null),
      } as unknown as Repository<HealthCenter>,
    );

    const prompt = await service.buildPrompt('patient-id');

    expect(prompt).toContain('Oncologia');
    expect(prompt).toContain('Falta de transporte');
    expect(prompt).toContain('citas medicas');
    expect(prompt).toContain('appointments.difficulties');
  });
});
