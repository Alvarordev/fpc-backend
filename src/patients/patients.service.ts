import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CompanionPatient } from '../database/entities/companion-patient.entity';
import { DeactivationReason } from '../database/entities/deactivation-reason.enum';
import { PatientDetails } from '../database/entities/patient-details.entity';
import { PatientRole } from '../database/entities/patient-role.enum';
import { PatientStatus } from '../database/entities/patient-status.enum';
import { Patient } from '../database/entities/patient.entity';
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
    private readonly dataSource: DataSource,
  ) {}

  async assertPatientRole(
    patientId: string,
    expectedRole: PatientRole,
    expectedStatus?: PatientStatus,
  ): Promise<Patient> {
    const patient = await this.patientsRepository.findOne({
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

  create(input: CreatePatientDto): Promise<Patient> {
    return this.patientsRepository.save(
      this.patientsRepository.create({ ...input }),
    );
  }

  async createCompanion(
    patientId: string,
    input: CreateCompanionDto,
  ): Promise<Patient> {
    await this.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      PatientStatus.ENROLLED,
    );
    return this.dataSource.transaction(async (manager) => {
      const companion = await manager.getRepository(Patient).save(
        manager.getRepository(Patient).create({
          ...input,
          role: PatientRole.COMPANION,
          status: PatientStatus.UNENROLLED,
        }),
      );
      await manager.getRepository(CompanionPatient).save(
        manager.getRepository(CompanionPatient).create({
          companionId: companion.id,
          patientId,
          isPrimaryInformant: input.isPrimaryInformant ?? false,
        }),
      );
      return companion;
    });
  }

  async linkCompanion(
    patientId: string,
    input: LinkCompanionDto,
  ): Promise<CompanionPatient> {
    await this.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      PatientStatus.ENROLLED,
    );
    await this.assertPatientRole(
      input.existingCompanionId,
      PatientRole.COMPANION,
    );
    const existing = await this.companionPatientsRepository.findOne({
      where: { companionId: input.existingCompanionId, patientId },
    });
    if (existing)
      throw new ConflictException(
        'Companion is already linked to this patient',
      );
    return this.companionPatientsRepository.save(
      this.companionPatientsRepository.create({
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

  async findById(id: string): Promise<Patient> {
    const patient = await this.patientsRepository.findOne({
      where: { id },
      relations: { details: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: string, input: UpdatePatientDto): Promise<Patient> {
    const patient = await this.findById(id);
    Object.assign(patient, input);
    return this.patientsRepository.save(patient);
  }

  async deactivate(id: string, input: DeactivatePatientDto): Promise<Patient> {
    const patient = await this.findById(id);
    patient.isActive = false;
    patient.deactivationReason = input.reason;
    patient.deactivationReasonDetail =
      input.reason === DeactivationReason.OTHER ? (input.detail ?? null) : null;
    patient.deactivatedAt = new Date();
    patient.deceasedAt = input.deceasedAt ?? null;
    return this.patientsRepository.save(patient);
  }

  async reactivate(id: string): Promise<Patient> {
    const patient = await this.findById(id);
    patient.isActive = true;
    patient.deactivationReason = null;
    patient.deactivationReasonDetail = null;
    patient.deactivatedAt = null;
    patient.deceasedAt = null;
    return this.patientsRepository.save(patient);
  }

  async upsertDetails(
    id: string,
    input: UpsertPatientDetailsDto,
  ): Promise<PatientDetails> {
    await this.assertPatientRole(id, PatientRole.PATIENT);
    const details = await this.detailsRepository.findOne({
      where: { patientId: id },
    });
    return this.detailsRepository.save(
      details
        ? Object.assign(details, input)
        : this.detailsRepository.create({ ...input, patientId: id }),
    );
  }
}
