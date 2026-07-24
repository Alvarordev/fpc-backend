import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientsRepository: Repository<Patient>,
    @InjectRepository(PatientDetails)
    private readonly detailsRepository: Repository<PatientDetails>,
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
    return this.patientsRepository.save(
      this.patientsRepository.create({
        ...input,
        accompaniesPatientId: patientId,
        role: PatientRole.COMPANION,
        status: PatientStatus.UNENROLLED,
      }),
    );
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
      relations: { details: true, companions: true },
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
