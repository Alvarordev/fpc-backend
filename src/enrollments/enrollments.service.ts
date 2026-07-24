import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  AffiliationType,
  Enrollment,
} from '../database/entities/enrollment.entity';
import { InteractionPurpose } from '../database/entities/interaction.enums';
import { CompanionPatient } from '../patients/entities/companion-patient.entity';
import { PatientDiagnosis } from '../patients/entities/patient-diagnosis.entity';
import { InsuranceType } from '../patients/entities/patient-insurance.entity';
import { PatientRole } from '../patients/entities/patient-role.enum';
import { PatientStatus } from '../patients/entities/patient-status.enum';
import { Patient } from '../patients/entities/patient.entity';
import { InteractionsService } from '../interactions/interactions.service';
import { PatientDiagnosesService } from '../patients/clinical/diagnoses/patient-diagnoses.service';
import { PatientInsuranceService } from '../patients/clinical/insurance/patient-insurance.service';
import { PatientMedicalAppointmentsService } from '../patients/clinical/medical-appointments/patient-medical-appointments.service';
import { PatientSisAffiliationService } from '../patients/clinical/sis-affiliation/patient-sis-affiliation.service';
import { PatientTreatmentsService } from '../patients/clinical/treatments/patient-treatments.service';
import { PatientSymptomReportsService } from '../patients/symptom-reports/patient-symptom-reports.service';
import { PatientsService } from '../patients/patients.service';
import { CreateEnrollmentDto } from './enrollments.dto';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollments: Repository<Enrollment>,
    private readonly dataSource: DataSource,
    private readonly patients: PatientsService,
    private readonly interactions: InteractionsService,
    private readonly insurance: PatientInsuranceService,
    private readonly diagnoses: PatientDiagnosesService,
    private readonly treatments: PatientTreatmentsService,
    private readonly appointments: PatientMedicalAppointmentsService,
    private readonly sisAffiliations: PatientSisAffiliationService,
    private readonly symptomReports: PatientSymptomReportsService,
  ) {}

  async create(input: CreateEnrollmentDto, userId: string, userRole: string) {
    return this.dataSource.transaction(async (manager) => {
      const {
        patientId,
        patient: patientInput,
        interaction: interactionInput,
        companionId,
        companion: companionInput,
        details,
        insurance,
        sisAffiliation,
        diagnosis,
        treatment,
        medicalAppointments,
        symptomReport,
        ...metadata
      } = input;
      if (Boolean(patientId) === Boolean(patientInput))
        throw new BadRequestException(
          'Provide exactly one of patientId or patient',
        );
      if (input.affiliationType === AffiliationType.SELF) {
        if (companionId || companionInput)
          throw new BadRequestException(
            'SELF enrollment cannot include a primary informant or companion',
          );
      } else if (Boolean(companionId) === Boolean(companionInput)) {
        throw new BadRequestException(
          'FAMILY_FRIEND enrollment requires exactly one companion',
        );
      } else if (companionInput && companionInput.isPrimaryInformant !== true) {
        throw new BadRequestException(
          'FAMILY_FRIEND enrollment requires a primary informant',
        );
      }
      if (insurance?.insuranceType === InsuranceType.SIS && sisAffiliation)
        throw new ConflictException(
          'A patient with SIS insurance cannot also have a SIS affiliation request',
        );

      const patient = patientId
        ? await manager
            .getRepository(Patient)
            .findOne({ where: { id: patientId } })
        : await this.patients.create(patientInput!, manager);
      if (!patient) throw new NotFoundException('Patient not found');
      if (patient.status !== PatientStatus.UNENROLLED)
        throw new ConflictException('Patient is already enrolled');
      if (
        patient.role !== PatientRole.UNKNOWN &&
        patient.role !== PatientRole.PATIENT
      )
        throw new ConflictException('Only a patient can be enrolled');

      patient.role = PatientRole.PATIENT;
      patient.status = PatientStatus.ENROLLED;
      await manager.getRepository(Patient).save(patient);

      let companion: Patient | null = null;
      if (input.affiliationType === AffiliationType.FAMILY_FRIEND) {
        companion = companionId
          ? await this.patients.assertPatientRole(
              companionId,
              PatientRole.COMPANION,
              undefined,
              manager,
            )
          : await this.patients.createCompanion(
              patient.id,
              companionInput!,
              manager,
            );
        if (companionId) {
          const links = manager.getRepository(CompanionPatient);
          const link = await links.findOne({
            where: { patientId: patient.id, companionId: companion.id },
          });
          if (!link)
            await this.patients.linkCompanion(
              patient.id,
              {
                existingCompanionId: companion.id,
                isPrimaryInformant: true,
              },
              manager,
            );
        }
      }

      if (details)
        await this.patients.upsertDetails(patient.id, details, manager);
      const interaction = await this.interactions.create(
        {
          ...interactionInput,
          subjectPatientId: patient.id,
          interlocutorId: companion?.id ?? patient.id,
          purpose: InteractionPurpose.ENROLLMENT,
        },
        userId,
        userRole,
        manager,
      );
      const enrollmentRepository = manager.getRepository(Enrollment);
      const enrollment = await enrollmentRepository.save(
        enrollmentRepository.create({
          ...metadata,
          patientId: patient.id,
          interactionId: interaction.id,
          companionId: companion?.id ?? null,
        }),
      );

      if (insurance)
        await this.insurance.create(
          patient.id,
          { ...insurance, interactionId: interaction.id },
          manager,
        );
      if (sisAffiliation)
        await this.sisAffiliations.create(
          patient.id,
          { ...sisAffiliation, interactionId: interaction.id },
          manager,
        );
      const treatmentDiagnosis = diagnosis
        ? await this.diagnoses.create(
            patient.id,
            { ...diagnosis, interactionId: interaction.id },
            manager,
          )
        : treatment
          ? await manager.getRepository(PatientDiagnosis).findOne({
              where: { patientId: patient.id, isCurrent: true },
            })
          : null;
      if (treatment && !treatmentDiagnosis)
        throw new BadRequestException(
          'Enrollment treatment requires a current diagnosis',
        );
      if (treatment && treatmentDiagnosis)
        await this.treatments.create(
          patient.id,
          {
            ...treatment,
            interactionId: interaction.id,
            diagnosisId: treatmentDiagnosis.id,
          },
          manager,
        );
      for (const appointment of medicalAppointments ?? [])
        await this.appointments.create(
          patient.id,
          { ...appointment, interactionId: interaction.id },
          manager,
        );
      if (symptomReport)
        await this.symptomReports.create(
          patient.id,
          {
            ...symptomReport,
            interactionId: interaction.id,
            enrollmentId: enrollment.id,
          },
          manager,
        );

      return { ...enrollment, patient, companion, interaction };
    });
  }

  findAll(patientId: string) {
    return this.enrollments.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
