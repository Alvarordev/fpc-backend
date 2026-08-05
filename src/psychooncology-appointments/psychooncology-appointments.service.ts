import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  AppointmentStatus,
  PsychooncologyAppointment,
} from '../database/entities/psychooncology-appointment.entity';
import { FollowUp } from '../database/entities/follow-up.entity';
import { Patient } from '../patients/entities/patient.entity';
import { UserRole } from '../database/entities/user-role.enum';
import { User } from '../database/entities/user.entity';
import {
  AvailabilityStatus,
  VolunteerAvailability,
} from '../database/entities/volunteer-availability.entity';
import { Volunteer } from '../database/entities/volunteer.entity';
import { PatientAccessService } from '../patient-access/patient-access.service';
import {
  CreatePsychooncologyAppointmentDto,
  FindPsychooncologyAppointmentsQueryDto,
  UpdatePsychooncologyAppointmentDto,
} from './psychooncology-appointments.dto';

@Injectable()
export class PsychooncologyAppointmentsService {
  constructor(
    @InjectRepository(PsychooncologyAppointment)
    private readonly appointments: Repository<PsychooncologyAppointment>,
    private readonly dataSource: DataSource,
    private readonly access: PatientAccessService,
  ) {}

  async create(input: CreatePsychooncologyAppointmentDto, user: User) {
    return this.dataSource.transaction((manager) =>
      this.reserveAndCreate(manager, input, user),
    );
  }

  async findAll(
    queryInput: FindPsychooncologyAppointmentsQueryDto,
    user: User,
  ) {
    const query = this.appointments
      .createQueryBuilder('appointment')
      .orderBy('appointment.scheduled_at', 'ASC');
    const volunteerId = await this.access.volunteerIdFor(user);
    if (volunteerId) {
      query.andWhere('appointment.volunteer_id = :volunteerId', {
        volunteerId,
      });
    } else if (queryInput.volunteerId) {
      query.andWhere('appointment.volunteer_id = :volunteerId', {
        volunteerId: queryInput.volunteerId,
      });
    }
    if (queryInput.patientId)
      query.andWhere('appointment.patient_id = :patientId', {
        patientId: queryInput.patientId,
      });
    if (queryInput.status)
      query.andWhere('appointment.status = :status', {
        status: queryInput.status,
      });
    if (!volunteerId)
      await this.access.scopeQuery(query, 'appointment.patient_id', user);
    return query.getMany();
  }

  async findOne(id: string, user: User) {
    const appointment = await this.appointments.findOne({ where: { id } });
    if (!appointment)
      throw new NotFoundException('Psycho-oncology appointment not found');
    await this.access.assertCanRead(appointment.patientId, user);
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
    user: User,
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
    await this.assertScheduleScope(availability.volunteerId, user);

    const followUp = input.followUpId
      ? await manager.getRepository(FollowUp).findOne({
          where: { id: input.followUpId, subjectPatientId: patient.id },
        })
      : null;
    if (input.followUpId && !followUp)
      throw new BadRequestException('Follow-up does not belong to the patient');

    availability.status = AvailabilityStatus.RESERVED;
    await manager.getRepository(VolunteerAvailability).save(availability);

    const sessionNumber =
      (await manager.getRepository(PsychooncologyAppointment).count({
        where: { patientId: patient.id },
      })) + 1;
    const scheduledAt = this.slotDate(availability);
    return manager.getRepository(PsychooncologyAppointment).save(
      manager.getRepository(PsychooncologyAppointment).create({
        patientId: patient.id,
        volunteerId: volunteer.id,
        followUpId: followUp?.id ?? null,
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

  private async assertScheduleScope(volunteerId: string, user: User) {
    if (user.role !== UserRole.VOLUNTEER) return;

    if ((await this.access.volunteerIdFor(user)) !== volunteerId)
      throw new ForbiddenException(
        'Volunteers can only schedule appointments from their own availability',
      );
  }

  private async assertUpdateScope(id: string, user: User) {
    const appointment = await this.appointments.findOne({ where: { id } });
    if (!appointment)
      throw new NotFoundException('Psycho-oncology appointment not found');
    const volunteerId = await this.access.volunteerIdFor(user);
    if (volunteerId && appointment.volunteerId !== volunteerId)
      throw new ForbiddenException(
        'Volunteers can only modify their own appointments',
      );
  }
}
