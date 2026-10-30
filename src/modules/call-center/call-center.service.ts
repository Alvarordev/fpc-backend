import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Agent } from '../../database/entities/agent.entity';
import { FollowUpStatus } from '../../database/entities/follow-up.enums';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { Reminder } from '../../database/entities/reminder.entity';
import { ReminderStatus } from '../../database/entities/reminder-status.enum';
import { Patient } from '../../database/entities/patient.entity';
import { dateOnlyInLima } from '../../shared/date-only/date-only.util';
import { PatientSummaryInvalidationService } from '../patient-summaries/patient-summary-invalidation.service';
import {
  CallCenterPendingCountsDto,
  CallCenterWorkloadResponseDto,
} from './dto/call-center-response.dto';
import { ReassignFollowUpsDto } from './dto/reassign-follow-ups.dto';

const PENDING_FOLLOW_UP = [FollowUpStatus.SCHEDULED, FollowUpStatus.OVERDUE];

// An overdue follow-up stops being pending once it has been rescheduled.
const isPending = (item: FollowUp) =>
  (item.status === FollowUpStatus.SCHEDULED ||
    (item.status === FollowUpStatus.OVERDUE && !item.nextFollowUpId));

function sundayOf(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + ((7 - date.getUTCDay()) % 7));
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class CallCenterService {
  constructor(
    @InjectRepository(Agent) private readonly agents: Repository<Agent>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    @InjectRepository(Reminder)
    private readonly reminders: Repository<Reminder>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
    private readonly dataSource: DataSource,
    private readonly invalidations: PatientSummaryInvalidationService,
  ) {}

  async workload(): Promise<CallCenterWorkloadResponseDto> {
    const today = dateOnlyInLima(new Date());
    const weekEnd = sundayOf(today);
    const [agents, followUps, pendingReminders] = await Promise.all([
      this.agents.find({ order: { fullName: 'ASC' } }),
      this.followUps.find({
        where: { status: In(PENDING_FOLLOW_UP) },
        order: { scheduledOn: 'ASC', scheduledAt: 'ASC', createdAt: 'DESC' },
      }),
      this.reminders.find({
        where: {
          status: ReminderStatus.PENDING,
        },
        order: { dueAt: 'ASC' },
      }),
    ]);
    const pendingFollowUps = followUps.filter(isPending);
    const patientIds = [
      ...new Set([
        ...pendingFollowUps.map((item) => item.subjectPatientId),
        ...pendingReminders.map((item) => item.subjectPatientId),
      ]),
    ];
    const patients = patientIds.length
      ? await this.patients.findBy({ id: In(patientIds) })
      : [];
    const patientNames = new Map(
      patients.map((patient) => [patient.id, patient.fullName]),
    );

    const empty = (): CallCenterPendingCountsDto => ({
      today: 0,
      week: 0,
      overdue: 0,
    });
    const load = new Map(
      agents.map((agent) => [
        agent.id,
        {
          agentId: agent.id,
          fullName: agent.fullName,
          followUps: empty(),
          reminders: empty(),
        },
      ]),
    );
    const count = (
      counts: CallCenterPendingCountsDto | undefined,
      day: string | null,
      overdue = false,
    ) => {
      if (!counts) return;
      if (overdue || (day && day < today)) counts.overdue++;
      else if (day && day <= weekEnd) {
        counts.week++;
        if (day === today) counts.today++;
      }
    };
    for (const followUp of pendingFollowUps)
      count(
        load.get(followUp.agentId)?.followUps,
        followUp.scheduledOn ??
          (followUp.scheduledAt ? dateOnlyInLima(followUp.scheduledAt) : null),
        followUp.status === FollowUpStatus.OVERDUE,
      );
    for (const reminder of pendingReminders)
      count(
        load.get(reminder.assignedAgentId)?.reminders,
        reminder.dueOn ?? (reminder.dueAt ? dateOnlyInLima(reminder.dueAt) : null),
      );

    return {
      today,
      weekEnd,
      agents: agents.map((agent) => ({
        id: agent.id,
        fullName: agent.fullName,
      })),
      load: [...load.values()],
      scheduledFollowUps: pendingFollowUps.map((followUp) => ({
        id: followUp.id,
        subjectPatientId: followUp.subjectPatientId,
        subjectPatientName:
          patientNames.get(followUp.subjectPatientId) ?? 'Paciente desconocido',
        agentId: followUp.agentId,
        status: followUp.status,
        type: followUp.type,
        purpose: followUp.purpose,
        scheduledAt: followUp.scheduledAt,
        scheduledOn: followUp.scheduledOn,
      })),
      pendingReminders: pendingReminders.map((reminder) => ({
        id: reminder.id,
        subjectPatientId: reminder.subjectPatientId,
        subjectPatientName:
          patientNames.get(reminder.subjectPatientId) ?? 'Paciente desconocido',
        assignedAgentId: reminder.assignedAgentId,
        description: reminder.description,
        dueAt: reminder.dueAt,
        dueOn: reminder.dueOn,
      })),
    };
  }

  // The change of agent is recorded by the change_log trigger on follow_ups.
  async reassign(input: ReassignFollowUpsDto) {
    return this.dataSource.transaction(async (manager) => {
      if (!(await manager.getRepository(Agent).existsBy({ id: input.agentId })))
        throw new NotFoundException('No se encontró el agente.');
      const followUps = manager.getRepository(FollowUp);
      const items = await followUps.findBy({ id: In(input.followUpIds) });
      if (items.length !== input.followUpIds.length)
        throw new NotFoundException('No se encontró el seguimiento.');
      if (!items.every(isPending))
        throw new BadRequestException(
          'Solo se puede reasignar un seguimiento programado o vencido.',
        );
      const changed = items.filter((item) => item.agentId !== input.agentId);
      for (const item of changed) {
        item.agentId = input.agentId;
        await followUps.save(item);
      }
      for (const patientId of new Set(changed.map((i) => i.subjectPatientId)))
        await this.invalidations.markDirty(patientId, manager);
      return { reassigned: changed.length };
    });
  }
}
