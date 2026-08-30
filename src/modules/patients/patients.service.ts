import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { PatientSummary } from '../../database/entities/patient-summary.entity';
import { PatientSummaryInvalidationService } from '../patient-summaries/patient-summary-invalidation.service';
import { CompanionPatient } from '../../database/entities/companion-patient.entity';
import { DeactivationReason } from '../../database/entities/deactivation-reason.enum';
import { PatientActivityStatus } from '../../database/entities/patient-activity-status.enum';
import { PatientDetails } from '../../database/entities/patient-details.entity';
import { PatientDiagnosis } from '../../database/entities/patient-diagnosis.entity';
import { PatientHealthPhaseHistory } from '../../database/entities/patient-health-phase-history.entity';
import { PatientInsurance } from '../../database/entities/patient-insurance.entity';
import { PatientMedicalAppointment } from '../../database/entities/patient-medical-appointment.entity';
import { PatientListSegment } from '../../database/entities/patient-list-segment.enum';
import { PatientRole } from '../../database/entities/patient-role.enum';
import { PatientSisAffiliation } from '../../database/entities/patient-sis-affiliation.entity';
import { PatientStatus } from '../../database/entities/patient-status.enum';
import { PatientSymptomReport } from '../../database/entities/patient-symptom-report.entity';
import { PatientTreatment } from '../../database/entities/patient-treatment.entity';
import { PatientHealthBackgroundAssessment } from '../../database/entities/patient-health-background-assessment.entity';
import { Patient } from '../../database/entities/patient.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { CreateCompanionDto } from './dto/create-companion.dto';
import { CreatePatientDto } from './dto/create-patient.dto';
import { DeactivatePatientDto } from './dto/deactivate-patient.dto';
import { ListPatientsDto } from './dto/list-patients.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpsertPatientDetailsDto } from './dto/upsert-patient-details.dto';
import { LinkCompanionDto } from './dto/link-companion.dto';
import { UpdateCompanionLinkDto } from './dto/update-companion-link.dto';
import { User } from '../../database/entities/user.entity';
import { PatientAccessService } from './access/patient-access.service';
import { N8nTransactionalDispatchService } from '../../integrations/n8n/transactional-dispatch.service';
import { buildRegistroEnvelope } from '../../integrations/n8n/n8n-webhook.payloads';
import { PatientAddress } from '../../database/entities/patient-address.entity';
import { HealthCenter } from '../../database/entities/health-center.entity';
import { normalizeDuration } from '../../shared/duration/duration.util';
import { CompanionContactRole } from '../../database/entities/companion-contact-role.enum';
import { PatientPsychooncologySupportAssessment } from '../../database/entities/patient-psychooncology-support-assessment.entity';

