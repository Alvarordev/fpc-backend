import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { EnrollmentContactSource } from './enrollment-contact-source.enum';
import { EnrollmentsService } from './enrollments.service';
import { PatientHealthPhase } from '../../database/entities/patient-health-phase.enum';
import { CompanionContactRole } from '../../database/entities/companion-contact-role.enum';
import { PatientDiagnosisMode } from '../../database/entities/patient-diagnosis-mode.enum';
import { AffiliationType } from '../../database/entities/enrollment.entity';

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

  it('rejects psycho-oncology support answers for signs enrollment', () => {
    expect(
      validateClinical({
        affiliationType: AffiliationType.SELF,
        psychooncologySupportAssessment: { excessiveWorry: true },
      }),
    ).toThrow(
      'Psycho-oncology support assessment requires a self enrollment with a cancer diagnosis',
    );
  });

  it('rejects psycho-oncology support answers from a third party', () => {
    expect(
      validateClinical(
        {
          affiliationType: AffiliationType.FAMILY_FRIEND,
          diagnosis: {
            diagnosis: 'Breast cancer',
            mode: PatientDiagnosisMode.PARALLEL,
          },
          psychooncologySupportAssessment: {},
        },
        PatientHealthPhase.CANCER_DIAGNOSIS,
      ),
    ).toThrow(
      'Psycho-oncology support assessment requires a self enrollment with a cancer diagnosis',
    );
  });

  it('accepts optional psycho-oncology support answers from the patient', () => {
    expect(
      validateClinical(
        {
          affiliationType: AffiliationType.SELF,
          diagnosis: {
            diagnosis: 'Breast cancer',
            mode: PatientDiagnosisMode.PARALLEL,
          },
          psychooncologySupportAssessment: {},
          currentlyAttendingConsultations: false,
          notAttendingConsultationsNote: 'No ha podido asistir',
          currentlyReceivingTreatment: true,
        },
        PatientHealthPhase.CANCER_DIAGNOSIS,
      ),
    ).not.toThrow();
  });

  it('requires the consultation and treatment answers for a cancer diagnosis', () => {
    expect(
      validateClinical(
        {
          diagnosis: {
            diagnosis: 'Breast cancer',
            mode: PatientDiagnosisMode.PARALLEL,
          },
        },
        PatientHealthPhase.CANCER_DIAGNOSIS,
      ),
    ).toThrow(
      'Cancer diagnosis enrollment requires a consultation attendance answer',
    );

    expect(
      validateClinical(
        {
          diagnosis: {
            diagnosis: 'Breast cancer',
            mode: PatientDiagnosisMode.PARALLEL,
          },
          currentlyAttendingConsultations: false,
          notAttendingConsultationsNote: 'No ha podido asistir',
        },
        PatientHealthPhase.CANCER_DIAGNOSIS,
      ),
    ).toThrow(
      'Cancer diagnosis enrollment requires a current treatment answer',
    );
  });

  it('requires a consultation center when the patient attends consultations', () => {
    expect(
      validateClinical(
        {
          diagnosis: {
            diagnosis: 'Breast cancer',
            mode: PatientDiagnosisMode.PARALLEL,
          },
          currentlyAttendingConsultations: true,
          currentlyReceivingTreatment: true,
          medicalAppointments: [{ specialty: 'Oncología' }],
        },
        PatientHealthPhase.CANCER_DIAGNOSIS,
      ),
    ).toThrow('Attending consultations requires a health center');
  });

  it('requires a note when the patient does not attend consultations', () => {
    expect(
      validateClinical(
        {
          diagnosis: {
            diagnosis: 'Breast cancer',
            mode: PatientDiagnosisMode.PARALLEL,
          },
          currentlyAttendingConsultations: false,
          currentlyReceivingTreatment: true,
        },
        PatientHealthPhase.CANCER_DIAGNOSIS,
      ),
    ).toThrow('Not attending consultations requires a note');
  });

  it('requires a reason when the patient is not receiving treatment', () => {
    expect(
      validateClinical(
        {
          diagnosis: {
            diagnosis: 'Breast cancer',
            mode: PatientDiagnosisMode.PARALLEL,
          },
          currentlyAttendingConsultations: false,
          notAttendingConsultationsNote: 'No ha podido asistir',
          currentlyReceivingTreatment: false,
        },
        PatientHealthPhase.CANCER_DIAGNOSIS,
      ),
    ).toThrow('Not receiving treatment requires a reason');
  });

  it('does not accept detailed treatments when the patient is not receiving treatment', () => {
    expect(
      validateClinical(
        {
          diagnosis: {
            diagnosis: 'Breast cancer',
            mode: PatientDiagnosisMode.PARALLEL,
          },
          currentlyAttendingConsultations: false,
          notAttendingConsultationsNote: 'No ha podido asistir',
          currentlyReceivingTreatment: false,
          notReceivingTreatmentReason: 'Tratamiento no iniciado',
          treatments: [{ treatmentType: 'Chemotherapy' }],
        },
        PatientHealthPhase.CANCER_DIAGNOSIS,
      ),
    ).toThrow('A patient not receiving treatment cannot include treatments');
  });
});
