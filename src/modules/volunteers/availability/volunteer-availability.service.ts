import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UserRole } from '../../../database/entities/user-role.enum';
import { User } from '../../../database/entities/user.entity';
import {
  AvailabilityStatus,
  VolunteerAvailability,
} from '../../../database/entities/volunteer-availability.entity';
import { Volunteer } from '../../../database/entities/volunteer.entity';
import { CreateVolunteerAvailabilityDto } from './dto/create-volunteer-availability.dto';

@Injectable()
export class VolunteerAvailabilityService {
  constructor(
    @InjectRepository(VolunteerAvailability)
    private readonly availability: Repository<VolunteerAvailability>,
    @InjectRepository(Volunteer)
    private readonly volunteers: Repository<Volunteer>,
  ) {}

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
