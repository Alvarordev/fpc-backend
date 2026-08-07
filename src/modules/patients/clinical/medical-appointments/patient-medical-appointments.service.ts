import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { FollowUp } from '../../../../database/entities/follow-up.entity';
import { PatientMedicalAppointment } from '../../../../database/entities/patient-medical-appointment.entity';
import { PatientRole } from '../../../../database/entities/patient-role.enum';
import { HistoryVersioningService } from '../../history-versioning/history-versioning.service';
import { PatientsService } from '../../patients.service';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientMedicalAppointmentDto } from './patient-medical-appointments.dto';
import { User } from '../../../../database/entities/user.entity';
import { N8nTransactionalDispatchService } from '../../../../integrations/n8n/transactional-dispatch.service';
import { citaEnvelopeFor } from './cita-envelope';
@Injectable()
export class PatientMedicalAppointmentsService {
  constructor(
    @InjectRepository(PatientMedicalAppointment)
    private readonly repository: Repository<PatientMedicalAppointment>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    private readonly patients: PatientsService,
    private readonly versioning: HistoryVersioningService,
    private readonly invalidations: PatientSummaryInvalidationService,
    private readonly webhooks: N8nTransactionalDispatchService,
  ) {}
  async create(
    patientId: string,
    input: CreatePatientMedicalAppointmentDto,
    manager?: EntityManager,
  ) {
    const patient = await this.patients.assertPatientRole(
      patientId,
      PatientRole.PATIENT,
      undefined,
      manager,
    );
    if (
      !(await (manager?.getRepository(FollowUp) ?? this.followUps).existsBy({
        id: input.followUpId,
        subjectPatientId: patientId,
      }))
    )
      throw new NotFoundException('Follow-up not found');
    const appointment = await (manager
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
        ));
    await this.invalidations.markDirty(patientId, manager);
    await this.webhooks.enqueue(citaEnvelopeFor(patient, appointment), manager);
    return appointment;
  }
  async findAll(patientId: string, user: User) {
    await this.patients.assertCanRead(patientId, user);
    return this.repository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }
}
