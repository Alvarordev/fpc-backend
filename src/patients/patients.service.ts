import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { FollowUp } from '../database/entities/follow-up.entity';
import { PatientSummary } from '../database/entities/patient-summary.entity';
import { PatientSummaryInvalidationService } from '../patient-summaries/patient-summary-invalidation.service';
import { CompanionPatient } from './entities/companion-patient.entity';
import { DeactivationReason } from './entities/deactivation-reason.enum';
import { PatientDetails } from './entities/patient-details.entity';
import { PatientDiagnosis } from './entities/patient-diagnosis.entity';
import { PatientInsurance } from './entities/patient-insurance.entity';
import { PatientMedicalAppointment } from './entities/patient-medical-appointment.entity';
import { PatientRole } from './entities/patient-role.enum';
import { PatientSisAffiliation } from './entities/patient-sis-affiliation.entity';
import { PatientStatus } from './entities/patient-status.enum';
import { PatientSymptomReport } from './entities/patient-symptom-report.entity';
import { PatientTreatment } from './entities/patient-treatment.entity';
import { Patient } from './entities/patient.entity';
import { CreateCompanionDto } from './dto/create-companion.dto';
import { CreatePatientDto } from './dto/create-patient.dto';
import { DeactivatePatientDto } from './dto/deactivate-patient.dto';
import { ListPatientsDto } from './dto/list-patients.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpsertPatientDetailsDto } from './dto/upsert-patient-details.dto';
import { LinkCompanionDto } from './dto/link-companion.dto';
import { User } from '../database/entities/user.entity';
import { PatientAccessService } from '../patient-access/patient-access.service';
import { N8nTransactionalDispatchService } from '../webhooks/transactional-dispatch.service';
import { buildRegistroEnvelope } from '../webhooks/n8n-webhook.payloads';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientsRepository: Repository<Patient>,
    @InjectRepository(PatientDetails)
    private readonly detailsRepository: Repository<PatientDetails>,
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
          condition:
            patient.role === PatientRole.COMPANION ? 'acompañante' : 'paciente',
        }),
      );
    }
    return patient;
  }

  async createCompanion(
    patientId: string,
    input: CreateCompanionDto,
    manager?: EntityManager,
  ): Promise<Patient> {
    await this.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      PatientStatus.ENROLLED,
      manager,
    );
    if (manager)
      return this.createCompanionWithManager(patientId, input, manager);
    return this.dataSource.transaction(async (manager) => {
      return this.createCompanionWithManager(patientId, input, manager);
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
    return repository.save(
      repository.create({
        companionId: input.existingCompanionId,
        patientId,
        isPrimaryInformant: input.isPrimaryInformant ?? false,
      }),
    );
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
      }
    >;
    total: number;
  }> {
    const query = this.patientsRepository.createQueryBuilder('patient');
    await this.access.scopeQuery(query, 'patient.id', user);
    if (filters.role)
      query.andWhere('patient.role = :role', { role: filters.role });
    if (filters.status)
      query.andWhere('patient.status = :status', { status: filters.status });
    if (filters.isActive !== undefined)
      query.andWhere('patient.is_active = :isActive', {
        isActive: filters.isActive,
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
    const [details, currentDiagnoses, latestFollowUps] = await Promise.all([
      this.detailsRepository.find({ where: { patientId: In(patientIds) } }),
      this.diagnosesRepository
        .createQueryBuilder('diagnosis')
        .leftJoinAndSelect('diagnosis.healthCenter', 'healthCenter')
        .where('diagnosis.patient_id IN (:...patientIds)', { patientIds })
        .andWhere('diagnosis.is_current = true')
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
    ]);
    const departments = new Map(
      details.map((details) => [details.patientId, details.currentDepartment]),
    );
    const diagnoses = new Map(
      currentDiagnoses.map((diagnosis) => [diagnosis.patientId, diagnosis]),
    );
    const followUps = new Map(
      latestFollowUps.map((followUp) => [followUp.subjectPatientId, followUp]),
    );
    return {
      data: data.map((patient) =>
        Object.assign(patient, {
          currentDepartment: departments.get(patient.id) ?? null,
          currentDiagnosis: diagnoses.get(patient.id) ?? null,
          latestFollowUp: followUps.get(patient.id) ?? null,
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
      companions: CompanionPatient[];
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
      companions,
    ] = await Promise.all([
      this.patientsRepository.findOne({
        where: { id },
        relations: { details: true },
      }),
      this.summaries.findOneBy({ patientId: id }),
      this.diagnosesRepository.find({
        where: { patientId: id },
        relations: { healthCenter: true },
        order: { createdAt: 'DESC' },
      }),
      this.treatmentsRepository.find({
        where: { patientId: id },
        relations: { healthCenter: true, diagnosis: true },
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
      this.companionPatientsRepository.find({
        where: { patientId: id },
        relations: { companion: true },
        order: { createdAt: 'DESC' },
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
      companions,
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
    patient.isActive = false;
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
    patient.isActive = true;
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
    await this.assertPatientRole(id, PatientRole.PATIENT, undefined, manager);
    const repository =
      manager?.getRepository(PatientDetails) ?? this.detailsRepository;
    const details = await repository.findOne({
      where: { patientId: id },
    });
    const saved = await repository.save(
      details
        ? Object.assign(details, input)
        : repository.create({ ...input, patientId: id }),
    );
    await this.invalidations.markDirty(id, manager);
    return saved;
  }

  private async createCompanionWithManager(
    patientId: string,
    input: CreateCompanionDto,
    manager: EntityManager,
  ): Promise<Patient> {
    const patients = manager.getRepository(Patient);
    const companion = await patients.save(
      patients.create({
        ...input,
        role: PatientRole.COMPANION,
        status: PatientStatus.UNENROLLED,
      }),
    );
    const links = manager.getRepository(CompanionPatient);
    await links.save(
      links.create({
        companionId: companion.id,
        patientId,
        isPrimaryInformant: input.isPrimaryInformant ?? false,
      }),
    );
    return companion;
  }
}
