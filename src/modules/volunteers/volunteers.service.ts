import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UserRole } from '../../database/entities/user-role.enum';
import { User } from '../../database/entities/user.entity';
import { Volunteer } from '../../database/entities/volunteer.entity';
import { UsersService } from '../users/users.service';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';

@Injectable()
export class VolunteersService {
  constructor(
    @InjectRepository(Volunteer)
    private readonly volunteersRepository: Repository<Volunteer>,
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
  ) {}
  create(input: CreateVolunteerDto): Promise<Volunteer> {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.usersService.createWithManager(
        {
          email: input.email,
          password: input.password,
          role: UserRole.VOLUNTEER,
        },
        manager,
      );
      return manager.getRepository(Volunteer).save(
        manager.getRepository(Volunteer).create({
          userId: user.id,
          firstName: input.firstName,
          lastName: input.lastName,
          specialty: input.specialty,
          email: input.email,
          phone: input.phone,
          birthDate: input.birthDate ?? null,
          commitmentStartAt: input.commitmentStartAt ?? null,
          commitmentEndAt: input.commitmentEndAt ?? null,
          hasVolunteerCertificate: input.hasVolunteerCertificate ?? false,
          additionalComments: input.additionalComments ?? null,
          completedSustainabilityModule:
            input.completedSustainabilityModule ?? false,
          completedDesignThinkingModule:
            input.completedDesignThinkingModule ?? false,
        }),
      );
    });
  }
  findAll(user?: User): Promise<Volunteer[]> {
    return this.volunteersRepository.find({
      where:
        user?.role === UserRole.VOLUNTEER
          ? { userId: user.id, isAnonymous: false }
          : { isAnonymous: false },
      relations: { user: true },
    });
  }
  async findById(id: string): Promise<Volunteer> {
    const volunteer = await this.volunteersRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!volunteer) throw new NotFoundException('Volunteer not found');
    return volunteer;
  }
  async update(id: string, input: UpdateVolunteerDto): Promise<Volunteer> {
    const volunteer = await this.findById(id);
    if (input.email !== undefined) {
      const updatedUser = await this.usersService.updateEmail(
        volunteer.userId,
        input.email,
      );
      volunteer.email = updatedUser.email;
    }
    const profileFields = { ...input };
    delete profileFields.email;
    Object.assign(volunteer, profileFields);
    return this.volunteersRepository.save(volunteer);
  }
  async deactivate(id: string): Promise<Volunteer> {
    const volunteer = await this.findById(id);
    await this.usersService.setActive(volunteer.userId, false);
    return this.findById(id);
  }
  async setAvailability(id: string, isActive: boolean): Promise<Volunteer> {
    const volunteer = await this.findById(id);
    volunteer.isActive = isActive;
    return this.volunteersRepository.save(volunteer);
  }
}
