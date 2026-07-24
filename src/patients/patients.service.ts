import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PatientSummary } from '../database/entities/patient-summary.entity';
import { PatientSummaryInvalidationService } from '../patient-summaries/patient-summary-invalidation.service';
import { CompanionPatient } from './entities/companion-patient.entity';
import { DeactivationReason } from './entities/deactivation-reason.enum';
import { PatientDetails } from './entities/patient-details.entity';
import { PatientRole } from './entities/patient-role.enum';
import { PatientStatus } from './entities/patient-status.enum';
import { Patient } from './entities/patient.entity';
import { CreateCompanionDto } from './dto/create-companion.dto';
import { CreatePatientDto } from './dto/create-patient.dto';
import { DeactivatePatientDto } from './dto/deactivate-patient.dto';
import { ListPatientsDto } from './dto/list-patients.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { UpsertPatientDetailsDto } from './dto/upsert-patient-details.dto';
import { LinkCompanionDto } from './dto/link-companion.dto';

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
    private readonly dataSource: DataSource,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}

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

  async findCompanions(patientId: string): Promise<CompanionPatient[]> {
    return this.companionPatientsRepository.find({
      where: { patientId },
      relations: { companion: true },
    });
  }
  async findAccompanies(companionId: string): Promise<CompanionPatient[]> {
    return this.companionPatientsRepository.find({
      where: { companionId },
      relations: { patient: true },
    });
  }

  async findAll(
    filters: ListPatientsDto,
  ): Promise<{ data: Patient[]; total: number }> {
    const query = this.patientsRepository.createQueryBuilder('patient');
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
      .skip(filters.offset)
      .take(filters.limit)
      .getManyAndCount();
    return { data, total };
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
