import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { PsychooncologyAppointment } from '../database/entities/psychooncology-appointment.entity';
import { UserRole } from '../database/entities/user-role.enum';
import { User } from '../database/entities/user.entity';
import { Volunteer } from '../database/entities/volunteer.entity';
import { Patient } from '../database/entities/patient.entity';

@Injectable()
export class PatientAccessService {
  constructor(
    @InjectRepository(Patient)
    private readonly patients: Repository<Patient>,
    @InjectRepository(Volunteer)
    private readonly volunteers: Repository<Volunteer>,
    @InjectRepository(PsychooncologyAppointment)
    private readonly appointments: Repository<PsychooncologyAppointment>,
  ) {}

  async assertCanRead(patientId: string, user: User): Promise<void> {
    if (!(await this.patients.existsBy({ id: patientId })))
      throw new NotFoundException('Patient not found');
    if (user.role !== UserRole.VOLUNTEER) return;

    const volunteerId = await this.volunteerIdFor(user);
    if (
      !(await this.appointments.existsBy({
        patientId,
        volunteerId: volunteerId!,
      }))
    )
      throw new ForbiddenException('Patient is not assigned to this volunteer');
  }

  async scopeQuery<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    patientIdExpression: string,
    user: User,
    parameterName = 'patientAccessVolunteerId',
  ): Promise<SelectQueryBuilder<T>> {
    if (user.role !== UserRole.VOLUNTEER) return query;

    const volunteerId = await this.volunteerIdFor(user);
    return query.andWhere(
      `EXISTS (
        SELECT 1
        FROM psychooncology_appointments access_appointment
        WHERE access_appointment.patient_id = ${patientIdExpression}
          AND access_appointment.volunteer_id = :${parameterName}
      )`,
      { [parameterName]: volunteerId },
    );
  }

  async volunteerIdFor(user: User): Promise<string | null> {
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
}
