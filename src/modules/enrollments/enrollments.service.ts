import { AuditContextKind } from '../../shared/audit/audit-context';
import { AuditContextService } from '../../shared/audit/audit-context.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
} from 'typeorm';
import {
  enrollmentDbDriverError,
  translateEnrollmentQueryError,
} from './enrollment-db-error';
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
import { PatientHealthSubcategoryService } from '../patients/health-subcategory/patient-health-subcategory.service';
import { savePatientOrDniConflict } from '../patients/patient-dni-conflict';
import { PatientActivityStatus } from '../../database/entities/patient-activity-status.enum';
import { PatientDetails } from '../../database/entities/patient-details.entity';
import { PatientHealthSubcategory } from '../../database/entities/patient-health-subcategory.enum';
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
import { PatientNonOncologicalFollowUpsService } from '../patients/clinical/non-oncological-follow-up/patient-non-oncological-follow-ups.service';
import { CatalogsService } from '../catalogs/catalogs.service';
import { CatalogValueService } from '../catalogs/catalog-value.service';
import type { HistoricalEnrollmentInput } from '../historical-records/dto/create-historical-enrollment.dto';
import { dateOnlyInLima } from '../../shared/date-only/date-only.util';

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
    private readonly nonOncologicalFollowUps: PatientNonOncologicalFollowUpsService,
    private readonly diagnosticStatuses: PatientDiagnosticStatusesService,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly webhooks: N8nTransactionalDispatchService,
    private readonly catalogValues: CatalogValueService,
    private readonly catalogs: CatalogsService,
    private readonly audit: AuditContextService,
    private readonly subcategories: PatientHealthSubcategoryService,
  ) {}

  private readonly logger = new Logger(EnrollmentsService.name);

  async create(
    input: EnrollmentInput,
    userId: string,
    userRole: string,
    options: EnrollmentCreateOptions = {},
  ) {
    try {
      return await this.createInTransaction(input, userId, userRole, options);
    } catch (error) {
      const translated = translateEnrollmentQueryError(error);
      if (!translated) throw error;
      const driver = error instanceof QueryFailedError
        ? enrollmentDbDriverError(error)
        : undefined;
      this.logger.warn(
        `Enrollment database constraint ${driver?.code ?? 'unknown'} ${driver?.constraint ?? ''} ${driver?.table ?? ''}`.trim(),
      );
      throw translated;
    }
  }

  private async createInTransaction(
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
        diagnoses,
        treatments,
        medicalAppointments,
        symptomReport,
        healthBackgroundAssessment,
        psychooncologySupportAssessment,
        nonOncologicalFollowUp,
        familyPreventionTalkInterests,
        healthPhase: requestedHealthPhase,
        addresses,
        enrolledOn,
        ...metadata
      } = input;
      const healthPhase = (
        await this.catalogValues.resolve(
          'patient_health_phase',
          requestedHealthPhase,
          { manager },
        )
      ).code;
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
      this.validateContacts(contacts);
      this.validateClinicalBranches(input, options.historical ?? false);
      if (
        healthPhase !== PatientHealthPhase.CANCER_DIAGNOSIS &&
        healthPhase !== PatientHealthPhase.SIGNS_AND_SYMPTOMS
      ) {
        throw new BadRequestException(
          'Elige si el paciente tiene diagnóstico de cáncer o signos y síntomas.',
        );
      }
      if (!patientId && !patientInput)
        throw new BadRequestException('Selecciona o registra al paciente.');
      const hasCompanion = Boolean(companionId || companionInput);
      if (
        input.affiliationType === AffiliationType.FAMILY_FRIEND &&
        Boolean(companionId) === Boolean(companionInput)
      )
        throw new BadRequestException(
          'Si quien enrola es familiar o amigo, registra un acompañante.',
        );
      if (insurance?.insuranceType === InsuranceType.SIS && sisAffiliation)
        throw new ConflictException({
          code: 'SIS_AFFILIATION_CONFLICT',
          message:
            'Un paciente con SIS no puede tener además un trámite de afiliación al SIS.',
        });

      let patient = patientId
        ? await manager
            .getRepository(Patient)
            .createQueryBuilder('patient')
            .setLock('pessimistic_write')
            .where('patient.id = :id', { id: patientId })
            .getOne()
        : await this.patients.create(patientInput!, manager);
      if (!patient) throw new NotFoundException('No se encontró el paciente.');
      const reenrollment =
        patientId && patient.status !== PatientStatus.UNENROLLED
          ? await this.assertReenrollable(patient, manager, options)
          : null;
      if (patientId && patientInput) {
        if (!reenrollment)
          throw new BadRequestException(
            'Los datos del paciente solo se envían al reenrolar.',
          );
        patient = await savePatientOrDniConflict(
          manager.getRepository(Patient),
          Object.assign(patient, patientInput),
        );
      }
      this.validateContactAgeRules(patient, contacts);
      if (
        patient.role !== PatientRole.UNKNOWN &&
        patient.role !== PatientRole.PATIENT
      )
        throw new ConflictException({
          code: 'PATIENT_ROLE_INVALID',
          message: 'Solo se puede enrolar a un paciente.',
        });

      patient.role = PatientRole.PATIENT;
      patient.status = PatientStatus.ENROLLED;
      await manager.getRepository(Patient).save(patient);

      let companion: Patient | null = null;
      if (hasCompanion) {
        const isFamily =
          input.affiliationType === AffiliationType.FAMILY_FRIEND;
        // Contact roles come only from contacts[]; the caller is linked plain.
        const normalizedCompanion = companionInput
          ? {
              ...companionInput,
              isPrimaryInformant: isFamily,
              isPrimaryContact: false,
              contactRole: null,
              isCaregiver: companionInput.isCaregiver ?? false,
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
                isPrimaryContact: false,
                contactRole: null,
                isCaregiver: false,
              },
              manager,
            );
          else if (isFamily) {
            link.isPrimaryInformant = true;
            await links.save(link);
          }
        }
      }

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
              'Selecciona al acompañante que llamó.',
            );
          const link = await links.findOneByOrFail({
            patientId: patient.id,
            companionId: companion.id,
          });
          link.contactRole = contact.role;
          link.isPrimaryContact = contact.role === CompanionContactRole.PRIMARY;
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

      await this.patients.upsertDetails(
        patient.id,
        { ...details, healthPhase },
        manager,
        // A historical enrollment's phase started on the real enrollment date,
        // not on the day it was loaded.
        options.historical && enrolledOn
          ? { changedAt: new Date(`${enrolledOn}T12:00:00-05:00`) }
          : {},
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
      // Everything this enrollment writes (the new patient included) belongs
      // to its follow-up in the change log.
      await this.audit.attachFollowUp(
        manager,
        followUp.id,
        options.historical
          ? AuditContextKind.HISTORICAL_LOAD
          : AuditContextKind.FOLLOW_UP,
      );
      if (reenrollment?.reactivate)
        Object.assign(
          patient,
          await this.patients.reactivate(
            patient.id,
            { followUpId: followUp.id },
            manager,
          ),
        );
      const enrollmentRepository = manager.getRepository(Enrollment);
      const resolvedEntrySource = await this.catalogValues.resolveOptional(
        'entry_source',
        metadata.entrySource,
        { manager },
      );
      const resolvedEntrySubSource = await this.catalogValues.resolveOptional(
        'entry_sub_source',
        metadata.entrySubSource,
        { manager },
      );
      if (resolvedEntrySource && resolvedEntrySubSource) {
        const subItems = await this.catalogs.findAll('entry_sub_source');
        const subItem = subItems.find(
          (item) => item.code === resolvedEntrySubSource.code,
        );
        if (
          subItem?.parentCode &&
          subItem.parentCode !== resolvedEntrySource.code
        ) {
          throw new BadRequestException(
            'El subcanal no corresponde al canal de ingreso elegido.',
          );
        }
      }
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
        entrySource:
          metadata.entrySource !== undefined
            ? (resolvedEntrySource?.code ?? null)
            : metadata.entrySource,
        entrySubSource:
          metadata.entrySubSource !== undefined
            ? (resolvedEntrySubSource?.code ?? null)
            : metadata.entrySubSource,
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
      for (const diagnosisInput of diagnoses ?? []) {
        const { clientRef, ...diagnosisValues } = diagnosisInput;
        const createdDiagnosis = await this.diagnoses.create(
          patient.id,
          { ...diagnosisValues, followUpId: followUp.id },
          manager,
        );
        if (clientRef) createdDiagnoses.set(clientRef, createdDiagnosis);
      }
      for (const treatment of treatments ?? []) {
        const treatmentDiagnosis = createdDiagnoses.get(
          treatment.diagnosisRef ?? '',
        );
        if (!treatmentDiagnosis)
          throw new BadRequestException(
            'Cada tratamiento debe estar vinculado a un diagnóstico.',
          );
        const { diagnosisRef: _diagnosisRef, ...treatmentValues } = treatment;
        await this.treatments.create(
          patient.id,
          {
            ...treatmentValues,
            followUpId: followUp.id,
            diagnosisId: treatmentDiagnosis.id,
          },
          manager,
          { deriveSubcategory: false },
        );
      }
      if (
        healthPhase === PatientHealthPhase.CANCER_DIAGNOSIS &&
        !details?.healthSubcategory
      )
        await this.subcategories.syncFromTreatments(
          patient.id,
          manager,
          options.historical && enrolledOn
            ? { changedAt: new Date(`${enrolledOn}T12:00:00-05:00`) }
            : {},
        );
      if (healthPhase === PatientHealthPhase.SIGNS_AND_SYMPTOMS)
        await this.diagnosticStatuses.recordSearching(
          patient.id,
          followUp.id,
          manager,
        );
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
          { skipAppointmentFanOut: Boolean(medicalAppointments?.length), historical: options.historical },
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
      if (nonOncologicalFollowUp)
        await this.nonOncologicalFollowUps.create(
          patient.id,
          {
            ...nonOncologicalFollowUp,
            followUpId: followUp.id,
            enrollmentId: enrollment.id,
          },
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
              diagnoses?.map(({ diagnosis: value }) => value).join(', ') ||
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
    if (!enrollment) throw new NotFoundException('No se encontró el enrolamiento.');

    if (userRole === 'AGENT') {
      const agent = await this.agents.findOne({ where: { userId } });
      if (!agent)
        throw new BadRequestException(
          'Tu usuario no tiene perfil de agente.',
        );
      if (enrollment.followUp.agentId !== agent.id)
        throw new ForbiddenException(
          'Solo puedes modificar tus propios enrolamientos.',
        );
    }

    enrollment.followUpQualityRating = input.followUpQualityRating;
    const updated = await this.enrollments.save(enrollment);
    await this.invalidations.markDirty(updated.patientId);
    return updated;
  }

  private validateContacts(contacts: EnrollmentContactInputDto[]) {
    if (
      contacts.filter(
        (contact) => contact.role === CompanionContactRole.PRIMARY,
      ).length !== 1
    )
      throw new BadRequestException(
        'Registra un único contacto principal.',
      );
    if (
      contacts.filter(
        (contact) => contact.source === EnrollmentContactSource.CALLER,
      ).length > 1
    )
      throw new BadRequestException(
        'Solo puede haber una persona que llamó.',
      );
    for (const contact of contacts) {
      if (
        contact.source === EnrollmentContactSource.PATIENT &&
        contact.role !== CompanionContactRole.PRIMARY
      )
        throw new BadRequestException(
          'El paciente solo puede ser el contacto principal.',
        );
      if (contact.source === EnrollmentContactSource.NEW && !contact.person)
        throw new BadRequestException('Completa los datos del nuevo contacto.');
      if (contact.source !== EnrollmentContactSource.NEW && contact.person)
        throw new BadRequestException('Solo un contacto nuevo admite datos de persona.');
    }
  }

  /**
   * E5/E6: an enrolled patient who calls again gets a follow-up, unless they
   * left the program or had cancer ruled out; then they enroll again.
   */
  private async assertReenrollable(
    patient: Patient,
    manager: EntityManager,
    options: EnrollmentCreateOptions,
  ): Promise<{ reactivate: boolean } | null> {
    const reactivate = patient.activityStatus === PatientActivityStatus.INACTIVE;
    if (reactivate) return { reactivate };
    const details = await manager
      .getRepository(PatientDetails)
      .findOne({ where: { patientId: patient.id } });
    if (details?.healthSubcategory === PatientHealthSubcategory.CANCER_RULED_OUT)
      return { reactivate };
    if (options.historical) return null;
    throw new ConflictException({
      code: 'PATIENT_ALREADY_ENROLLED',
      message:
        'El paciente ya está enrolado y activo; registra un seguimiento.',
    });
  }

  private validateContactAgeRules(
    patient: Patient,
    contacts: EnrollmentContactInputDto[],
  ) {
    const primary = contacts.find(
      (contact) => contact.role === CompanionContactRole.PRIMARY,
    )!;
    if (primary.source !== EnrollmentContactSource.PATIENT) return;
    if (!patient.primaryPhone?.trim())
      throw new BadRequestException(
        'Para que el paciente sea el contacto principal, registra su teléfono.',
      );
    if (!patient.birthDate || this.isMinor(patient.birthDate))
      throw new BadRequestException(
        'El paciente solo puede ser contacto principal si es mayor de edad.',
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
    historical = false,
  ) {
    const { symptomReport, medicalAppointments, healthPhase } = input;
    if (input.psychooncologySupportAssessment) {
      if (healthPhase !== PatientHealthPhase.CANCER_DIAGNOSIS)
        throw new BadRequestException(
          'La evaluación de psicooncología necesita un diagnóstico de cáncer.',
        );
      // Historical records may carry the patient's answers even when a
      // relative made the call; live enrollments ask the patient directly.
      if (!historical && input.affiliationType !== AffiliationType.SELF)
        throw new BadRequestException(
          'La evaluación de psicooncología solo aplica si el propio paciente se enrola con diagnóstico de cáncer.',
        );
    }
    if (
      healthPhase === PatientHealthPhase.CANCER_DIAGNOSIS &&
      !input.diagnoses?.length
    )
      throw new BadRequestException(
        'Registra al menos un diagnóstico.',
      );
    const refs = (input.diagnoses ?? []).map(({ clientRef }) => clientRef);
    if (refs.some((ref) => !ref))
      throw new BadRequestException(
        'Hay un diagnóstico incompleto en el enrolamiento.',
      );
    if (new Set(refs).size !== refs.length)
      throw new BadRequestException(
        'Hay diagnósticos repetidos en el enrolamiento.',
      );
    for (const treatment of input.treatments ?? [])
      if (!treatment.diagnosisRef || !refs.includes(treatment.diagnosisRef))
        throw new BadRequestException(
          'Un tratamiento está vinculado a un diagnóstico que no existe.',
        );
    if (healthPhase === PatientHealthPhase.SIGNS_AND_SYMPTOMS) {
      if (!symptomReport)
        throw new BadRequestException(
          'Registra los síntomas del paciente.',
        );
      if (symptomReport.hasDiscomfort === undefined)
        throw new BadRequestException(
          'Indica si el paciente tiene molestias.',
        );
      if (symptomReport.hasMedicalConsultation !== undefined) {
        if (typeof symptomReport.hasMedicalConsultation !== 'boolean')
          throw new BadRequestException(
            'Indica si el paciente tuvo consulta médica.',
          );
        if (
          symptomReport.hasMedicalConsultation === true &&
          (symptomReport.hasReferral === undefined ||
            typeof symptomReport.hasReceivedDiagnosis !== 'boolean')
        )
          throw new BadRequestException(
            'Si la consulta se realizó, indica si hubo referencia y diagnóstico.',
          );
      } else {
        if (typeof symptomReport.hasRequestedMedicalConsultation !== 'boolean')
          throw new BadRequestException(
            'Indica si se pidió una consulta.',
          );
        if (typeof symptomReport.hasReceivedDiagnosis !== 'boolean')
          throw new BadRequestException(
            'Indica si recibió un diagnóstico.',
          );
        if (typeof symptomReport.isReceivingReportedTreatment !== 'boolean')
          throw new BadRequestException(
            'Indica si el paciente recibe tratamiento.',
          );
      }
    }
    if (
      healthPhase === PatientHealthPhase.SIGNS_AND_SYMPTOMS &&
      (input.diagnoses?.length || input.treatments?.length)
    )
      throw new BadRequestException(
        'Un paciente con signos y síntomas no puede tener diagnósticos ni tratamientos formales.',
      );
    if (healthPhase === PatientHealthPhase.CANCER_DIAGNOSIS) {
      if (typeof input.currentlyAttendingConsultations !== 'boolean')
        throw new BadRequestException(
          'Indica si el paciente asiste a sus consultas.',
        );
      if (typeof input.currentlyReceivingTreatment !== 'boolean')
        throw new BadRequestException(
          'Indica si el paciente recibe tratamiento.',
        );
      if (input.currentlyAttendingConsultations === true) {
        if (medicalAppointments?.length !== 1)
          throw new BadRequestException(
            'Registra una cita para la consulta.',
          );
        if (!medicalAppointments[0].healthCenterId)
          throw new BadRequestException(
            'Selecciona el establecimiento donde se atiende.',
          );
      } else if (input.currentlyAttendingConsultations === false) {
        if (medicalAppointments?.length)
          throw new BadRequestException(
            'Si el paciente no asiste a consultas, no registres una cita.',
          );
        if (!input.notAttendingConsultationsNote?.trim())
          throw new BadRequestException(
            'Si el paciente no asiste a consultas, agrega una nota.',
          );
      }
      if (
        input.currentlyReceivingTreatment === false &&
        !input.notReceivingTreatmentReason?.trim()
      )
        throw new BadRequestException(
          'Indica por qué el paciente no recibe tratamiento.',
        );
      if (
        input.currentlyReceivingTreatment === false &&
        input.treatments?.length
      )
        throw new BadRequestException(
          'Si el paciente no recibe tratamiento, no registres tratamientos.',
        );
    }
    if (symptomReport?.hasMedicalConsultation !== undefined) {
      if (
        symptomReport.hasMedicalConsultation === false &&
        medicalAppointments?.length
      )
        throw new BadRequestException(
          'Si el paciente no tuvo consulta médica, no registres una cita.',
        );
      return;
    }
    if (symptomReport?.hasRequestedMedicalConsultation === false) {
      if (medicalAppointments?.length)
        throw new BadRequestException(
          'Si no se pidió consulta, no registres una cita.',
        );
      return;
    }
    if (
      symptomReport?.consultationStatus ===
      MedicalConsultationStatus.NOT_OBTAINED
    ) {
      if (medicalAppointments?.length)
        throw new BadRequestException(
          'Si no se obtuvo la consulta, no registres una cita.',
        );
      return;
    }
    if (
      symptomReport?.consultationStatus !==
        MedicalConsultationStatus.SCHEDULED &&
      symptomReport?.consultationStatus !== MedicalConsultationStatus.ATTENDED
    )
      return;
    if (!medicalAppointments?.length) return;
    if (medicalAppointments.length !== 1)
      throw new BadRequestException(
        'Registra la cita de la consulta.',
      );
    const appointment = medicalAppointments[0];
    if (
      !appointment.appointmentDate ||
      appointment.healthCenterId !== symptomReport.healthCenterId ||
      appointment.specialty !== symptomReport.specialty
    )
      throw new BadRequestException(
        'La cita de la consulta debe tener el mismo establecimiento, la especialidad y una fecha.',
      );
    if (
      symptomReport.consultationStatus === MedicalConsultationStatus.SCHEDULED
    ) {
      if (appointment.hasReferralSheet !== undefined)
        throw new BadRequestException(
          'La referencia solo se registra si la consulta se realizó.',
        );
    } else if (appointment.hasReferralSheet === undefined) {
      throw new BadRequestException(
        'Indica si hubo hoja de referencia.',
      );
    } else if (
      appointment.hasReferralSheet === false &&
      !appointment.referralNotProvidedReason?.trim()
    ) {
      throw new BadRequestException(
        'Si no hubo hoja de referencia, indica el motivo.',
      );
    }
  }
}
