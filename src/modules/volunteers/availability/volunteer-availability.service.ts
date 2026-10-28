import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { UserRole } from '../../../database/entities/user-role.enum';
import { User } from '../../../database/entities/user.entity';
import {
  AvailabilityStatus,
  VolunteerAvailability,
} from '../../../database/entities/volunteer-availability.entity';
import { Volunteer } from '../../../database/entities/volunteer.entity';
import { CreateVolunteerAvailabilityDto } from './dto/create-volunteer-availability.dto';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { dateOnlyInLima } from '../../../shared/date-only/date-only.util';

const MAX_RECURRENCE_DAYS = 366;

@Injectable()
export class VolunteerAvailabilityService {
  constructor(
    @InjectRepository(VolunteerAvailability)
    private readonly availability: Repository<VolunteerAvailability>,
    @InjectRepository(Volunteer)
    private readonly volunteers: Repository<Volunteer>,
    private readonly dataSource: DataSource,
  ) {}

  /** V4: weekly block split into 1-hour slots until endDate. */
  async createRecurring(
    volunteerId: string,
    input: CreateRecurringAvailabilityDto,
    user: User,
  ) {
    await this.assertScope(volunteerId, user);
    const today = dateOnlyInLima(new Date());
    const startDate = input.startDate ?? today;
    if (startDate < today)
      throw new BadRequestException('startDate cannot be in the past');
    if (input.endDate < startDate)
      throw new BadRequestException('endDate must be on or after startDate');
    const [startHour, startMinute] = input.startTime.split(':').map(Number);
    if (startHour * 60 + startMinute + input.hours * 60 > 24 * 60)
      throw new BadRequestException('The block must end within the same day');

    const days = new Set(input.daysOfWeek);
    const wanted: { date: string; startTime: string; endTime: string }[] = [];
    const cursor = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${input.endDate}T00:00:00.000Z`);
    if ((end.getTime() - cursor.getTime()) / 86_400_000 > MAX_RECURRENCE_DAYS)
      throw new BadRequestException(
        `A recurring block can span at most ${MAX_RECURRENCE_DAYS} days`,
      );
    for (; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      if (!days.has(cursor.getUTCDay())) continue;
      const date = cursor.toISOString().slice(0, 10);
      for (let hour = 0; hour < input.hours; hour++) {
        const from = startHour * 60 + startMinute + hour * 60;
        wanted.push({
          date,
          startTime: this.time(from),
          endTime: this.time(from + 60),
        });
      }
    }
    if (!wanted.length)
      throw new BadRequestException(
        'No date in the range matches the given days of the week',
      );

    const existing = await this.availability
      .createQueryBuilder('availability')
      .where('availability.volunteer_id = :volunteerId', { volunteerId })
      .andWhere('availability.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate: input.endDate,
      })
      .andWhere('availability.start_time IS NOT NULL')
      .getMany();
    const toSeconds = (time: string) => {
      const [h, m, sec = 0] = time.split(':').map(Number);
      return h * 3600 + m * 60 + sec;
    };
    const fresh = wanted.filter(
      (slot) =>
        !existing.some(
          (item) =>
            item.date === slot.date &&
            toSeconds(item.startTime!) < toSeconds(slot.endTime) &&
            toSeconds(item.endTime!) > toSeconds(slot.startTime),
        ),
    );

    const recurrenceId = randomUUID();
    const created = fresh.length
      ? await this.dataSource.transaction((manager) =>
          manager.getRepository(VolunteerAvailability).save(
            fresh.map((slot) =>
              manager.getRepository(VolunteerAvailability).create({
                ...slot,
                volunteerId,
                recurrenceId,
                status: AvailabilityStatus.AVAILABLE,
              }),
            ),
          ),
        )
      : [];
    return {
      recurrenceId,
      created,
      skipped: wanted.length - fresh.length,
    };
  }

  /** Removes the free future slots of a series; booked ones stay (P9). */
  async removeRecurrence(
    recurrenceId: string,
    volunteerId: string,
    user: User,
  ) {
    await this.assertScope(volunteerId, user);
    const slots = await this.availability
      .createQueryBuilder('availability')
      .where('availability.volunteer_id = :volunteerId', { volunteerId })
      .andWhere('availability.recurrence_id = :recurrenceId', { recurrenceId })
      .andWhere('availability.date >= :today', {
        today: dateOnlyInLima(new Date()),
      })
      .getMany();
    if (!slots.length) throw new NotFoundException('Recurrence not found');
    const free = slots.filter(
      (slot) => slot.status === AvailabilityStatus.AVAILABLE,
    );
    if (free.length) await this.availability.remove(free);
    return { removed: free.length, keptReserved: slots.length - free.length };
  }

  private time(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  }

  async create(
    volunteerId: string,
    input: CreateVolunteerAvailabilityDto,
    user: User,
  ) {
    await this.assertScope(volunteerId, user);
    if (input.endTime <= input.startTime)
      throw new BadRequestException('End time must be after start time');

    const conflicting = await this.availability
      .createQueryBuilder('availability')
      .where('availability.volunteer_id = :volunteerId', { volunteerId })
      .andWhere('availability.date = :date', { date: input.date })
      .andWhere('availability.start_time < :endTime', {
        endTime: input.endTime,
      })
      .andWhere('availability.end_time > :startTime', {
        startTime: input.startTime,
      })
      .getExists();
    if (conflicting)
      throw new ConflictException(
        'Availability slot overlaps an existing slot',
      );

    try {
      return await this.availability.save(
        this.availability.create({
          ...input,
          volunteerId,
          status: AvailabilityStatus.AVAILABLE,
        }),
      );
    } catch (error) {
      const databaseError = error as { driverError?: { code?: string } };
      if (
        error instanceof QueryFailedError &&
        ['23505', '23P01'].includes(databaseError.driverError?.code ?? '')
      )
        throw new ConflictException('Availability slot already exists');
      throw error;
    }
  }

  async findAll(volunteerId: string, user: User) {
    await this.assertScope(volunteerId, user);
    return this.availability.find({
      where: { volunteerId, isHistorical: false },
      order: { date: 'ASC', startTime: 'ASC' },
    });
  }

  async remove(id: string, volunteerId: string, user: User) {
    await this.assertScope(volunteerId, user);
    const item = await this.availability.findOne({
      where: { id, volunteerId, isHistorical: false },
    });
    if (!item) throw new NotFoundException('Availability slot not found');
    if (item.status === AvailabilityStatus.RESERVED)
      throw new ConflictException('Reserved availability cannot be removed');
    await this.availability.remove(item);
  }

  private async assertScope(volunteerId: string, user: User) {
    const volunteer = await this.volunteers.findOne({
      where: { id: volunteerId },
    });
    if (!volunteer) throw new NotFoundException('Volunteer not found');
    if (volunteer.isAnonymous)
      throw new BadRequestException(
        'Anonymous volunteers cannot have availability',
      );
    if (!volunteer.isActive)
      throw new ConflictException('Volunteer is inactive');
    if (user.role === UserRole.VOLUNTEER && volunteer.userId !== user.id)
      throw new ForbiddenException(
        'Volunteers can only manage their own availability',
      );
    return volunteer;
  }
}
