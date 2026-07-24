import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { UserRole } from '../database/entities/user-role.enum';
import { User } from '../database/entities/user.entity';
import {
  AvailabilityStatus,
  VolunteerAvailability,
} from '../database/entities/volunteer-availability.entity';
import { Volunteer } from '../database/entities/volunteer.entity';
import { CreateVolunteerAvailabilityDto } from './volunteer-availability.dto';

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
        databaseError.driverError?.code === '23505'
      )
        throw new ConflictException('Availability slot already exists');
      throw error;
    }
  }

  async findAll(volunteerId: string, user: User) {
    await this.assertScope(volunteerId, user);
    return this.availability.find({
      where: { volunteerId },
      order: { date: 'ASC', startTime: 'ASC' },
    });
  }

  async remove(id: string, volunteerId: string, user: User) {
    await this.assertScope(volunteerId, user);
    const item = await this.availability.findOne({
      where: { id, volunteerId },
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
    if (!volunteer.isActive)
      throw new ConflictException('Volunteer is inactive');
    if (user.role === UserRole.VOLUNTEER && volunteer.userId !== user.id)
      throw new ForbiddenException(
        'Volunteers can only manage their own availability',
      );
    return volunteer;
  }
}
