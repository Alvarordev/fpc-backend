import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../../../../database/entities/agent.entity';
import { MedicalAppointmentStatus } from '../../../../database/entities/medical-appointment-status.enum';
import { PatientMedicalAppointment } from '../../../../database/entities/patient-medical-appointment.entity';
import { PatientRole } from '../../../../database/entities/patient-role.enum';
import { HistoryVersioningService } from '../../history-versioning/history-versioning.service';
import { PatientsService } from '../../patients.service';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { PatientAccessService } from '../../access/patient-access.service';
import { FollowUpsService } from '../../../follow-ups/follow-ups.service';
import { User } from '../../../../database/entities/user.entity';
import { CreateMedicalAppointmentDto } from './dto/create-medical-appointment.dto';
import { FindMedicalAppointmentsDto } from './dto/list-medical-appointments.dto';
import { UpdateMedicalAppointmentDto } from './dto/update-medical-appointment.dto';
import { N8nTransactionalDispatchService } from '../../../../integrations/n8n/transactional-dispatch.service';
import { citaEnvelopeFor } from './cita-envelope';
import { normalizeReferralFields } from './referral-fields';

@Injectable()
export class MedicalAppointmentsService {
  constructor(
    @InjectRepository(PatientMedicalAppointment)
    private readonly appointments: Repository<PatientMedicalAppointment>,
    @InjectRepository(Agent) private readonly agents: Repository<Agent>,
    private readonly patients: PatientsService,
    private readonly followUps: FollowUpsService,
    private readonly versioning: HistoryVersioningService,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly access: PatientAccessService,
    private readonly webhooks: N8nTransactionalDispatchService,
  ) {}

  async create(input: CreateMedicalAppointmentDto, user: User) {
    const patient = await this.patients.assertPatientRole(
      input.patientId,
      PatientRole.PATIENT,
    );
    const agent = await this.agents.findOne({ where: { userId: user.id } });
    if (!agent)
      throw new BadRequestException('Authenticated user has no agent profile');
    const followUpId = await this.followUps.resolveOrCreateForPatient(
      input.patientId,
      agent.id,
    );

    const appointment = await this.versioning.replaceCurrent(
      PatientMedicalAppointment,
      {
        patientId: input.patientId,
        specialty: input.specialty,
        isCurrent: true,
      },
        { ...normalizeReferralFields(input), followUpId, status: MedicalAppointmentStatus.SCHEDULED },
    );
    await this.invalidations.markDirty(input.patientId);
    await this.webhooks.enqueue(citaEnvelopeFor(patient, appointment));
    return this.findOneOrThrow(appointment.id);
  }

  async update(id: string, input: UpdateMedicalAppointmentDto) {
    const existing = await this.appointments.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Medical appointment not found');

    const appointment = await this.versioning.replaceCurrent(
      PatientMedicalAppointment,
      {
        patientId: existing.patientId,
        specialty: existing.specialty,
        isCurrent: true,
      },
      normalizeReferralFields({
        patientId: existing.patientId,
        followUpId: existing.followUpId,
        specialty: existing.specialty,
        healthCenterId:
          input.healthCenterId !== undefined
            ? input.healthCenterId
            : existing.healthCenterId,
        appointmentDate:
          input.appointmentDate !== undefined
            ? input.appointmentDate
            : existing.appointmentDate,
        appointmentTime:
          input.appointmentTime !== undefined
            ? input.appointmentTime
            : existing.appointmentTime,
        nextAppointmentDate:
          input.nextAppointmentDate !== undefined
            ? input.nextAppointmentDate
            : existing.nextAppointmentDate,
        nextAppointmentSpecialty:
          input.nextAppointmentSpecialty !== undefined
            ? input.nextAppointmentSpecialty
            : existing.nextAppointmentSpecialty,
        hasReferralSheet:
          input.hasReferralSheet !== undefined
            ? input.hasReferralSheet
            : existing.hasReferralSheet,
        referredTo:
          input.referredTo !== undefined
            ? input.referredTo
            : existing.referredTo,
        referralNotProvidedReason:
          input.referralNotProvidedReason !== undefined
            ? input.referralNotProvidedReason
            : existing.referralNotProvidedReason,
        difficulties:
          input.difficulties !== undefined
            ? input.difficulties
            : existing.difficulties,
        isFirstConsultation:
          input.isFirstConsultation !== undefined
            ? input.isFirstConsultation
            : existing.isFirstConsultation,
        status: existing.status,
        reminderId: existing.reminderId,
        changeReason: input.changeReason,
      }),
    );
    await this.invalidations.markDirty(existing.patientId);
    return this.findOneOrThrow(appointment.id);
  }

  async findAll(filters: FindMedicalAppointmentsDto, user: User) {
    const query = this.baseQuery();
    if (!filters.includeHistory)
      query.andWhere('appointment.is_current = true');
    if (filters.patientId)
      query.andWhere('appointment.patient_id = :patientId', {
        patientId: filters.patientId,
      });
    if (filters.specialty)
      query.andWhere('appointment.specialty = :specialty', {
        specialty: filters.specialty,
      });
    if (filters.healthCenterId)
      query.andWhere('appointment.health_center_id = :healthCenterId', {
        healthCenterId: filters.healthCenterId,
      });
    if (filters.from)
      query.andWhere('appointment.appointment_date >= :from', {
        from: filters.from,
      });
    if (filters.to)
      query.andWhere('appointment.appointment_date <= :to', {
        to: filters.to,
      });
    await this.access.scopeQuery(query, 'appointment.patient_id', user);

    query
      .orderBy('appointment.appointment_date', 'DESC', 'NULLS LAST')
      .addOrderBy('appointment.created_at', 'DESC')
      .skip(filters.offset)
      .take(filters.limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }

  private baseQuery() {
    return this.appointments
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.healthCenter', 'health_center');
  }

  private async findOneOrThrow(id: string) {
    const appointment = await this.baseQuery()
      .where('appointment.id = :id', { id })
      .getOne();
    if (!appointment)
      throw new NotFoundException('Medical appointment not found');
    return appointment;
  }
}
