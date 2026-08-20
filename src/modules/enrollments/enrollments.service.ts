import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Agent } from '../../database/entities/agent.entity';
import {
  AffiliationType,
  Enrollment,
} from '../../database/entities/enrollment.entity';
import { EnrollmentFamilyTalkInterest } from '../../database/entities/enrollment-family-talk-interest.entity';
import { FollowUpPurpose } from '../../database/entities/follow-up.enums';
import { CompanionPatient } from '../../database/entities/companion-patient.entity';
import { PatientDiagnosis } from '../../database/entities/patient-diagnosis.entity';
import { InsuranceType } from '../../database/entities/patient-insurance.entity';
import { PatientRole } from '../../database/entities/patient-role.enum';
import { PatientStatus } from '../../database/entities/patient-status.enum';
import { PatientHealthPhase } from '../../database/entities/patient-health-phase.enum';
import { Patient } from '../../database/entities/patient.entity';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { PatientDiagnosesService } from '../patients/clinical/diagnoses/patient-diagnoses.service';
import { PatientInsuranceService } from '../patients/clinical/insurance/patient-insurance.service';
import { PatientMedicalAppointmentsService } from '../patients/clinical/medical-appointments/patient-medical-appointments.service';
import { PatientSisAffiliationService } from '../patients/clinical/sis-affiliation/patient-sis-affiliation.service';
import { PatientTreatmentsService } from '../patients/clinical/treatments/patient-treatments.service';
import { PatientSymptomReportsService } from '../patients/symptom-reports/patient-symptom-reports.service';
import { PatientsService } from '../patients/patients.service';
import { PatientAddressesService } from '../patients/addresses/patient-addresses.service';
import { PatientHealthBackgroundAssessmentsService } from '../patients/clinical/health-background/patient-health-background-assessments.service';
import { PatientSummaryInvalidationService } from '../patient-summaries/patient-summary-invalidation.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentSurveyDto } from './dto/update-enrollment-survey.dto';
import { User } from '../../database/entities/user.entity';
import { N8nTransactionalDispatchService } from '../../integrations/n8n/transactional-dispatch.service';
import { buildRegistroEnvelope } from '../../integrations/n8n/n8n-webhook.payloads';

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollments: Repository<Enrollment>,
    @InjectRepository(Agent)
    private readonly agents: Repository<Agent>,
    private readonly dataSource: DataSource,
    private readonly patients: PatientsService,
    private readonly followUps: FollowUpsService,
    private readonly insurance: PatientInsuranceService,
    private readonly diagnoses: PatientDiagnosesService,
    private readonly treatments: PatientTreatmentsService,
    private readonly appointments: PatientMedicalAppointmentsService,
    private readonly sisAffiliations: PatientSisAffiliationService,
    private readonly symptomReports: PatientSymptomReportsService,
    private readonly addresses: PatientAddressesService,
    private readonly healthBackgroundAssessments: PatientHealthBackgroundAssessmentsService,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly webhooks: N8nTransactionalDispatchService,
  ) {}

  async create(input: CreateEnrollmentDto, userId: string, userRole: string) {
    return this.dataSource.transaction(async (manager) => {
      const {
        patientId,
        patient: patientInput,
        followUp: followUpInput,
        companionId,
        companion: companionInput,
        details,
        insurance,
        sisAffiliation,
        diagnosis,
        treatments,
        medicalAppointments,
        symptomReport,
        healthBackgroundAssessment,
        familyPreventionTalkInterests,
        healthPhase,
        addresses,
        ...metadata
      } = input;
      if (
        healthPhase !== PatientHealthPhase.CANCER_DIAGNOSIS &&
        healthPhase !== PatientHealthPhase.SIGNS_AND_SYMPTOMS
      ) {
        throw new BadRequestException(
          'Enrollment requires a cancer diagnosis or signs and symptoms phase',
        );
      }
      if (Boolean(patientId) === Boolean(patientInput))
        throw new BadRequestException(
          'Provide exactly one of patientId or patient',
        );
      const hasCompanion = Boolean(companionId || companionInput);
      if (input.affiliationType === AffiliationType.SELF) {
        if (companionInput?.isPrimaryInformant === true)
          throw new BadRequestException(
            'SELF enrollment companion cannot be the primary informant',
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
            .createQueryBuilder('patient')
            .setLock('pessimistic_write')
            .where('patient.id = :id', { id: patientId })
            .getOne()
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
      if (hasCompanion) {
        const isFamily =
          input.affiliationType === AffiliationType.FAMILY_FRIEND;
        const normalizedCompanion = companionInput
          ? {
              ...companionInput,
              isPrimaryInformant: isFamily,
              isPrimaryContact: companionInput.isPrimaryContact ?? isFamily,
              isCaregiver: companionInput.isCaregiver ?? true,
            }
          : undefined;
        companion = companionId
          ? await this.patients.assertPatientRole(
              companionId,
              PatientRole.COMPANION,
              undefined,
              manager,
            )
          : await this.patients.createCompanion(
              patient.id,
              normalizedCompanion!,
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
                isPrimaryInformant: isFamily,
                isPrimaryContact: isFamily,
                isCaregiver: true,
              },
              manager,
            );
          else if (isFamily) {
            link.isPrimaryInformant = true;
            link.isPrimaryContact = true;
            link.isCaregiver = true;
            await links.save(link);
          }
        }
      }

      await this.patients.upsertDetails(
        patient.id,
        { ...details, healthPhase },
        manager,
      );
      const followUp = await this.followUps.create(
        {
          ...followUpInput,
          subjectPatientId: patient.id,
          interlocutorId: companion?.id ?? patient.id,
          purpose: FollowUpPurpose.ENROLLMENT,
        },
        userId,
        userRole,
        manager,
      );
      const enrollmentRepository = manager.getRepository(Enrollment);
      const enrollment = await enrollmentRepository.save(
        enrollmentRepository.create({
          ...metadata,
          callStartedAt: metadata.callStartedAt
            ? new Date(metadata.callStartedAt)
            : null,
          callEndedAt: metadata.callEndedAt
            ? new Date(metadata.callEndedAt)
            : null,
          patientId: patient.id,
          followUpId: followUp.id,
          companionId: companion?.id ?? null,
        }),
      );
      if (familyPreventionTalkInterests?.length)
        await manager.getRepository(EnrollmentFamilyTalkInterest).save(
          familyPreventionTalkInterests.map((interest) =>
            manager.getRepository(EnrollmentFamilyTalkInterest).create({
              ...interest,
              enrollmentId: enrollment.id,
            }),
          ),
        );

      if (insurance)
        await this.insurance.create(
          patient.id,
          { ...insurance, followUpId: followUp.id },
          manager,
        );
      if (sisAffiliation)
        await this.sisAffiliations.create(
          patient.id,
          { ...sisAffiliation, followUpId: followUp.id },
          manager,
        );
      const treatmentDiagnosis = diagnosis
        ? await this.diagnoses.create(
            patient.id,
            { ...diagnosis, followUpId: followUp.id },
            manager,
          )
        : treatments?.length
          ? await manager.getRepository(PatientDiagnosis).findOne({
              where: { patientId: patient.id, isCurrent: true },
            })
          : null;
      if (treatments?.length && !treatmentDiagnosis)
        throw new BadRequestException(
          'Enrollment treatment requires a current diagnosis',
        );
      for (const treatment of treatments ?? [])
        await this.treatments.create(
          patient.id,
          {
            ...treatment,
            followUpId: followUp.id,
            diagnosisId: treatmentDiagnosis!.id,
          },
          manager,
        );
      for (const appointment of medicalAppointments ?? [])
        await this.appointments.create(
          patient.id,
          { ...appointment, followUpId: followUp.id },
          manager,
        );
      if (symptomReport)
        await this.symptomReports.create(
          patient.id,
          {
            ...symptomReport,
            followUpId: followUp.id,
            enrollmentId: enrollment.id,
          },
          manager,
        );
      if (healthBackgroundAssessment)
        await this.healthBackgroundAssessments.create(
          patient.id,
          { ...healthBackgroundAssessment, followUpId: followUp.id },
          manager,
        );
      for (const address of addresses ?? [])
        await this.addresses.create(
          patient.id,
          { ...address, followUpId: followUp.id },
          manager,
        );

      await this.invalidations.markDirty(patient.id, manager);
      // Cita webhooks for medicalAppointments are already dispatched by
      // this.appointments.create() above; only Registro needs firing here.
      await this.webhooks.enqueue(
        buildRegistroEnvelope({
          fullName: patient.fullName,
          dni: patient.dni ?? '',
          phone: patient.primaryPhone,
          email: patient.email,
          diagnosis: diagnosis?.diagnosis ?? 'En evaluación',
          // patient.role was just set to PATIENT above (the companion, if
          // any, is enrolled separately and never gets its own Registro).
          condition: 'paciente',
        }),
        manager,
      );
      return { ...enrollment, patient, companion, followUp };
    });
  }

  async findAll(patientId: string, user: User) {
    await this.patients.assertCanRead(patientId, user);
    return this.enrollments.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateSurvey(
    id: string,
    input: UpdateEnrollmentSurveyDto,
    userId: string,
    userRole: string,
  ) {
    const enrollment = await this.enrollments.findOne({
      where: { id },
      relations: { followUp: true },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    if (userRole === 'AGENT') {
      const agent = await this.agents.findOne({ where: { userId } });
      if (!agent)
        throw new BadRequestException(
          'Authenticated user has no agent profile',
        );
      if (enrollment.followUp.agentId !== agent.id)
        throw new ForbiddenException(
          'Agents can only update their own enrollment',
        );
    }

    enrollment.followUpQualityRating = input.followUpQualityRating;
    const updated = await this.enrollments.save(enrollment);
    await this.invalidations.markDirty(updated.patientId);
    return updated;
  }
}
