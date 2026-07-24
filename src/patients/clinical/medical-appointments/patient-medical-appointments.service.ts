import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Interaction } from '../../../database/entities/interaction.entity';
import { PatientMedicalAppointment } from '../../entities/patient-medical-appointment.entity';
import { PatientRole } from '../../entities/patient-role.enum';
import { HistoryVersioningService } from '../../history-versioning/history-versioning.service';
import { PatientsService } from '../../patients.service';
import { CreatePatientMedicalAppointmentDto } from './patient-medical-appointments.dto';
@Injectable()
export class PatientMedicalAppointmentsService {
  constructor(
    @InjectRepository(PatientMedicalAppointment)
    private readonly repository: Repository<PatientMedicalAppointment>,
    @InjectRepository(Interaction)
    private readonly interactions: Repository<Interaction>,
    private readonly patients: PatientsService,
    private readonly versioning: HistoryVersioningService,
  ) {}
  async create(
    patientId: string,
    input: CreatePatientMedicalAppointmentDto,
    manager?: EntityManager,
  ) {
    await this.patients.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      undefined,
      manager,
    );
    if (
      !(await (
        manager?.getRepository(Interaction) ?? this.interactions
      ).existsBy({ id: input.interactionId }))
    )
      throw new NotFoundException('Interaction not found');
    return manager
      ? this.versioning.replaceCurrent(
          PatientMedicalAppointment,
          { patientId, specialty: input.specialty, isCurrent: true },
          { ...input, patientId },
          manager,
        )
      : this.versioning.replaceCurrent(
          PatientMedicalAppointment,
          { patientId, specialty: input.specialty, isCurrent: true },
          { ...input, patientId },
        );
  }
  findAll(patientId: string) {
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
