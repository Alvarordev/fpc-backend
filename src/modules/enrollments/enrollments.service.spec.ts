import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { EnrollmentContactSource } from './enrollment-contact-source.enum';
import { EnrollmentsService } from './enrollments.service';
import { PatientHealthPhase } from '../../database/entities/patient-health-phase.enum';
import { CompanionContactRole } from '../../database/entities/companion-contact-role.enum';
import { PatientDiagnosisMode } from '../../database/entities/patient-diagnosis-mode.enum';

type PrivateValidationMethods = {
  validateClinicalBranches(input: CreateEnrollmentDto): void;
  validateContacts(contacts: CreateEnrollmentDto['contacts']): void;
};

function validationMethods() {
  return EnrollmentsService.prototype as unknown as PrivateValidationMethods;
}

function validateClinical(
  input: Partial<CreateEnrollmentDto>,
  healthPhase = PatientHealthPhase.SIGNS_AND_SYMPTOMS,
) {
  const service = validationMethods();
  return () =>
    service.validateClinicalBranches({
      ...input,
      healthPhase,
    } as CreateEnrollmentDto);
}

describe('EnrollmentsService phase-one validation', () => {
  it('requires the symptom report for the signs and symptoms phase', () => {
    expect(() => validateClinical({})()).toThrow(
      'Signs and symptoms enrollment requires a symptom report',
    );
  });

  it('does not accept the legacy consultation field as the new answer', () => {
    expect(
      validateClinical({
        symptomReport: {
          hasDiscomfort: true,
          hasSoughtMedicalConsultation: false,
        },
      }),
    ).toThrow(
      'Signs and symptoms enrollment requires a consultation request answer',
    );
  });

  it('allows the CALLER source only once among explicit contacts', () => {
    const service = validationMethods();

    expect(() =>
      service.validateContacts([
        {
          role: CompanionContactRole.PRIMARY,
          source: EnrollmentContactSource.CALLER,
        },
        {
          role: CompanionContactRole.SECONDARY,
          source: EnrollmentContactSource.CALLER,
        },
      ]),
    ).toThrow('contacts may contain the CALLER source only once');
  });

  it('requires at least one diagnosis for the cancer diagnosis phase', () => {
    expect(validateClinical({}, PatientHealthPhase.CANCER_DIAGNOSIS)).toThrow(
      'Cancer diagnosis enrollment requires at least one diagnosis',
    );
  });

  it('requires every enrollment treatment to reference a submitted diagnosis', () => {
    expect(
      validateClinical(
        {
          diagnoses: [
            {
              clientRef: 'diagnosis-1',
              diagnosis: 'Breast cancer',
              mode: PatientDiagnosisMode.PARALLEL,
            },
          ],
          treatments: [{ treatmentType: 'Chemotherapy' }],
        },
        PatientHealthPhase.CANCER_DIAGNOSIS,
      ),
    ).toThrow('Every enrollment treatment requires a diagnosisRef');
  });
});
