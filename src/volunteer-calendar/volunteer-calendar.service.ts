import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AppointmentStatus,
  PsychooncologyAppointment,
} from '../database/entities/psychooncology-appointment.entity';
import { VolunteerAvailability } from '../database/entities/volunteer-availability.entity';
import { Volunteer } from '../database/entities/volunteer.entity';
import {
  VolunteerCalendarResponseDto,
  VolunteerCalendarVolunteerDto,
} from './volunteer-calendar.dto';

@Injectable()
export class VolunteerCalendarService {
  constructor(
    @InjectRepository(Volunteer)
    private readonly volunteers: Repository<Volunteer>,
    @InjectRepository(VolunteerAvailability)
    private readonly availability: Repository<VolunteerAvailability>,
    @InjectRepository(PsychooncologyAppointment)
    private readonly appointments: Repository<PsychooncologyAppointment>,
  ) {}

  async findInRange(
    from: string,
    to: string,
  ): Promise<VolunteerCalendarResponseDto> {
    if (from > to)
      throw new BadRequestException('from must be on or before to');

    const endExclusive = new Date(`${to}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const [volunteers, availabilitySlots, appointments] = await Promise.all([
      this.volunteers.find({ order: { firstName: 'ASC', lastName: 'ASC' } }),
      this.availability
        .createQueryBuilder('availability')
        .where('availability.date BETWEEN :from AND :to', { from, to })
        .orderBy('availability.date', 'ASC')
        .addOrderBy('availability.start_time', 'ASC')
        .getMany(),
      this.appointments
        .createQueryBuilder('appointment')
        .innerJoinAndSelect('appointment.patient', 'patient')
        .where('appointment.status = :status', {
          status: AppointmentStatus.SCHEDULED,
        })
        .andWhere('appointment.scheduled_at >= :from', {
          from: new Date(`${from}T00:00:00.000Z`),
        })
        .andWhere('appointment.scheduled_at < :endExclusive', { endExclusive })
        .orderBy('appointment.scheduled_at', 'ASC')
        .getMany(),
    ]);

    const slotsByVolunteer = new Map<
      string,
      VolunteerCalendarVolunteerDto['availabilitySlots']
    >();
    for (const slot of availabilitySlots) {
      const slots = slotsByVolunteer.get(slot.volunteerId) ?? [];
      slots.push({
        id: slot.id,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status,
      });
      slotsByVolunteer.set(slot.volunteerId, slots);
    }

    const appointmentsByVolunteer = new Map<
      string,
      VolunteerCalendarVolunteerDto['appointments']
    >();
    for (const appointment of appointments) {
      const items = appointmentsByVolunteer.get(appointment.volunteerId) ?? [];
      items.push({
        id: appointment.id,
        patientId: appointment.patientId,
        patientName: appointment.patient.fullName,
        availabilityId: appointment.availabilityId,
        modality: appointment.modality,
        status: appointment.status,
        scheduledAt: appointment.scheduledAt,
      });
      appointmentsByVolunteer.set(appointment.volunteerId, items);
    }

    return {
      volunteers: volunteers.map((volunteer) => ({
        id: volunteer.id,
        firstName: volunteer.firstName,
        lastName: volunteer.lastName,
        specialty: volunteer.specialty,
        isActive: volunteer.isActive,
        availabilitySlots: slotsByVolunteer.get(volunteer.id) ?? [],
        appointments: appointmentsByVolunteer.get(volunteer.id) ?? [],
      })),
    };
  }
}
