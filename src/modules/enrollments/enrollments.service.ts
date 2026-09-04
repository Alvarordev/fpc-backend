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
import { PatientInsurance } from '../../database/entities/patient-insurance.entity';
import { PatientRole } from '../../database/entities/patient-role.enum';
import { PatientStatus } from '../../database/entities/patient-status.enum';
import { PatientHealthPhase } from '../../database/entities/patient-health-phase.enum';
import { Patient } from '../../database/entities/patient.entity';
import { CompanionContactRole } from '../../database/entities/companion-contact-role.enum';
import { MedicalConsultationStatus } from '../../database/entities/medical-consultation-status.enum';
import { MedicalAppointmentStatus } from '../../database/entities/medical-appointment-status.enum';
import {
  FollowUpCreateOptions,
  FollowUpsService,
} from '../follow-ups/follow-ups.service';
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
import {
  CreateEnrollmentDto,
  EnrollmentContactInputDto,
} from './dto/create-enrollment.dto';
import { UpdateEnrollmentSurveyDto } from './dto/update-enrollment-survey.dto';
import { User } from '../../database/entities/user.entity';
import { N8nTransactionalDispatchService } from '../../integrations/n8n/transactional-dispatch.service';
import { buildRegistroEnvelope } from '../../integrations/n8n/n8n-webhook.payloads';
import { EnrollmentContactSource } from './enrollment-contact-source.enum';
import { PatientDiagnosticStatusesService } from '../patients/diagnostic-status/patient-diagnostic-statuses.service';
import { PatientPsychooncologySupportAssessmentsService } from '../patients/clinical/psychooncology-support/patient-psychooncology-support-assessments.service';
import { dateOnlyInLima } from '../../shared/date-only/date-only.util';
import type { HistoricalEnrollmentInput } from '../historical-records/dto/create-historical-enrollment.dto';

type EnrollmentInput = (CreateEnrollmentDto | HistoricalEnrollmentInput) & {
  enrolledOn?: string;
  followUp: CreateEnrollmentDto['followUp'] & {
    status?: import('../../database/entities/follow-up.enums').FollowUpStatus;
    scheduledOn?: string;
    completedOn?: string;
  };
};

