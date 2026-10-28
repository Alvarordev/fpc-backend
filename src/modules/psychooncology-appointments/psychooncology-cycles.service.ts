import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  AppointmentStatus,
  PENDING_APPOINTMENT_STATUSES,
  PsychooncologyAppointment,
} from '../../database/entities/psychooncology-appointment.entity';
import {
  PSYCHOONCOLOGY_BASE_CYCLE_SESSIONS,
  PsychooncologyCycle,
} from '../../database/entities/psychooncology-cycle.entity';
import { User } from '../../database/entities/user.entity';
import { PatientAccessService } from '../patients/access/patient-access.service';
import { ClosePsychooncologyCycleDto } from './dto/close-psychooncology-cycle.dto';
import { PsychooncologyCycleResponseDto } from './dto/psychooncology-cycle-response.dto';

@Injectable()
export class PsychooncologyCyclesService {
  constructor(
    @InjectRepository(PsychooncologyCycle)
    private readonly cycles: Repository<PsychooncologyCycle>,
    private readonly dataSource: DataSource,
    private readonly access: PatientAccessService,
  ) {}

  async findByPatient(patientId: string, user: User) {
    await this.access.assertCanRead(patientId, user);
    const cycles = await this.cycles.find({
      where: { patientId },
      order: { openedAt: 'DESC' },
    });
    return this.withCounts(cycles);
  }

  /** Closing is always a manual decision of the team (P13). */
  async close(id: string, input: ClosePsychooncologyCycleDto, user: User) {
    const cycle = await this.dataSource.transaction(async (manager) => {
      const cycle = await manager
        .getRepository(PsychooncologyCycle)
        .createQueryBuilder('cycle')
        .setLock('pessimistic_write')
        .where('cycle.id = :id', { id })
        .getOne();
      if (!cycle)
        throw new NotFoundException('Psycho-oncology cycle not found');
      await this.access.assertCanRead(cycle.patientId, user);
      if (cycle.closedAt)
        throw new ConflictException('Psycho-oncology cycle is already closed');
      const pending = await manager
        .getRepository(PsychooncologyAppointment)
        .existsBy({
          cycleId: cycle.id,
          status: In(PENDING_APPOINTMENT_STATUSES),
        });
      if (pending)
        throw new ConflictException(
          'Cancel or resolve the scheduled sessions of the cycle before closing it',
        );
      const closedAt = input.closedAt ? new Date(input.closedAt) : new Date();
      if (closedAt > new Date())
        throw new BadRequestException('closedAt cannot be in the future');
      if (closedAt < cycle.openedAt)
        throw new BadRequestException(
          'closedAt cannot be before the cycle was opened',
        );
      cycle.closedAt = closedAt;
      cycle.closeReason = input.reason;
      cycle.closedById = user.id;
      cycle.notes = input.notes ?? cycle.notes;
      return manager.getRepository(PsychooncologyCycle).save(cycle);
    });
    return (await this.withCounts([cycle]))[0];
  }

  private async withCounts(
    cycles: PsychooncologyCycle[],
  ): Promise<PsychooncologyCycleResponseDto[]> {
    const counts = cycles.length
      ? await this.dataSource
          .getRepository(PsychooncologyAppointment)
          .createQueryBuilder('appointment')
          .select('appointment.cycle_id', 'cycleId')
          .addSelect('COUNT(*)::int', 'sessions')
          .addSelect(
            `COUNT(*) FILTER (WHERE appointment.status = '${AppointmentStatus.COMPLETED}')::int`,
            'completed',
          )
          .addSelect(
            'COUNT(*) FILTER (WHERE appointment.is_additional_session)::int',
            'additional',
          )
          .where('appointment.cycle_id IN (:...ids)', {
            ids: cycles.map((cycle) => cycle.id),
          })
          .andWhere('appointment.status NOT IN (:...excluded)', {
            excluded: [
              AppointmentStatus.CANCELLED,
              AppointmentStatus.RESCHEDULED,
            ],
          })
          .groupBy('appointment.cycle_id')
          .getRawMany<{
            cycleId: string;
            sessions: number;
            completed: number;
            additional: number;
          }>()
      : [];
    const byCycle = new Map(counts.map((row) => [row.cycleId, row]));
    return cycles.map((cycle) => {
      const row = byCycle.get(cycle.id);
      return {
        id: cycle.id,
        patientId: cycle.patientId,
        openedAt: cycle.openedAt,
        closedAt: cycle.closedAt,
        closeReason: cycle.closeReason,
        closedById: cycle.closedById,
        notes: cycle.notes,
        baseSessions: PSYCHOONCOLOGY_BASE_CYCLE_SESSIONS,
        sessionCount: row?.sessions ?? 0,
        completedSessionCount: row?.completed ?? 0,
        additionalSessionCount: row?.additional ?? 0,
        createdAt: cycle.createdAt,
      };
    });
  }
}
