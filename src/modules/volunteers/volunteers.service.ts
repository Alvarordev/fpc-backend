import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  PsychooncologyAppointment,
} from '../../database/entities/psychooncology-appointment.entity';
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
  findAll(): Promise<Volunteer[]> {
    return this.volunteersRepository.find({
      where: { isAnonymous: false },
      relations: { user: true },
    });
  }
  async findByUser(userId: string): Promise<Volunteer> {
    const volunteer = await this.volunteersRepository.findOne({
      where: { userId },
      relations: { user: true },
    });
    if (!volunteer) throw new NotFoundException('No se encontró el voluntario.');
    return volunteer;
  }
  async findVisible(id: string, user: User): Promise<Volunteer> {
    const volunteer = await this.findById(id);
    if (user.role === UserRole.VOLUNTEER && volunteer.userId !== user.id)
      throw new ForbiddenException(
        'Solo puedes ver tu propio perfil.',
      );
    return volunteer;
  }
  async findById(id: string): Promise<Volunteer> {
    const volunteer = await this.volunteersRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!volunteer) throw new NotFoundException('No se encontró el voluntario.');
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
    await this.flagFutureSessions(volunteer.id, true);
    return this.findById(id);
  }
  async setAvailability(id: string, isActive: boolean): Promise<Volunteer> {
    const volunteer = await this.findById(id);
    volunteer.isActive = isActive;
    const saved = await this.volunteersRepository.save(volunteer);
    if (!isActive) await this.flagFutureSessions(volunteer.id, true);
    else if (volunteer.user.isActive)
      await this.flagFutureSessions(volunteer.id, false);
    return saved;
  }

  /**
   * P9: future sessions of a leaving volunteer must be reassigned. The team
   * sees them in GET /psychooncology-appointments/needs-reassignment; hospital
   * alerts (AL2) are not the channel for this.
   */
  private flagFutureSessions(volunteerId: string, needsReassignment: boolean) {
    return this.dataSource.transaction((manager) =>
      manager
        .createQueryBuilder()
        .update(PsychooncologyAppointment)
        .set({ needsReassignment })
        .where('volunteer_id = :volunteerId', { volunteerId })
        .andWhere('status = :status', { status: AppointmentStatus.SCHEDULED })
        .andWhere('is_historical = false')
        .andWhere('scheduled_at >= now()')
        .execute(),
    );
  }
}
