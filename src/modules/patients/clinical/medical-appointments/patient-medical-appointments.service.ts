import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { HealthCenter } from '../../../../database/entities/health-center.entity';
import { FollowUp } from '../../../../database/entities/follow-up.entity';
import { MedicalAppointmentStatus } from '../../../../database/entities/medical-appointment-status.enum';
import { PatientMedicalAppointment } from '../../../../database/entities/patient-medical-appointment.entity';
import { PatientRole } from '../../../../database/entities/patient-role.enum';
import { HistoryVersioningService } from '../../history-versioning/history-versioning.service';
import { PatientsService } from '../../patients.service';
import { PatientSummaryInvalidationService } from '../../../patient-summaries/patient-summary-invalidation.service';
import { CreatePatientMedicalAppointmentDto } from './dto/create-patient-medical-appointment.dto';
import { User } from '../../../../database/entities/user.entity';
import { N8nTransactionalDispatchService } from '../../../../integrations/n8n/transactional-dispatch.service';
import { citaEnvelopeFor } from './cita-envelope';
import { normalizeReferralFields } from './referral-fields';
import type { CreateHistoricalMedicalAppointmentDto } from '../../../historical-records/dto/create-historical-medical-appointment.dto';
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
    dispatchWebhook = true,
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
          {
            ...normalizeReferralFields(input),
            patientId,
            status: MedicalAppointmentStatus.SCHEDULED,
            isHistorical: false,
          },
          manager,
        )
      : this.versioning.replaceCurrent(
          PatientMedicalAppointment,
          { patientId, specialty: input.specialty, isCurrent: true },
          {
            ...normalizeReferralFields(input),
            patientId,
            status: MedicalAppointmentStatus.SCHEDULED,
            isHistorical: false,
          },
        ));
    await this.invalidations.markDirty(patientId, manager);
    if (dispatchWebhook)
      await this.webhooks.enqueue(
        citaEnvelopeFor(patient, appointment),
        manager,
      );
    return appointment;
  }

  async createHistorical(
    input: CreateHistoricalMedicalAppointmentDto,
    historicalLoadedById: string,
    manager?: EntityManager,
  ) {
    const work = async (transactionManager: EntityManager) => {
      const patient = await this.patients.assertPatientRole(
        input.patientId,
        PatientRole.PATIENT,
        undefined,
        transactionManager,
      );
      const followUps = transactionManager.getRepository(FollowUp);
      if (
        !(await followUps.existsBy({
          id: input.followUpId,
          subjectPatientId: input.patientId,
        }))
      )
        throw new NotFoundException('Follow-up not found');
      if (
        input.appointmentDate &&
        input.nextAppointmentDate &&
        input.nextAppointmentDate < input.appointmentDate
      )
        throw new BadRequestException(
          'nextAppointmentDate cannot be before appointmentDate',
        );
      if (!input.specialty.trim())
        throw new BadRequestException('specialty is required');
      if (input.appointmentTime && !input.appointmentDate)
        throw new BadRequestException(
          'appointmentTime requires appointmentDate',
        );
      if (
        input.healthCenterId &&
        !(await transactionManager
          .getRepository(HealthCenter)
          .existsBy({ id: input.healthCenterId }))
      )
        throw new NotFoundException('Health center not found');
      const referral = normalizeReferralFields(input);

      const repository = transactionManager.getRepository(
        PatientMedicalAppointment,
      );
      const appointment = await repository.save(
        repository.create({
          patientId: patient.id,
          followUpId: input.followUpId,
          healthCenterId: input.healthCenterId ?? null,
          specialty: input.specialty,
          appointmentDate: input.appointmentDate ?? null,
          appointmentTime: input.appointmentTime ?? null,
          nextAppointmentDate: input.nextAppointmentDate ?? null,
          nextAppointmentSpecialty: input.nextAppointmentSpecialty ?? null,
          hasReferralSheet: referral.hasReferralSheet ?? null,
          referredTo: referral.referredTo ?? null,
          referralNotProvidedReason: referral.referralNotProvidedReason ?? null,
          difficulties: input.difficulties ?? null,
          isFirstConsultation: input.isFirstConsultation ?? false,
          status: input.status,
          reminderId: null,
          attendedViaSepa: input.attendedViaSepa ?? null,
          referredViaSepa: input.referredViaSepa ?? null,
          isCurrent: false,
          isHistorical: true,
          historicalLoadedById,
          changeReason: input.changeReason ?? null,
        }),
      );
      await this.invalidations.markDirty(patient.id, transactionManager);
      return repository.findOneOrFail({
        where: { id: appointment.id },
        relations: { patient: true, healthCenter: true },
      });
    };

    if (manager) return work(manager);
    return this.repository.manager.transaction(work);
  }
  async findAll(patientId: string, user: User) {
    await this.patients.assertCanRead(patientId, user);
    return this.repository.find({
      where: { patientId },
      order: { appointmentDate: 'DESC', createdAt: 'DESC', id: 'DESC' },
    });
  }
}
