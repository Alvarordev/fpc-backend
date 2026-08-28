import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { FollowUp } from '../../../database/entities/follow-up.entity';
import { Patient } from '../../../database/entities/patient.entity';
import { PatientDiagnosticStatusEvent } from '../../../database/entities/patient-diagnostic-status-event.entity';
import { PatientDiagnosticStatus } from '../../../database/entities/patient-diagnostic-status.enum';
import { PatientHealthPhase } from '../../../database/entities/patient-health-phase.enum';
import { PatientRole } from '../../../database/entities/patient-role.enum';
import { User } from '../../../database/entities/user.entity';
import { CreatePatientDiagnosisDto } from '../clinical/diagnoses/dto/create-patient-diagnosis.dto';
import { PatientDiagnosesService } from '../clinical/diagnoses/patient-diagnoses.service';
import { PatientsService } from '../patients.service';
import { PatientSummaryInvalidationService } from '../../patient-summaries/patient-summary-invalidation.service';
import { PatientDiagnosticStatusEventResponseDto } from './dto/patient-diagnostic-status-event-response.dto';
import { TransitionPatientDiagnosticStatusDto } from './dto/transition-patient-diagnostic-status.dto';

@Injectable()
export class PatientDiagnosticStatusesService {
  constructor(
    @InjectRepository(PatientDiagnosticStatusEvent)
    private readonly events: Repository<PatientDiagnosticStatusEvent>,
    private readonly dataSource: DataSource,
    private readonly patients: PatientsService,
    private readonly diagnoses: PatientDiagnosesService,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}

  async recordSearching(
    patientId: string,
    followUpId: string,
    manager: EntityManager,
    occurredAt = new Date(),
  ): Promise<PatientDiagnosticStatusEvent> {
    await this.assertFollowUp(patientId, followUpId, manager);
    const repository = manager.getRepository(PatientDiagnosticStatusEvent);
    const existing = await repository.findOne({
      where: {
        patientId,
        followUpId,
        status: PatientDiagnosticStatus.SEARCHING,
      },
    });
    if (existing) return existing;
    const event = await repository.save(
      repository.create({
        patientId,
        followUpId,
        status: PatientDiagnosticStatus.SEARCHING,
        occurredAt,
        reportedDiagnosis: null,
        diagnosisId: null,
        supportedBySepa: null,
        notes: null,
      }),
    );
    await this.invalidations.markDirty(patientId, manager);
    return event;
  }

  async findAll(
    patientId: string,
    user: User,
  ): Promise<PatientDiagnosticStatusEvent[]> {
    await this.patients.assertCanRead(patientId, user);
    return this.events.find({
      where: { patientId },
      order: { occurredAt: 'DESC', createdAt: 'DESC', id: 'DESC' },
    });
  }

  async findCurrent(
    patientId: string,
    user: User,
  ): Promise<PatientDiagnosticStatusEvent | null> {
    await this.patients.assertCanRead(patientId, user);
    return this.events.findOne({
      where: { patientId },
      order: { occurredAt: 'DESC', createdAt: 'DESC', id: 'DESC' },
    });
  }

  async transition(
    patientId: string,
    input: TransitionPatientDiagnosticStatusDto,
  ): Promise<PatientDiagnosticStatusEvent> {
    return this.dataSource.transaction(async (manager) => {
      const patient = await manager
        .getRepository(Patient)
        .createQueryBuilder('patient')
        .setLock('pessimistic_write')
        .where('patient.id = :patientId', { patientId })
        .getOne();
      if (!patient) throw new NotFoundException('Patient not found');
      if (patient.role !== PatientRole.PATIENT)
        throw new ConflictException(
          'Only a patient can change diagnostic status',
        );
      await this.assertFollowUp(patientId, input.followUpId, manager);

      const events = manager.getRepository(PatientDiagnosticStatusEvent);
      const current = await events.findOne({
        where: { patientId },
        order: { occurredAt: 'DESC', createdAt: 'DESC', id: 'DESC' },
      });
      if (!current || current.status !== PatientDiagnosticStatus.SEARCHING)
        throw new ConflictException(
          'Diagnostic status can only transition from SEARCHING',
        );

      if (
        input.status !== PatientDiagnosticStatus.CONFIRMED &&
        input.status !== PatientDiagnosticStatus.RULED_OUT
      )
        throw new BadRequestException(
          'A diagnostic search can only transition to CONFIRMED or RULED_OUT',
        );
      if (
        input.status === PatientDiagnosticStatus.CONFIRMED &&
        !input.diagnosis
      )
        throw new BadRequestException(
          'A confirmed diagnostic status requires a formal diagnosis',
        );
      if (input.status === PatientDiagnosticStatus.RULED_OUT && input.diagnosis)
        throw new BadRequestException(
          'A ruled-out diagnostic status cannot include a formal diagnosis',
        );

      let diagnosisId: string | null = null;
      if (input.status === PatientDiagnosticStatus.CONFIRMED) {
        const diagnosis = await this.diagnoses.create(
          patientId,
          {
            ...(input.diagnosis as CreatePatientDiagnosisDto),
            followUpId: input.followUpId,
          },
          manager,
        );
        diagnosisId = diagnosis.id;
        await this.patients.upsertDetails(
          patientId,
          { healthPhase: PatientHealthPhase.CANCER_DIAGNOSIS },
          manager,
        );
      }

      const event = await events.save(
        events.create({
          patientId,
          followUpId: input.followUpId,
          status: input.status,
          occurredAt: input.occurredAt
            ? new Date(input.occurredAt)
            : new Date(),
          reportedDiagnosis: input.diagnosis?.diagnosis ?? null,
          diagnosisId,
          supportedBySepa: input.supportedBySepa ?? null,
          notes: input.notes ?? null,
        }),
      );
      await this.invalidations.markDirty(patientId, manager);
      return event;
    });
  }

  async responseForCurrent(
    patientId: string,
    user: User,
  ): Promise<PatientDiagnosticStatusEventResponseDto | null> {
    const event = await this.findCurrent(patientId, user);
    return event ? PatientDiagnosticStatusEventResponseDto.from(event) : null;
  }

  private async assertFollowUp(
    patientId: string,
    followUpId: string,
    manager: EntityManager,
  ): Promise<void> {
    const exists = await manager.getRepository(FollowUp).existsBy({
      id: followUpId,
      subjectPatientId: patientId,
    });
    if (!exists) throw new NotFoundException('Follow-up not found');
  }
}