function resolveContactRole(
  contactRole: CompanionContactRole | null | undefined,
  isPrimaryContact: boolean | undefined,
  fallback: CompanionContactRole | null,
): CompanionContactRole | null {
  if (contactRole !== undefined) return contactRole;
  if (isPrimaryContact !== undefined)
    return isPrimaryContact ? CompanionContactRole.PRIMARY : null;
  return fallback;
}

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientsRepository: Repository<Patient>,
    @InjectRepository(PatientDetails)
    private readonly detailsRepository: Repository<PatientDetails>,
    @InjectRepository(PatientHealthPhaseHistory)
    private readonly healthPhaseHistoryRepository: Repository<PatientHealthPhaseHistory>,
    @InjectRepository(CompanionPatient)
    private readonly companionPatientsRepository: Repository<CompanionPatient>,
    @InjectRepository(PatientSummary)
    private readonly summaries: Repository<PatientSummary>,
    @InjectRepository(PatientDiagnosis)
    private readonly diagnosesRepository: Repository<PatientDiagnosis>,
    @InjectRepository(PatientTreatment)
    private readonly treatmentsRepository: Repository<PatientTreatment>,
    @InjectRepository(PatientInsurance)
    private readonly insuranceRepository: Repository<PatientInsurance>,
    @InjectRepository(PatientMedicalAppointment)
    private readonly medicalAppointmentsRepository: Repository<PatientMedicalAppointment>,
    @InjectRepository(PatientSisAffiliation)
    private readonly sisAffiliationsRepository: Repository<PatientSisAffiliation>,
    @InjectRepository(PatientSymptomReport)
    private readonly symptomReportsRepository: Repository<PatientSymptomReport>,
    @InjectRepository(FollowUp)
    private readonly followUpsRepository: Repository<FollowUp>,
    @InjectRepository(PatientAddress)
    private readonly addressesRepository: Repository<PatientAddress>,
    @InjectRepository(PatientHealthBackgroundAssessment)
    private readonly healthBackgroundAssessmentsRepository: Repository<PatientHealthBackgroundAssessment>,
    @InjectRepository(PatientPsychooncologySupportAssessment)
    private readonly psychooncologySupportAssessmentsRepository: Repository<PatientPsychooncologySupportAssessment>,
    private readonly dataSource: DataSource,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly access: PatientAccessService,
    private readonly webhooks: N8nTransactionalDispatchService,
  ) {}

  assertCanRead(patientId: string, user: User): Promise<void> {
    return this.access.assertCanRead(patientId, user);
  }

  async assertPatientRole(
    patientId: string,
    expectedRole: PatientRole,
    expectedStatus?: PatientStatus,
    manager?: EntityManager,
  ): Promise<Patient> {
    const repository =
      manager?.getRepository(Patient) ?? this.patientsRepository;
    const patient = await repository.findOne({
      where: { id: patientId },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    if (
      patient.role !== expectedRole ||
      (expectedStatus && patient.status !== expectedStatus)
    ) {
      throw new ConflictException(
        'Patient does not meet the required role or status',
      );
    }
    return patient;
  }

  async create(
    input: CreatePatientDto,
    manager?: EntityManager,
  ): Promise<Patient> {
    const repository =
      manager?.getRepository(Patient) ?? this.patientsRepository;
    const patient = await repository.save(repository.create({ ...input }));
    await this.invalidations.markDirty(patient.id, manager);
    // Only fire here when called directly (no manager): the enrollment
    // flow creates its own patient and dispatches its own Registro with
    // the real diagnosis, so firing here too would send a duplicate.
    if (!manager) {
      await this.webhooks.enqueue(
        buildRegistroEnvelope({
          fullName: patient.fullName,
          dni: patient.dni ?? '',
          phone: patient.primaryPhone,
          email: patient.email,
          diagnosis: 'En evaluación',
          // CreatePatientDto has no `role` field — every patient created
          // through this path is `paciente`. Companions are always created
          // through createCompanion() below, which sends its own Registro.
          condition: 'paciente',
        }),
      );
    }
    return patient;
  }

  async createCompanion(
    patientId: string,
    input: CreateCompanionDto,
    manager?: EntityManager,
    user?: User,
  ): Promise<Patient> {
    if (user && user.role === UserRole.VOLUNTEER)
      await this.access.assertCanRead(patientId, user);
    await this.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      PatientStatus.ENROLLED,
      manager,
    );
    if (manager)
      return this.createCompanionWithManager(patientId, input, manager);
    // Only fire here when called directly (no manager): the enrollment
    // flow creates its own patient + companion within its own transaction
    // and dispatches a single Registro for the enrolled patient, so this
    // avoids sending a second one for the companion mid-enrollment —
    // fpc-back never notified n8n about companions created that way either.
    return this.dataSource.transaction(async (manager) => {
      const companion = await this.createCompanionWithManager(
        patientId,
        input,
        manager,
      );
      await this.webhooks.enqueue(
        buildRegistroEnvelope({
          fullName: companion.fullName,
          dni: companion.dni ?? '',
          phone: companion.primaryPhone,
          email: companion.email,
          diagnosis: 'En evaluación',
          condition: 'acompañante',
        }),
        manager,
      );
      return companion;
    });
  }

  async linkCompanion(
    patientId: string,
    input: LinkCompanionDto,
    manager?: EntityManager,
  ): Promise<CompanionPatient> {
    await this.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      PatientStatus.ENROLLED,
      manager,
    );
    await this.assertPatientRole(
      input.existingCompanionId,
      PatientRole.COMPANION,
      undefined,
      manager,
    );
    const repository =
      manager?.getRepository(CompanionPatient) ??
      this.companionPatientsRepository;
    const existing = await repository.findOne({
      where: { companionId: input.existingCompanionId, patientId },
    });
    if (existing)
      throw new ConflictException(
        'Companion is already linked to this patient',
      );
    const contactRole = resolveContactRole(
      input.contactRole,
      input.isPrimaryContact,
      null,
    );
    if (contactRole)
      await repository.update(
        { patientId, contactRole },
        { contactRole: null, isPrimaryContact: false },
      );
    return repository.save(
      repository.create({
        companionId: input.existingCompanionId,
        patientId,
        isPrimaryInformant: input.isPrimaryInformant ?? false,
        contactRole,
        isPrimaryContact: contactRole === CompanionContactRole.PRIMARY,
        isCaregiver: input.isCaregiver ?? false,
        relationship: input.relationship ?? null,
      }),
    );
  }

  async updateCompanionLink(
    patientId: string,
    linkId: string,
    input: UpdateCompanionLinkDto,
  ): Promise<CompanionPatient> {
    await this.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      PatientStatus.ENROLLED,
    );
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(CompanionPatient);
      const link = await repository.findOne({
        where: { id: linkId, patientId },
        relations: { companion: true },
      });
      if (!link) throw new NotFoundException('Companion link not found');
      const contactRole = resolveContactRole(
        input.contactRole,
        input.isPrimaryContact,
        link.contactRole,
      );
      if (contactRole)
        await repository.update(
          { patientId, contactRole },
          { contactRole: null, isPrimaryContact: false },
        );
      Object.assign(link, input, {
        contactRole,
        isPrimaryContact: contactRole === CompanionContactRole.PRIMARY,
      });
      const saved = await repository.save(link);
      await this.invalidations.markDirty(patientId, manager);
      return saved;
    });
  }

  async findCompanions(
    patientId: string,
    user: User,
  ): Promise<CompanionPatient[]> {
    await this.access.assertCanRead(patientId, user);
    return this.companionPatientsRepository.find({
      where: { patientId },
      relations: { companion: true },
    });
  }
  async findAccompanies(
    companionId: string,
    user: User,
  ): Promise<CompanionPatient[]> {
    const query = this.companionPatientsRepository
      .createQueryBuilder('link')
      .leftJoinAndSelect('link.patient', 'patient')
      .where('link.companion_id = :companionId', { companionId });
    await this.access.scopeQuery(query, 'link.patient_id', user);
    return query.getMany();
  }

  async findAll(
    filters: ListPatientsDto,
    user: User,
  ): Promise<{
    data: Array<
      Patient & {
        currentDiagnosis: PatientDiagnosis | null;
        currentDepartment: string | null;
        latestFollowUp: FollowUp | null;
        healthPhase: PatientDetails['healthPhase'] | null;
        primaryCompanionName: string | null;
      }
    >;
    total: number;
  }> {
    const query = this.patientsRepository.createQueryBuilder('patient');
    await this.access.scopeQuery(query, 'patient.id', user);
    if (filters.segment === PatientListSegment.CARE) {
      query.andWhere(
        '(patient.status = :careEnrolledStatus OR patient.role = :careCompanionRole)',
        {
          careEnrolledStatus: PatientStatus.ENROLLED,
          careCompanionRole: PatientRole.COMPANION,
        },
      );
    }
    if (filters.segment === PatientListSegment.PROSPECTS) {
      query.andWhere(
        'patient.status = :prospectStatus AND patient.role != :prospectCompanionRole',
        {
          prospectStatus: PatientStatus.UNENROLLED,
          prospectCompanionRole: PatientRole.COMPANION,
        },
      );
    }
    if (filters.role)
      query.andWhere('patient.role = :role', { role: filters.role });
    if (filters.status)
      query.andWhere('patient.status = :status', { status: filters.status });
    if (filters.activityStatus)
      query.andWhere('patient.activity_status = :activityStatus', {
        activityStatus: filters.activityStatus,
      });
    if (filters.search)
      query.andWhere(
        '(patient.full_name ILIKE :search OR patient.dni ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    const [data, total] = await query
      .orderBy('patient.created_at', 'DESC')
      .addOrderBy('patient.id', 'DESC')
      .skip(filters.offset)
      .take(filters.limit)
      .getManyAndCount();
    if (!data.length) return { data: [], total };

    const patientIds = data.map((patient) => patient.id);
    const [
      primaryAddresses,
      currentDiagnoses,
      latestFollowUps,
      patientDetails,
      primaryCompanions,
    ] = await Promise.all([
      this.addressesRepository.find({
        where: { patientId: In(patientIds), isPrimary: true, isActive: true },
      }),
      this.diagnosesRepository
        .createQueryBuilder('diagnosis')
        .leftJoinAndSelect('diagnosis.healthCenter', 'healthCenter')
        .where('diagnosis.patient_id IN (:...patientIds)', { patientIds })
        .andWhere('diagnosis.is_current = true')
        .orderBy('diagnosis.patient_id', 'ASC')
        .addOrderBy('diagnosis.created_at', 'DESC')
        .addOrderBy('diagnosis.id', 'DESC')
        .getMany(),
      this.followUpsRepository
        .createQueryBuilder('followUp')
        .distinctOn(['followUp.subject_patient_id'])
        .where('followUp.subject_patient_id IN (:...patientIds)', {
          patientIds,
        })
        .orderBy('followUp.subject_patient_id', 'ASC')
        .addOrderBy(
          'COALESCE(followUp.completed_at, followUp.scheduled_at, followUp.created_at)',
          'DESC',
        )
        .addOrderBy('followUp.id', 'DESC')
        .getMany(),
      this.detailsRepository.find({
        where: { patientId: In(patientIds) },
        select: { patientId: true, healthPhase: true },
      }),
      this.companionPatientsRepository
        .createQueryBuilder('link')
        .innerJoinAndSelect('link.companion', 'companion')
        .where('link.patient_id IN (:...patientIds)', { patientIds })
        .andWhere(
          '(link.contact_role = :primaryRole OR link.is_primary_contact = true)',
          { primaryRole: CompanionContactRole.PRIMARY },
        )
        .getMany(),
    ]);
    const departments = new Map(
      primaryAddresses.map((address) => [
        address.patientId,
        address.department,
      ]),
    );
    // The list response remains singular for compatibility, so choose the
    // newest active diagnosis consistently when a patient has parallel ones.
    const diagnoses = new Map<string, PatientDiagnosis>();
    for (const diagnosis of currentDiagnoses)
      if (!diagnoses.has(diagnosis.patientId))
        diagnoses.set(diagnosis.patientId, diagnosis);
    const followUps = new Map(
      latestFollowUps.map((followUp) => [followUp.subjectPatientId, followUp]),
    );
    const healthPhases = new Map(
      patientDetails.map((details) => [details.patientId, details.healthPhase]),
    );
    const primaryCompanionNames = new Map<string, string | null>();
    for (const link of primaryCompanions) {
      if (primaryCompanionNames.has(link.patientId)) continue;
      primaryCompanionNames.set(
        link.patientId,
        link.companion?.fullName ?? null,
      );
    }
    return {
      data: data.map((patient) =>
        Object.assign(patient, {
          currentDepartment: departments.get(patient.id) ?? null,
          currentDiagnosis: diagnoses.get(patient.id) ?? null,
          latestFollowUp: followUps.get(patient.id) ?? null,
          healthPhase: healthPhases.get(patient.id) ?? null,
          primaryCompanionName: primaryCompanionNames.get(patient.id) ?? null,
        }),
      ),
      total,
    };
  }

  async findById(id: string): Promise<Patient & { summary: string | null }> {
    const patient = await this.patientsRepository.findOne({
      where: { id },
      relations: { details: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    const stored = await this.summaries.findOneBy({ patientId: id });
    return Object.assign(patient, { summary: stored?.summary ?? null });
  }

  async findByIdForUser(
    id: string,
    user: User,
  ): Promise<
    Patient & {
      summary: string | null;
      diagnoses: PatientDiagnosis[];
      treatments: PatientTreatment[];
      insurance: PatientInsurance[];
      medicalAppointments: PatientMedicalAppointment[];
      sisAffiliations: PatientSisAffiliation[];
      symptomReports: PatientSymptomReport[];
      healthBackgroundAssessments: PatientHealthBackgroundAssessment[];
      psychooncologySupportAssessments: PatientPsychooncologySupportAssessment[];
      companions: CompanionPatient[];
      healthPhaseHistory: PatientHealthPhaseHistory[];
    }
  > {
    await this.access.assertCanRead(id, user);
    const [
      patient,
      stored,
      diagnoses,
      treatments,
      insurance,
      medicalAppointments,
      sisAffiliations,
      symptomReports,
      healthBackgroundAssessments,
      psychooncologySupportAssessments,
      companions,
      healthPhaseHistory,
    ] = await Promise.all([
      this.patientsRepository.findOne({
        where: { id },
        relations: { details: { primaryHealthCenter: true } },
      }),
      this.summaries.findOneBy({ patientId: id }),
      this.diagnosesRepository.find({
        where: { patientId: id },
        relations: { healthCenter: true },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
      this.treatmentsRepository.find({
        where: { patientId: id },
        relations: {
          sourceHealthCenter: true,
          receivingHealthCenter: true,
          diagnosis: true,
        },
        order: { createdAt: 'DESC' },
      }),
      this.insuranceRepository.find({
        where: { patientId: id },
        order: { createdAt: 'DESC' },
      }),
      this.medicalAppointmentsRepository.find({
        where: { patientId: id },
        relations: { healthCenter: true },
        order: { createdAt: 'DESC' },
      }),
      this.sisAffiliationsRepository.find({
        where: { patientId: id },
        order: { createdAt: 'DESC' },
      }),
      this.symptomReportsRepository.find({
        where: { patientId: id },
        order: { createdAt: 'DESC' },
      }),
      this.healthBackgroundAssessmentsRepository.find({
        where: { patientId: id },
        relations: {
          activeComorbidities: true,
          limitations: true,
          familyCancerHistory: true,
        },
        order: { createdAt: 'DESC' },
      }),
      this.psychooncologySupportAssessmentsRepository.find({
        where: { patientId: id },
        order: { createdAt: 'DESC' },
      }),
      this.companionPatientsRepository.find({
        where: { patientId: id },
        relations: { companion: true },
        order: { createdAt: 'DESC' },
      }),
      this.healthPhaseHistoryRepository.find({
        where: { patientId: id },
        order: { changedAt: 'DESC', id: 'DESC' },
      }),
    ]);
    if (!patient) throw new NotFoundException('Patient not found');
    return Object.assign(patient, {
      summary: stored?.summary ?? null,
      diagnoses,
      treatments,
      insurance,
      medicalAppointments,
      sisAffiliations,
      symptomReports,
      healthBackgroundAssessments,
      psychooncologySupportAssessments,
      companions,
      healthPhaseHistory,
    });
  }

  async update(id: string, input: UpdatePatientDto): Promise<Patient> {
    const patient = await this.findById(id);
    Object.assign(patient, input);
    const updated = await this.patientsRepository.save(patient);
    await this.invalidations.markDirty(id);
    return updated;
  }

  async deactivate(id: string, input: DeactivatePatientDto): Promise<Patient> {
    const patient = await this.findById(id);
    patient.activityStatus = PatientActivityStatus.INACTIVE;
    patient.deactivationReason = input.reason;
    patient.deactivationReasonDetail =
      input.reason === DeactivationReason.OTHER ? (input.detail ?? null) : null;
    patient.deactivatedAt = new Date();
    patient.deceasedAt = input.deceasedAt ?? null;
    const deactivated = await this.patientsRepository.save(patient);
    await this.invalidations.markDirty(id);
    return deactivated;
  }

  async reactivate(id: string): Promise<Patient> {
    const patient = await this.findById(id);
    patient.activityStatus = PatientActivityStatus.REACTIVE;
    patient.deactivationReason = null;
    patient.deactivationReasonDetail = null;
    patient.deactivatedAt = null;
    patient.deceasedAt = null;
    const reactivated = await this.patientsRepository.save(patient);
    await this.invalidations.markDirty(id);
    return reactivated;
  }

  async upsertDetails(
    id: string,
    input: UpsertPatientDetailsDto,
    manager?: EntityManager,
  ): Promise<PatientDetails> {
    if (!manager) {
      return this.dataSource.transaction((transactionManager) =>
        this.upsertDetails(id, input, transactionManager),
      );
    }
    await this.assertPatientRole(id, PatientRole.PATIENT, undefined, manager);
    const repository =
      manager?.getRepository(PatientDetails) ?? this.detailsRepository;
    const healthCenters =
      manager?.getRepository(HealthCenter) ??
      this.dataSource.getRepository(HealthCenter);
    if (input.primaryHealthCenterId) {
      const healthCenter = await healthCenters.findOne({
        where: { id: input.primaryHealthCenterId, isActive: true },
      });
      if (!healthCenter)
        throw new NotFoundException(
          'Primary health center not found or inactive',
        );
    }
    const details = await repository.findOne({
      where: { patientId: id },
    });
    const previousHealthPhase = details?.healthPhase ?? null;
    const { travelTimeToHospital, ...rest } = input;
    const normalized = {
      ...rest,
      travelTimeToHospital: normalizeDuration(travelTimeToHospital),
    };
    const saved = await repository.save(
      details
        ? Object.assign(details, normalized)
        : repository.create({ ...normalized, patientId: id }),
    );
    const historyRepository =
      manager?.getRepository(PatientHealthPhaseHistory) ??
      this.healthPhaseHistoryRepository;
    if (input.healthPhase && input.healthPhase !== previousHealthPhase) {
      await historyRepository.save(
        historyRepository.create({
          patientId: id,
          healthPhase: input.healthPhase,
        }),
      );
    }
    const healthPhaseHistory = await historyRepository.find({
      where: { patientId: id },
      order: { changedAt: 'DESC', id: 'DESC' },
    });
    if (saved.primaryHealthCenterId)
      saved.primaryHealthCenter = await healthCenters.findOne({
        where: { id: saved.primaryHealthCenterId },
      });
    await this.invalidations.markDirty(id, manager);
    return Object.assign(saved, { healthPhaseHistory });
  }

  private async createCompanionWithManager(
    patientId: string,
    input: CreateCompanionDto,
    manager: EntityManager,
  ): Promise<Patient> {
    const {
      isPrimaryInformant,
      isPrimaryContact,
      contactRole,
      isCaregiver,
      relationship,
      ...patientFields
    } = input;
    const patients = manager.getRepository(Patient);
    const companion = await patients.save(
      patients.create({
        ...patientFields,
        role: PatientRole.COMPANION,
        status: PatientStatus.UNENROLLED,
      }),
    );
    const links = manager.getRepository(CompanionPatient);
    const resolvedContactRole = resolveContactRole(
      contactRole,
      isPrimaryContact,
      null,
    );
    if (resolvedContactRole)
      await links.update(
        { patientId, contactRole: resolvedContactRole },
        { contactRole: null, isPrimaryContact: false },
      );
    await links.save(
      links.create({
        companionId: companion.id,
        patientId,
        isPrimaryInformant: isPrimaryInformant ?? false,
        contactRole: resolvedContactRole,
        isPrimaryContact: resolvedContactRole === CompanionContactRole.PRIMARY,
        isCaregiver: isCaregiver ?? false,
        relationship: relationship ?? null,
      }),
    );
    return companion;
  }
}
