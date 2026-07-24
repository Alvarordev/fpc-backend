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
  InteractionPurpose,
  InteractionStatus,
  InteractionType,
} from '../database/entities/interaction.enums';
import { Interaction } from '../database/entities/interaction.entity';
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
    const agentId = await this.agentIdFor(user);
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
      if (appointment.status === AppointmentStatus.CANCELLED)
        throw new ConflictException('Cancelled appointments cannot be updated');

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
        await manager.getRepository(Interaction).update(
          { id: appointment.interactionId },
          {
            status: input.status as unknown as InteractionStatus,
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

  private async reserveAndCreate(
    manager: EntityManager,
    input: CreatePsychooncologyAppointmentDto,
    agentId: string | null,
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
    const interaction = await manager.getRepository(Interaction).save(
      manager.getRepository(Interaction).create({
        subjectPatientId: patient.id,
        interlocutorId: patient.id,
        agentId,
        type:
          input.modality === AppointmentModality.CALL
            ? InteractionType.CALL
            : InteractionType.VIDEO_CALL,
        status: InteractionStatus.SCHEDULED,
        purpose: InteractionPurpose.PSYCHOONCOLOGY_REFERRAL,
        scheduledAt,
        completedAt: null,
        notes: null,
        nextInteractionId: null,
      }),
    );

    return manager.getRepository(PsychooncologyAppointment).save(
      manager.getRepository(PsychooncologyAppointment).create({
        patientId: patient.id,
        volunteerId: volunteer.id,
        interactionId: interaction.id,
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

  private async agentIdFor(user: User) {
    if (user.role !== UserRole.AGENT) return null;
    const agent = await this.agents.findOne({ where: { userId: user.id } });
    if (!agent)
      throw new BadRequestException('Authenticated user has no agent profile');
    return agent.id;
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
