import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { FollowUpStatus } from '../database/entities/follow-up.enums';
import { FollowUp } from '../database/entities/follow-up.entity';
import { Reminder } from '../database/entities/reminder.entity';
import { ReminderStatus } from '../database/entities/reminder-status.enum';
import { Patient } from '../database/entities/patient.entity';
import { CallCenterWorkloadResponseDto } from './call-center.dto';

@Injectable()
export class CallCenterService {
  constructor(
    @InjectRepository(Agent) private readonly agents: Repository<Agent>,
    @InjectRepository(FollowUp)
    private readonly followUps: Repository<FollowUp>,
    @InjectRepository(Reminder)
    private readonly reminders: Repository<Reminder>,
    @InjectRepository(Patient) private readonly patients: Repository<Patient>,
  ) {}

  async workload(): Promise<CallCenterWorkloadResponseDto> {
    const [agents, scheduledFollowUps, pendingReminders] = await Promise.all([
      this.agents.find({ order: { fullName: 'ASC' } }),
      this.followUps.find({
        where: { status: FollowUpStatus.SCHEDULED },
        order: { scheduledAt: 'ASC', createdAt: 'DESC' },
      }),
      this.reminders.find({
        where: { status: ReminderStatus.PENDING },
        order: { dueAt: 'ASC' },
      }),
    ]);
    const patientIds = [
      ...new Set([
        ...scheduledFollowUps.map((item) => item.subjectPatientId),
        ...pendingReminders.map((item) => item.subjectPatientId),
      ]),
    ];
    const patients = patientIds.length
      ? await this.patients.findBy({ id: In(patientIds) })
      : [];
    const patientNames = new Map(
      patients.map((patient) => [patient.id, patient.fullName]),
    );

    return {
      agents: agents.map((agent) => ({
        id: agent.id,
        fullName: agent.fullName,
      })),
      scheduledFollowUps: scheduledFollowUps.map((followUp) => ({
        id: followUp.id,
        subjectPatientId: followUp.subjectPatientId,
        subjectPatientName:
          patientNames.get(followUp.subjectPatientId) ?? 'Paciente desconocido',
        agentId: followUp.agentId,
        type: followUp.type,
        purpose: followUp.purpose,
        scheduledAt: followUp.scheduledAt,
      })),
      pendingReminders: pendingReminders.map((reminder) => ({
        id: reminder.id,
        subjectPatientId: reminder.subjectPatientId,
        subjectPatientName:
          patientNames.get(reminder.subjectPatientId) ?? 'Paciente desconocido',
        assignedAgentId: reminder.assignedAgentId,
        description: reminder.description,
        dueAt: reminder.dueAt,
      })),
    };
  }
}
