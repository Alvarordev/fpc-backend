import { Repository } from 'typeorm';
import { Enrollment } from '../database/entities/enrollment.entity';
import { FollowUp } from '../database/entities/follow-up.entity';
import { PatientDiagnosis } from '../patients/entities/patient-diagnosis.entity';
import { PatientInsurance } from '../patients/entities/patient-insurance.entity';
import { PatientMedicalAppointment } from '../patients/entities/patient-medical-appointment.entity';
import { PatientSisAffiliation } from '../patients/entities/patient-sis-affiliation.entity';
import { PatientSymptomReport } from '../patients/entities/patient-symptom-report.entity';
import { PatientTreatment } from '../patients/entities/patient-treatment.entity';
import { Patient } from '../patients/entities/patient.entity';
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
      isActive: true,
      details: {
        currentDistrict: 'Lima',
        currentDepartment: 'Lima',
        travelTimeToHospital: '30m',
        requiresTranslation: false,
        currentAddress: 'Secret address',
      },
    } as unknown as Patient;
    const find = jest.fn().mockResolvedValue([]);
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
    );

    const prompt = await service.buildPrompt('patient-id');

    expect(prompt).not.toContain('12345678');
    expect(prompt).not.toContain('patient@example.com');
    expect(prompt).not.toContain('555-0000');
    expect(prompt).not.toContain('Secret address');
    expect(prompt).toContain('Lima');
  });
});
