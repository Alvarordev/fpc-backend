import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import {
  AppointmentModality,
  AppointmentStatus,
  PsychooncologyAppointment,
} from '../database/entities/psychooncology-appointment.entity';
import {
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from '../database/entities/follow-up.enums';
import { FollowUp } from '../database/entities/follow-up.entity';
import { Patient } from '../patients/entities/patient.entity';
import { UserRole } from '../database/entities/user-role.enum';
import { User } from '../database/entities/user.entity';
import {
  AvailabilityStatus,
  VolunteerAvailability,
} from '../database/entities/volunteer-availability.entity';
import { Volunteer } from '../database/entities/volunteer.entity';
import {
  CreatePsychooncologyAppointmentDto,
  UpdatePsychooncologyAppointmentDto,
} from './psychooncology-appointments.dto';

@Injectable()
export class PsychooncologyAppointmentsService {
  constructor(
    @InjectRepository(PsychooncologyAppointment)
    private readonly appointments: Repository<PsychooncologyAppointment>,
    @InjectRepository(Volunteer)
    private readonly volunteers: Repository<Volunteer>,
    @InjectRepository(Agent) private readonly agents: Repository<Agent>,
    private readonly dataSource: DataSource,
  ) {}

  async create(input: CreatePsychooncologyAppointmentDto, user: User) {
    const agentId = await this.resolveAgentId(input.agentId, user);
    return this.dataSource.transaction((manager) =>
      this.reserveAndCreate(manager, input, agentId),
    );
  }

  async findAll(user: User) {
    const volunteerId = await this.volunteerIdFor(user);
    return this.appointments.find({
      where: volunteerId ? { volunteerId } : {},
      order: { scheduledAt: 'ASC' },
    });
  }

  async findOne(id: string, user: User) {
    const appointment = await this.appointments.findOne({ where: { id } });
    if (!appointment)
      throw new NotFoundException('Psycho-oncology appointment not found');
    await this.assertAppointmentScope(appointment, user);
    return appointment;
  }

  async update(
    id: string,
    input: UpdatePsychooncologyAppointmentDto,
    user: User,
  ) {
    await this.assertUpdateScope(id, user);
    return this.dataSource.transaction(async (manager) => {
      const appointment = await manager
        .getRepository(PsychooncologyAppointment)
        .createQueryBuilder('appointment')
        .setLock('pessimistic_write')
        .where('appointment.id = :id', { id })
        .getOne();
      if (!appointment)
        throw new NotFoundException('Psycho-oncology appointment not found');
      this.assertTransition(appointment, input, user);

      if (input.status === AppointmentStatus.CANCELLED) {
        const availability = await this.lockAvailability(
          manager,
          appointment.availabilityId,
        );
        availability.status = AvailabilityStatus.AVAILABLE;
        await manager.getRepository(VolunteerAvailability).save(availability);
      }

      Object.assign(appointment, input);
      if (input.status === AppointmentStatus.COMPLETED)
        appointment.completedAt = new Date();

      const saved = await manager
        .getRepository(PsychooncologyAppointment)
        .save(appointment);
      if (input.status) {
        await manager.getRepository(FollowUp).update(
          { id: appointment.followUpId },
          {
            status: input.status as unknown as FollowUpStatus,
            completedAt:
              input.status === AppointmentStatus.COMPLETED
                ? appointment.completedAt
                : null,
          },
        );
      }
      return saved;
    });
  }

  private assertTransition(
    appointment: PsychooncologyAppointment,
    input: UpdatePsychooncologyAppointmentDto,
    user: User,
  ) {
    if (appointment.status !== AppointmentStatus.SCHEDULED)
      throw new ConflictException('Closed appointments cannot be updated');

    if (user.role === UserRole.VOLUNTEER) {
      const { status, ...updates } = input;
      if (
        status !== AppointmentStatus.NO_ANSWER ||
        Object.values(updates).some((value) => value !== undefined)
      )
        throw new ForbiddenException(
          'Volunteers can only mark their scheduled appointments as no answer',
        );
      return;
    }

    if (
      input.status &&
      ![
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_ANSWER,
      ].includes(input.status)
    )
      throw new BadRequestException('Invalid appointment status transition');
  }

  private async reserveAndCreate(
    manager: EntityManager,
    input: CreatePsychooncologyAppointmentDto,
    agentId: string,
  ) {
    // Lock the patient as well as the slot so concurrent bookings get sequential sessions.
    const patient = await manager
      .getRepository(Patient)
      .createQueryBuilder('patient')
      .setLock('pessimistic_write')
      .where('patient.id = :id', { id: input.patientId })
      .getOne();
    if (!patient) throw new NotFoundException('Patient not found');

    const availability = await this.lockAvailability(
      manager,
      input.availabilityId,
    );
    if (availability.status !== AvailabilityStatus.AVAILABLE)
      throw new ConflictException('Availability slot is already reserved');

    const volunteer = await manager.getRepository(Volunteer).findOne({
      where: { id: availability.volunteerId },
    });
    if (!volunteer) throw new NotFoundException('Volunteer not found');
    if (!volunteer.isActive)
      throw new ConflictException('Volunteer is inactive');

    availability.status = AvailabilityStatus.RESERVED;
    await manager.getRepository(VolunteerAvailability).save(availability);

    const sessionNumber =
      (await manager.getRepository(PsychooncologyAppointment).count({
        where: { patientId: patient.id },
      })) + 1;
    const scheduledAt = this.slotDate(availability);
    const followUp = await manager.getRepository(FollowUp).save(
      manager.getRepository(FollowUp).create({
        subjectPatientId: patient.id,
        interlocutorId: patient.id,
        agentId,
        type:
          input.modality === AppointmentModality.CALL
            ? FollowUpType.CALL
            : FollowUpType.VIDEO_CALL,
        status: FollowUpStatus.SCHEDULED,
        purpose: FollowUpPurpose.PSYCHOONCOLOGY_REFERRAL,
        scheduledAt,
        completedAt: null,
        notes: null,
        nextFollowUpId: null,
      }),
    );

    return manager.getRepository(PsychooncologyAppointment).save(
      manager.getRepository(PsychooncologyAppointment).create({
        patientId: patient.id,
        volunteerId: volunteer.id,
        followUpId: followUp.id,
        availabilityId: availability.id,
        patientEmail: input.patientEmail ?? null,
        sessionNumber,
        isAdditionalSession: input.isAdditionalSession ?? false,
        modality: input.modality,
        status: AppointmentStatus.SCHEDULED,
        scheduledAt,
        completedAt: null,
        topicAddressed: null,
        sessionDetails: null,
        additionalObservations: null,
        recommendations: null,
        referral: null,
      }),
    );
  }

  private async lockAvailability(manager: EntityManager, id: string) {
    const availability = await manager
      .getRepository(VolunteerAvailability)
      .createQueryBuilder('availability')
      .setLock('pessimistic_write')
      .where('availability.id = :id', { id })
      .getOne();
    if (!availability)
      throw new NotFoundException('Availability slot not found');
    return availability;
  }

  private slotDate(availability: VolunteerAvailability) {
    const scheduledAt = new Date(
      `${availability.date}T${availability.startTime}Z`,
    );
    if (Number.isNaN(scheduledAt.valueOf()))
      throw new BadRequestException(
        'Availability slot has an invalid date or time',
      );
    return scheduledAt;
  }

  private async resolveAgentId(
    requestedAgentId: string | undefined,
    user: User,
  ) {
    if (user.role === UserRole.AGENT) {
      const agent = await this.agents.findOne({ where: { userId: user.id } });
      if (!agent)
        throw new BadRequestException(
          'Authenticated user has no agent profile',
        );
      if (requestedAgentId && requestedAgentId !== agent.id)
        throw new ForbiddenException(
          'Agents cannot assign appointments to others',
        );
      return agent.id;
    }
    if (!requestedAgentId) throw new BadRequestException('agentId is required');
    if (!(await this.agents.existsBy({ id: requestedAgentId })))
      throw new NotFoundException('Agent not found');
    return requestedAgentId;
  }

  private async volunteerIdFor(user: User) {
    if (user.role !== UserRole.VOLUNTEER) return null;
    const volunteer = await this.volunteers.findOne({
      where: { userId: user.id },
    });
    if (!volunteer)
      throw new BadRequestException(
        'Authenticated user has no volunteer profile',
      );
    return volunteer.id;
  }

  private async assertUpdateScope(id: string, user: User) {
    const appointment = await this.appointments.findOne({ where: { id } });
    if (!appointment)
      throw new NotFoundException('Psycho-oncology appointment not found');
    await this.assertAppointmentScope(appointment, user);
  }

  private async assertAppointmentScope(
    appointment: PsychooncologyAppointment,
    user: User,
  ) {
    const volunteerId = await this.volunteerIdFor(user);
    if (volunteerId && appointment.volunteerId !== volunteerId)
      throw new ForbiddenException(
        'Volunteers can only access their own appointments',
      );
  }
}
