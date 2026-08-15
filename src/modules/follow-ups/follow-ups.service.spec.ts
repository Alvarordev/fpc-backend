import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Agent } from '../../database/entities/agent.entity';
import { FollowUp } from '../../database/entities/follow-up.entity';
import {
  FollowUpPurpose,
  FollowUpStatus,
  FollowUpType,
} from '../../database/entities/follow-up.enums';
import { Patient } from '../../database/entities/patient.entity';
import { Reminder } from '../../database/entities/reminder.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { PatientAccessService } from '../patients/access/patient-access.service';
import { PatientSummaryInvalidationService } from '../patient-summaries/patient-summary-invalidation.service';
import { CreateFollowUpsBatchDto } from './dto/create-follow-ups-batch.dto';
import { FollowUpsService } from './follow-ups.service';

describe('FollowUpsService.createBatch', () => {
  const patientId = 'patient-1';
  const agentId = 'agent-1';
  let service: FollowUpsService;
  let saved: Partial<FollowUp>[];
  let transaction: jest.Mock;

  const future = (days: number): string =>
    new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  beforeEach(() => {
    saved = [];
    const followUps = {
      create: jest.fn((input: Partial<FollowUp>) => input),
      save: jest.fn((input: Partial<FollowUp>) => {
        const followUp = {
          ...input,
          id: `follow-up-${saved.length + 1}`,
        } as FollowUp;
        saved.push(followUp);
        return Promise.resolve(followUp);
      }),
    } as unknown as Repository<FollowUp>;
    const patients = {
      countBy: jest.fn().mockResolvedValue(1),
      existsBy: jest.fn().mockResolvedValue(true),
    } as unknown as Repository<Patient>;
    const agents = {
      existsBy: jest.fn().mockResolvedValue(true),
    } as unknown as Repository<Agent>;
    const reminders = {} as Repository<Reminder>;
    const manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === FollowUp) return followUps;
        if (entity === Patient) return patients;
        if (entity === Agent) return agents;
        return reminders;
      }),
    };
    transaction = jest.fn((work: (manager: typeof manager) => unknown) =>
      work(manager),
    );
    const dataSource = { transaction } as unknown as DataSource;
    const invalidations = {
      markDirty: jest.fn(),
    } as unknown as PatientSummaryInvalidationService;
    const access = {} as PatientAccessService;

    service = new FollowUpsService(
      followUps,
      patients,
      agents,
      reminders,
      dataSource,
      invalidations,
      access,
    );
  });

  it('creates all future follow-ups independently in one transaction', async () => {
    const input: CreateFollowUpsBatchDto = {
      followUps: [
        {
          subjectPatientId: patientId,
          interlocutorId: patientId,
          agentId,
          type: FollowUpType.CALL,
          purpose: FollowUpPurpose.FOLLOW_UP,
          scheduledAt: future(1),
        },
        {
          subjectPatientId: patientId,
          interlocutorId: patientId,
          agentId,
          type: FollowUpType.WHATSAPP,
          purpose: FollowUpPurpose.FOLLOW_UP,
          scheduledAt: future(2),
        },
      ],
    };

    const result = await service.createBatch(input, 'admin-1', UserRole.ADMIN);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
    expect(result.map((followUp) => followUp.status)).toEqual([
      FollowUpStatus.SCHEDULED,
      FollowUpStatus.SCHEDULED,
    ]);
    expect(result.map((followUp) => followUp.nextFollowUpId)).toEqual([
      undefined,
      undefined,
    ]);
    expect(saved).toHaveLength(2);
  });

  it('rejects mixed patients before starting the transaction', async () => {
    const input: CreateFollowUpsBatchDto = {
      followUps: [
        {
          subjectPatientId: patientId,
          interlocutorId: patientId,
          agentId,
          type: FollowUpType.CALL,
          purpose: FollowUpPurpose.FOLLOW_UP,
          scheduledAt: future(1),
        },
        {
          subjectPatientId: 'patient-2',
          interlocutorId: 'patient-2',
          agentId,
          type: FollowUpType.CALL,
          purpose: FollowUpPurpose.FOLLOW_UP,
          scheduledAt: future(2),
        },
      ],
    };

    await expect(
      service.createBatch(input, 'admin-1', UserRole.ADMIN),
    ).rejects.toThrow(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects non-future follow-ups', async () => {
    const input: CreateFollowUpsBatchDto = {
      followUps: [
        {
          subjectPatientId: patientId,
          interlocutorId: patientId,
          agentId,
          type: FollowUpType.CALL,
          purpose: FollowUpPurpose.FOLLOW_UP,
          scheduledAt: new Date(Date.now() - 1000).toISOString(),
        },
      ],
    };

    await expect(
      service.createBatch(input, 'admin-1', UserRole.ADMIN),
    ).rejects.toThrow(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