export interface EnrollmentCreateOptions extends FollowUpCreateOptions {
  historical?: boolean;
}

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollments: Repository<Enrollment>,
    @InjectRepository(EnrollmentFamilyTalkInterest)
    private readonly familyTalkInterests: Repository<EnrollmentFamilyTalkInterest>,
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
    private readonly psychooncologySupportAssessments: PatientPsychooncologySupportAssessmentsService,
    private readonly diagnosticStatuses: PatientDiagnosticStatusesService,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly webhooks: N8nTransactionalDispatchService,
  ) {}

  async create(
    input: EnrollmentInput,
    userId: string,
    userRole: string,
    options: EnrollmentCreateOptions = {},
  ) {
    return this.dataSource.transaction(async (manager) => {
      const {
        patientId,
        patient: patientInput,
        followUp: followUpInput,
        companionId,
        companion: companionInput,
        contacts,
        details,
        insurance,
        sisAffiliation,
        diagnosis,
        diagnoses,
        treatments,
        medicalAppointments,
        symptomReport,
        healthBackgroundAssessment,
        psychooncologySupportAssessment,
        familyPreventionTalkInterests,
        healthPhase,
        addresses,
        enrolledOn,
        ...metadata
      } = input;
      const followUpValues = {
        ...followUpInput,
      };
      const historicalScheduledOn = followUpValues.scheduledOn;
      const historicalCompletedOn = followUpValues.completedOn;
      const historicalStatus = followUpValues.status;
      const historicalLoadedById = options.historical
        ? (options.historicalLoadedById ?? userId)
        : undefined;
      delete followUpValues.scheduledOn;
      delete followUpValues.completedOn;
      delete followUpValues.status;
      const usesExplicitContacts = contacts !== undefined;
      this.validateContacts(contacts);
      this.validateClinicalBranches(input);
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
      if (
        !usesExplicitContacts &&
        input.affiliationType === AffiliationType.SELF
      ) {
        if (companionInput?.isPrimaryInformant === true)
          throw new BadRequestException(
            'SELF enrollment companion cannot be the primary informant',
          );
      } else if (
        input.affiliationType === AffiliationType.FAMILY_FRIEND &&
        Boolean(companionId) === Boolean(companionInput)
      ) {
        throw new BadRequestException(
          'FAMILY_FRIEND enrollment requires exactly one companion',
        );
      } else if (
        !usesExplicitContacts &&
        input.affiliationType === AffiliationType.FAMILY_FRIEND &&
        companionInput &&
        companionInput.isPrimaryInformant !== true
      ) {
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
      this.validateContactAgeRules(patient, contacts);
      if (
        patient.status !== PatientStatus.UNENROLLED &&
        !(options.historical && Boolean(patientId))
      )
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
              isPrimaryContact: usesExplicitContacts
                ? false
                : (companionInput.isPrimaryContact ?? isFamily),
              contactRole: usesExplicitContacts
                ? null
                : companionInput.contactRole,
              isCaregiver: usesExplicitContacts
                ? (companionInput.isCaregiver ?? false)
                : (companionInput.isCaregiver ?? true),
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
                isPrimaryContact: usesExplicitContacts ? false : isFamily,
                contactRole: null,
                isCaregiver: usesExplicitContacts ? false : true,
              },
              manager,
            );
          else if (isFamily) {
            link.isPrimaryInformant = true;
            if (!usesExplicitContacts) {
              link.contactRole = CompanionContactRole.PRIMARY;
              link.isPrimaryContact = true;
              link.isCaregiver = true;
            }
            await links.save(link);
          }
        }
      }

      if (usesExplicitContacts) {
        const links = manager.getRepository(CompanionPatient);
        await links.update(
          { patientId: patient.id },
          { contactRole: null, isPrimaryContact: false },
        );
        for (const contact of contacts) {
          if (contact.source === EnrollmentContactSource.PATIENT) continue;
          if (contact.source === EnrollmentContactSource.CALLER) {
            if (!companion)
              throw new BadRequestException(
                'CALLER contact requires a companion caller',
              );
            const link = await links.findOneByOrFail({
              patientId: patient.id,
              companionId: companion.id,
            });
            link.contactRole = contact.role;
            link.isPrimaryContact =
              contact.role === CompanionContactRole.PRIMARY;
            await links.save(link);
            continue;
          }
          await this.patients.createCompanion(
            patient.id,
            {
              ...contact.person!,
              contactRole: contact.role,
              isPrimaryContact: contact.role === CompanionContactRole.PRIMARY,
              isPrimaryInformant: false,
              isCaregiver: false,
            },
            manager,
          );
        }
      }

      await this.patients.upsertDetails(
        patient.id,
        { ...details, healthPhase },
        manager,
      );
      const followUp = await this.followUps.create(
        {
          ...followUpValues,
          subjectPatientId: patient.id,
          interlocutorId: companion?.id ?? patient.id,
          purpose: FollowUpPurpose.ENROLLMENT,
        },
        userId,
        userRole,
        manager,
        {
          isHistorical: options.historical ?? false,
          historicalLoadedById,
          status: options.historical ? historicalStatus : undefined,
          scheduledOn: options.historical ? historicalScheduledOn : undefined,
          completedOn: options.historical ? historicalCompletedOn : undefined,
        },
      );
      const enrollmentRepository = manager.getRepository(Enrollment);
      const enrollmentMetadata = {
        ...metadata,
        notAttendingConsultationsNote:
          metadata.currentlyAttendingConsultations === false
            ? metadata.notAttendingConsultationsNote?.trim() || null
            : null,
        notReceivingTreatmentReason:
          metadata.currentlyReceivingTreatment === false
            ? metadata.notReceivingTreatmentReason?.trim() || null
            : null,
      };
      const enrollment = await enrollmentRepository.save(
        enrollmentRepository.create({
          ...enrollmentMetadata,
          callStartedAt: metadata.callStartedAt
            ? new Date(metadata.callStartedAt)
            : null,
          callEndedAt: metadata.callEndedAt
            ? new Date(metadata.callEndedAt)
            : null,
          patientId: patient.id,
          followUpId: followUp.id,
          companionId: companion?.id ?? null,
          enrolledOn: enrolledOn ?? dateOnlyInLima(new Date()),
          isHistorical: options.historical ?? false,
          historicalLoadedById: historicalLoadedById ?? null,
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

      if (insurance) {
        const currentInsurance = await manager
          .getRepository(PatientInsurance)
          .findOneBy({ patientId: patient.id, isCurrent: true });
        const matchesCurrentProspectInsurance =
          !insurance.startDate &&
          currentInsurance?.insuranceType === insurance.insuranceType &&
          currentInsurance.epsProvider === (insurance.epsProvider ?? null);
        if (!matchesCurrentProspectInsurance)
          await this.insurance.create(
            patient.id,
            { ...insurance, followUpId: followUp.id },
            manager,
          );
      }
      if (sisAffiliation)
        await this.sisAffiliations.create(
          patient.id,
          { ...sisAffiliation, followUpId: followUp.id },
          manager,
        );
      const createdDiagnoses = new Map<string, PatientDiagnosis>();
      const createdDiagnosisList: PatientDiagnosis[] = [];
      for (const diagnosisInput of diagnoses ??
        (diagnosis ? [diagnosis] : [])) {
        const { clientRef, ...diagnosisValues } = diagnosisInput;
        const createdDiagnosis = await this.diagnoses.create(
          patient.id,
          { ...diagnosisValues, followUpId: followUp.id },
          manager,
        );
        createdDiagnosisList.push(createdDiagnosis);
        if (clientRef) createdDiagnoses.set(clientRef, createdDiagnosis);
      }
      for (const treatment of treatments ?? []) {
        const treatmentDiagnosis = diagnoses
          ? createdDiagnoses.get(treatment.diagnosisRef ?? '')
          : createdDiagnosisList[0];
        if (!treatmentDiagnosis)
          throw new BadRequestException(
            'Enrollment treatment requires a valid diagnosis reference',
          );
        const treatmentValues = { ...treatment };
        delete treatmentValues.diagnosisRef;
        await this.treatments.create(
          patient.id,
          {
            ...treatmentValues,
            followUpId: followUp.id,
            diagnosisId: treatmentDiagnosis.id,
          },
          manager,
        );
      }
      for (const appointment of medicalAppointments ?? []) {
        const appointmentInput = {
          ...appointment,
          isFirstConsultation:
            symptomReport?.consultationStatus ===
            MedicalConsultationStatus.ATTENDED
              ? true
              : appointment.isFirstConsultation,
          followUpId: followUp.id,
        };
        if (options.historical)
          await this.appointments.createHistorical(
            {
              ...appointmentInput,
              patientId: patient.id,
              status:
                symptomReport?.consultationStatus ===
                MedicalConsultationStatus.ATTENDED
                  ? MedicalAppointmentStatus.COMPLETED
                  : MedicalAppointmentStatus.SCHEDULED,
            },
            historicalLoadedById!,
            manager,
          );
        else
          await this.appointments.create(
            patient.id,
            appointmentInput,
            manager,
            symptomReport?.consultationStatus !==
              MedicalConsultationStatus.ATTENDED,
          );
      }
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
      if (psychooncologySupportAssessment)
        await this.psychooncologySupportAssessments.create(
          patient.id,
          { ...psychooncologySupportAssessment, followUpId: followUp.id },
          manager,
        );
      if (healthPhase === PatientHealthPhase.SIGNS_AND_SYMPTOMS)
        await this.diagnosticStatuses.recordSearching(
          patient.id,
          followUp.id,
          manager,
        );
      for (const address of addresses ?? [])
        await this.addresses.create(
          patient.id,
          { ...address, followUpId: followUp.id },
          manager,
        );

      await this.invalidations.markDirty(patient.id, manager);
      if (!options.historical)
        // Cita webhooks for medicalAppointments are already dispatched by
        // this.appointments.create() above; only Registro needs firing here.
        await this.webhooks.enqueue(
          buildRegistroEnvelope({
            fullName: patient.fullName,
            dni: patient.dni ?? '',
            phone: patient.primaryPhone,
            email: patient.email,
            diagnosis:
              diagnosis?.diagnosis ??
              diagnoses?.map(({ diagnosis: value }) => value).join(', ') ??
              'En evaluación',
            // patient.role was just set to PATIENT above (the companion, if
            // any, is enrolled separately and never gets its own Registro).
            condition: 'paciente',
          }),
          manager,
        );
      return { ...enrollment, patient, companion, followUp };
    });
  }

  async createHistorical(
    input: HistoricalEnrollmentInput,
    userId: string,
    userRole: string,
  ) {
    return this.create(input, userId, userRole, {
      historical: true,
      historicalLoadedById: userId,
    });
  }

  async findAll(patientId: string, user: User) {
    await this.patients.assertCanRead(patientId, user);
    return this.enrollments.find({
      where: { patientId },
      order: { enrolledOn: 'DESC', createdAt: 'DESC', id: 'DESC' },
    });
  }

  async findFamilyTalkInterests(filters: {
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const query = this.familyTalkInterests
      .createQueryBuilder('interest')
      .innerJoinAndSelect('interest.enrollment', 'enrollment')
      .innerJoinAndSelect('enrollment.patient', 'patient')
      .orderBy('interest.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (filters.search?.trim()) {
      const search = `%${filters.search.trim()}%`;
      query.andWhere(
        '(interest.familyMemberName ILIKE :search OR patient.fullName ILIKE :search)',
        { search },
      );
    }

    const [data, total] = await query.getManyAndCount();
    return { data, total };
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

  private validateContacts(contacts: EnrollmentContactInputDto[] | undefined) {
    if (contacts === undefined) return;
    if (
      contacts.filter(
        (contact) => contact.role === CompanionContactRole.PRIMARY,
      ).length !== 1
    )
      throw new BadRequestException(
        'contacts must contain exactly one PRIMARY contact',
      );
    if (
      contacts.filter(
        (contact) => contact.role === CompanionContactRole.SECONDARY,
      ).length > 1
    )
      throw new BadRequestException(
        'contacts may contain at most one SECONDARY contact',
      );
    if (
      contacts.filter(
        (contact) => contact.source === EnrollmentContactSource.CALLER,
      ).length > 1
    )
      throw new BadRequestException(
        'contacts may contain the CALLER source only once',
      );
    for (const contact of contacts) {
      if (
        contact.source === EnrollmentContactSource.PATIENT &&
        contact.role !== CompanionContactRole.PRIMARY
      )
        throw new BadRequestException(
          'PATIENT can only be the PRIMARY contact',
        );
      if (contact.source === EnrollmentContactSource.NEW && !contact.person)
        throw new BadRequestException('NEW contact requires person');
      if (contact.source !== EnrollmentContactSource.NEW && contact.person)
        throw new BadRequestException('Only NEW contact accepts person');
    }
  }

  private validateContactAgeRules(
    patient: Patient,
    contacts: EnrollmentContactInputDto[] | undefined,
  ) {
    if (!contacts) return;
    const primary = contacts.find(
      (contact) => contact.role === CompanionContactRole.PRIMARY,
    )!;
    if (primary.source !== EnrollmentContactSource.PATIENT) return;
    if (!patient.primaryPhone?.trim())
      throw new BadRequestException(
        'PATIENT cannot be the primary contact without a phone number',
      );
    if (!patient.birthDate || this.isMinor(patient.birthDate))
      throw new BadRequestException(
        'PATIENT can only be the primary contact for an adult patient',
      );
  }

  private isMinor(birthDate: string): boolean {
    const birth = new Date(`${birthDate}T00:00:00Z`);
    const today = new Date();
    let age = today.getUTCFullYear() - birth.getUTCFullYear();
    if (
      today.getUTCMonth() < birth.getUTCMonth() ||
      (today.getUTCMonth() === birth.getUTCMonth() &&
        today.getUTCDate() < birth.getUTCDate())
    )
      age -= 1;
    return age < 18;
  }

  private validateClinicalBranches(
    input: CreateEnrollmentDto | HistoricalEnrollmentInput,
  ) {
    const { symptomReport, medicalAppointments, healthPhase } = input;
    if (
      input.psychooncologySupportAssessment &&
      (healthPhase !== PatientHealthPhase.CANCER_DIAGNOSIS ||
        input.affiliationType !== AffiliationType.SELF)
    )
      throw new BadRequestException(
        'Psycho-oncology support assessment requires a self enrollment with a cancer diagnosis',
      );
    if (input.diagnosis && input.diagnoses)
      throw new BadRequestException(
        'Provide either diagnosis or diagnoses, not both',
      );
    if (
      healthPhase === PatientHealthPhase.CANCER_DIAGNOSIS &&
      !input.diagnosis &&
      !input.diagnoses?.length
    )
      throw new BadRequestException(
        'Cancer diagnosis enrollment requires at least one diagnosis',
      );
    if (input.diagnoses) {
      const refs = input.diagnoses.map(({ clientRef }) => clientRef);
      if (refs.some((ref) => !ref))
        throw new BadRequestException(
          'Every enrollment diagnosis requires a clientRef',
        );
      if (new Set(refs).size !== refs.length)
        throw new BadRequestException(
          'Enrollment diagnosis clientRefs must be unique',
        );
      for (const treatment of input.treatments ?? [])
        if (!treatment.diagnosisRef)
          throw new BadRequestException(
            'Every enrollment treatment requires a diagnosisRef',
          );
      const diagnosisRefs = new Set(refs);
      for (const treatment of input.treatments ?? [])
        if (
          treatment.diagnosisRef &&
          !diagnosisRefs.has(treatment.diagnosisRef)
        )
          throw new BadRequestException(
            'Enrollment treatment diagnosisRef does not match a diagnosis',
          );
    }
    if (healthPhase === PatientHealthPhase.SIGNS_AND_SYMPTOMS) {
      if (!symptomReport)
        throw new BadRequestException(
          'Signs and symptoms enrollment requires a symptom report',
        );
      if (typeof symptomReport.hasDiscomfort !== 'boolean')
        throw new BadRequestException(
          'Signs and symptoms enrollment requires a discomfort answer',
        );
      if (typeof symptomReport.hasRequestedMedicalConsultation !== 'boolean')
        throw new BadRequestException(
          'Signs and symptoms enrollment requires a consultation request answer',
        );
      if (typeof symptomReport.hasReceivedDiagnosis !== 'boolean')
        throw new BadRequestException(
          'Signs and symptoms enrollment requires a diagnosis answer',
        );
      if (typeof symptomReport.isReceivingReportedTreatment !== 'boolean')
        throw new BadRequestException(
          'Signs and symptoms enrollment requires a treatment answer',
        );
    }
    if (
      healthPhase === PatientHealthPhase.SIGNS_AND_SYMPTOMS &&
      (input.diagnosis || input.diagnoses?.length || input.treatments?.length)
    )
      throw new BadRequestException(
        'Signs and symptoms enrollment cannot create formal diagnoses or treatments',
      );
    if (healthPhase === PatientHealthPhase.CANCER_DIAGNOSIS) {
      if (typeof input.currentlyAttendingConsultations !== 'boolean')
        throw new BadRequestException(
          'Cancer diagnosis enrollment requires a consultation attendance answer',
        );
      if (typeof input.currentlyReceivingTreatment !== 'boolean')
        throw new BadRequestException(
          'Cancer diagnosis enrollment requires a current treatment answer',
        );
      if (input.currentlyAttendingConsultations === true) {
        if (medicalAppointments?.length !== 1)
          throw new BadRequestException(
            'Attending consultations requires exactly one appointment',
          );
        if (!medicalAppointments[0].healthCenterId)
          throw new BadRequestException(
            'Attending consultations requires a health center',
          );
      } else if (input.currentlyAttendingConsultations === false) {
        if (medicalAppointments?.length)
          throw new BadRequestException(
            'No appointment is allowed when the patient does not attend consultations',
          );
        if (!input.notAttendingConsultationsNote?.trim())
          throw new BadRequestException(
            'Not attending consultations requires a note',
          );
      }
      if (
        input.currentlyReceivingTreatment === false &&
        !input.notReceivingTreatmentReason?.trim()
      )
        throw new BadRequestException(
          'Not receiving treatment requires a reason',
        );
      if (
        input.currentlyReceivingTreatment === false &&
        input.treatments?.length
      )
        throw new BadRequestException(
          'A patient not receiving treatment cannot include treatments',
        );
    }
    if (symptomReport?.hasRequestedMedicalConsultation === false) {
      if (medicalAppointments?.length)
        throw new BadRequestException(
          'No appointment is allowed when no consultation was requested',
        );
      return;
    }
    if (
      symptomReport?.consultationStatus ===
      MedicalConsultationStatus.NOT_OBTAINED
    ) {
      if (medicalAppointments?.length)
        throw new BadRequestException(
          'NOT_OBTAINED consultation cannot include an appointment',
        );
      return;
    }
    if (
      symptomReport?.consultationStatus !==
        MedicalConsultationStatus.SCHEDULED &&
      symptomReport?.consultationStatus !== MedicalConsultationStatus.ATTENDED
    )
      return;
    if (medicalAppointments?.length !== 1)
      throw new BadRequestException(
        'Scheduled or attended consultation requires exactly one appointment',
      );
    const appointment = medicalAppointments[0];
    if (
      !appointment.appointmentDate ||
      appointment.healthCenterId !== symptomReport.healthCenterId ||
      appointment.specialty !== symptomReport.specialty
    )
      throw new BadRequestException(
        'Consultation appointment must include the same establishment, specialty, and a date',
      );
    if (
      symptomReport.consultationStatus === MedicalConsultationStatus.SCHEDULED
    ) {
      if (appointment.hasReferralSheet !== undefined)
        throw new BadRequestException(
          'Referral information is only allowed for attended consultations',
        );
    } else if (appointment.hasReferralSheet === undefined) {
      throw new BadRequestException(
        'Attended consultation requires a referral sheet answer',
      );
    } else if (
      appointment.hasReferralSheet === false &&
      !appointment.referralNotProvidedReason?.trim()
    ) {
      throw new BadRequestException(
        'Attended consultation requires a reason when no referral sheet was provided',
      );
    }
  }
}
