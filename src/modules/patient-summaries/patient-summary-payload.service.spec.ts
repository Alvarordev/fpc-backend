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
        healthCenter: { name: 'Instituto Nacional' },
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
      {
        find: appointmentsFind,
      } as unknown as Repository<PatientMedicalAppointment>,
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
    expect(prompt).toContain('Instituto Nacional');
    expect(prompt).toContain('Falta de transporte');
    expect(prompt).toContain('citas medicas');
    expect(prompt).toContain('appointments.difficulties');
  });

  it('includes the historical diagnosis and enrollment answers', async () => {
    const patient = {
      id: 'patient-id',
      birthDate: null,
      gender: null,
      role: 'PATIENT',
      status: 'ENROLLED',
      activityStatus: 'ACTIVE',
      details: null,
    } as unknown as Patient;
    const emptyFind = jest.fn().mockResolvedValue([]);
    const diagnosesFind = jest.fn().mockResolvedValue([
      {
        diagnosis: 'Cáncer de mama',
        cancerStage: 'STAGE_2',
        diagnosisDate: null,
        firstSymptomsDate: null,
        healthCenter: { name: 'Hospital de origen' },
        referredHealthCenter: { name: 'Hospital derivado' },
        hasReferral: true,
        diagnosisSpecialty: null,
        symptomLeadingToCheckup: null,
        isSepaActiveReferral: null,
      },
    ]);
    const enrollmentFind = jest.fn().mockResolvedValue([
      {
        currentlyAttendingConsultations: false,
        notAttendingConsultationsNote: 'No pudo continuar sus controles',
        currentlyReceivingTreatment: false,
        notReceivingTreatmentReason: 'Tratamiento no iniciado',
        requiresTransportation: null,
        hasMobilityIssues: null,
        isOncologicalPatient: true,
      },
    ]);
    const service = new PatientSummaryPayloadService(
      {
        findOne: jest.fn().mockResolvedValue(patient),
      } as unknown as Repository<Patient>,
      { find: diagnosesFind } as unknown as Repository<PatientDiagnosis>,
      { find: emptyFind } as unknown as Repository<PatientInsurance>,
      { find: emptyFind } as unknown as Repository<PatientTreatment>,
      { find: emptyFind } as unknown as Repository<PatientMedicalAppointment>,
      { find: emptyFind } as unknown as Repository<PatientSisAffiliation>,
      { find: emptyFind } as unknown as Repository<PatientSymptomReport>,
      { find: enrollmentFind } as unknown as Repository<Enrollment>,
      { find: emptyFind } as unknown as Repository<FollowUp>,
      {
        findOne: jest.fn().mockResolvedValue(null),
      } as unknown as Repository<PatientAddress>,
      {
        findOneBy: jest.fn().mockResolvedValue(null),
      } as unknown as Repository<HealthCenter>,
    );

    const prompt = await service.buildPrompt('patient-id');

    expect(prompt).toContain('Hospital derivado');
    expect(prompt).toContain('"hasReferral":true');
    expect(prompt).toContain('No pudo continuar sus controles');
    expect(prompt).toContain('Tratamiento no iniciado');
  });
});
