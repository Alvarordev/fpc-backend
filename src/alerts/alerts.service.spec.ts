import { DataSource, Repository } from 'typeorm';
import { AlertsService } from './alerts.service';
import {
  Alert,
  AlertCategory,
  AlertSeverity,
  AlertStatus,
} from '../database/entities/alert.entity';
import { Agent } from '../database/entities/agent.entity';
import { HealthCenter } from '../database/entities/health-center.entity';
import { FollowUp } from '../database/entities/follow-up.entity';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../database/entities/user.entity';
import { UserRole } from '../database/entities/user-role.enum';
import { PatientAccessService } from '../patient-access/patient-access.service';
import { AlertEventsService } from './alert-events.service';
import { CreateAlertDto } from './alerts.dto';
import { N8nTransactionalDispatchService } from '../webhooks/transactional-dispatch.service';

function patientRelationRepo() {
  return {
    findOneOrFail: jest.fn().mockResolvedValue({
      subjectPatient: {
        fullName: 'Paciente Uno',
        dni: '12345678',
        primaryPhone: '999999999',
      },
    }),
  };
}

function healthCenterRelationRepo() {
  return { findOneOrFail: jest.fn().mockResolvedValue({ name: 'Centro' }) };
}

describe('AlertsService', () => {
  const adminUser = { id: 'user-1', role: UserRole.ADMIN } as User;

  function buildService(overrides: {
    ticketSeq?: string;
    existingAlert?: Partial<Alert>;
  }) {
    const agentRow = { id: 'agent-1', fullName: 'Ana Agente' };
    const agents = {
      findOne: jest.fn().mockResolvedValue(agentRow),
    } as unknown as Repository<Agent>;
    const healthCenters = {
      existsBy: jest.fn().mockResolvedValue(true),
    } as unknown as Repository<HealthCenter>;
    const followUps = {
      existsBy: jest.fn().mockResolvedValue(true),
    } as unknown as Repository<FollowUp>;
    const patients = {} as Repository<Patient>;

    const createdAlert = {
      id: 'alert-1',
      ...overrides.existingAlert,
    } as Alert;
    let savedAlert: Partial<Alert> | undefined;

    const alertRepoInTx = {
      create: jest.fn().mockImplementation((data: Partial<Alert>) => data),
      save: jest.fn().mockImplementation((data: Partial<Alert>) => {
        savedAlert = data;
        return Promise.resolve(createdAlert);
      }),
    };
    const followUpRepoInTx = patientRelationRepo();
    const healthCenterRepoInTx = healthCenterRelationRepo();
    const manager = {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        if (entity === FollowUp) return followUpRepoInTx;
        if (entity === HealthCenter) return healthCenterRepoInTx;
        return alertRepoInTx;
      }),
      query: jest
        .fn()
        .mockResolvedValue([{ seq: overrides.ticketSeq ?? '1001' }]),
    };
    const transaction = jest
      .fn()
      .mockImplementation((work: (manager: unknown) => Promise<Alert>) =>
        work(manager),
      );

    const foundAlert = {
      id: 'alert-1',
      followUp: {
        subjectPatientId: 'patient-1',
        subjectPatient: {
          fullName: 'Paciente Uno',
          dni: '12345678',
          primaryPhone: '999999999',
        },
      },
      healthCenter: { name: 'Centro' },
      createdBy: { fullName: 'Ana Agente' },
      ...overrides.existingAlert,
    } as unknown as Alert;
    const getOne = jest.fn().mockResolvedValue(foundAlert);
    const queryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne,
      getMany: jest.fn().mockResolvedValue([foundAlert]),
    };
    const alerts = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<Alert>;

    const access = {
      scopeQuery: jest.fn().mockImplementation((q: unknown) => q),
    } as unknown as PatientAccessService;

    const events = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AlertEventsService;

    const webhooks = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    } as unknown as N8nTransactionalDispatchService;

    const service = new AlertsService(
      alerts,
      agents,
      healthCenters,
      followUps,
      patients,
      { transaction } as unknown as DataSource,
      access,
      events,
      webhooks,
    );
    return {
      service,
      manager,
      queryBuilder,
      getSaved: () => savedAlert! as Alert,
    };
  }

  const baseDto: CreateAlertDto = {
    healthCenterId: 'hc-1',
    followUpId: 'fu-1',
    title: 'Título',
    description: 'Descripción',
  };

  it('generates a ticket number in the ALT-<currentYear>-<seq> format', async () => {
    const { service, getSaved } = buildService({ ticketSeq: '1042' });

    await service.create(baseDto, adminUser);

    expect(getSaved().ticketNumber).toBe(
      `ALT-${new Date().getFullYear()}-1042`,
    );
  });

  it('defaults severity and category when the DTO omits them', async () => {
    const { service, getSaved } = buildService({});

    await service.create(baseDto, adminUser);

    expect(getSaved().severity).toBe(AlertSeverity.HIGH);
    expect(getSaved().category).toBe(AlertCategory.GENERAL);
  });

  it('passes through severity and category when supplied', async () => {
    const { service, getSaved } = buildService({});

    await service.create(
      {
        ...baseDto,
        severity: AlertSeverity.LOW,
        category: AlertCategory.TRANSPORT,
      },
      adminUser,
    );

    expect(getSaved().severity).toBe(AlertSeverity.LOW);
    expect(getSaved().category).toBe(AlertCategory.TRANSPORT);
  });

  it('sets ACTIVE status on create', async () => {
    const { service, getSaved } = buildService({});

    await service.create(baseDto, adminUser);

    expect(getSaved().status).toBe(AlertStatus.ACTIVE);
  });

  describe('update() patch semantics', () => {
    function buildUpdateService() {
      const agents = {} as Repository<Agent>;
      const healthCenters = {
        existsBy: jest.fn().mockResolvedValue(true),
      } as unknown as Repository<HealthCenter>;
      const followUps = {
        existsBy: jest.fn().mockResolvedValue(true),
      } as unknown as Repository<FollowUp>;
      const patients = {} as Repository<Patient>;

      const existingAlert = {
        id: 'alert-1',
        createdById: 'agent-1',
        title: 'Título',
        description: 'Descripción',
        status: AlertStatus.ACTIVE,
        severity: AlertSeverity.HIGH,
        category: AlertCategory.GENERAL,
        underReview: false,
        derivedTo: null,
        derivationNotes: null,
      } as unknown as Alert;

      let savedAlert: Alert | undefined;
      const txAlertRepo = {
        createQueryBuilder: jest.fn().mockReturnValue({
          setLock: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(existingAlert),
        }),
        save: jest.fn().mockImplementation((data: Alert) => {
          savedAlert = data;
          return Promise.resolve(data);
        }),
      };
      const followUpRepoInTx = patientRelationRepo();
      const healthCenterRepoInTx = healthCenterRelationRepo();
      const manager = {
        getRepository: jest.fn().mockImplementation((entity: unknown) => {
          if (entity === FollowUp) return followUpRepoInTx;
          if (entity === HealthCenter) return healthCenterRepoInTx;
          return txAlertRepo;
        }),
      };
      const transaction = jest
        .fn()
        .mockImplementation((work: (manager: unknown) => Promise<string>) =>
          work(manager),
        );

      const foundAlert = {
        id: 'alert-1',
        followUp: {
          subjectPatientId: 'patient-1',
          subjectPatient: {
            fullName: 'Paciente Uno',
            dni: '12345678',
            primaryPhone: '999999999',
          },
        },
        healthCenter: { name: 'Centro' },
        createdBy: { fullName: 'Ana Agente' },
      } as unknown as Alert;
      const queryBuilder = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(foundAlert),
      };
      const alerts = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      } as unknown as Repository<Alert>;

      const access = {
        scopeQuery: jest.fn().mockImplementation((q: unknown) => q),
      } as unknown as PatientAccessService;
      const recordEvent = jest.fn().mockResolvedValue(undefined);
      const events = {
        record: recordEvent,
      } as unknown as AlertEventsService;
      const enqueueWebhook = jest.fn().mockResolvedValue(undefined);
      const webhooks = {
        enqueue: enqueueWebhook,
      } as unknown as N8nTransactionalDispatchService;

      const service = new AlertsService(
        alerts,
        agents,
        healthCenters,
        followUps,
        patients,
        { transaction } as unknown as DataSource,
        access,
        events,
        webhooks,
      );
      return {
        service,
        getSaved: () => savedAlert!,
        recordEvent,
        enqueueWebhook,
      };
    }

    it('leaves a field unchanged when omitted (undefined)', async () => {
      const { service, getSaved } = buildUpdateService();

      await service.update('alert-1', {}, adminUser);

      expect(getSaved().title).toBe('Título');
    });

    it('clears a nullable field when explicitly set to null', async () => {
      const { service, getSaved } = buildUpdateService();

      await service.update('alert-1', { derivedTo: null }, adminUser);

      expect(getSaved().derivedTo).toBeNull();
    });

    it('rejects an explicit null on a non-nullable field', async () => {
      const { service } = buildUpdateService();

      await expect(
        service.update('alert-1', { title: null }, adminUser),
      ).rejects.toThrow('title cannot be null');
    });

    it('rejects setting status to RESOLVED via PATCH', async () => {
      const { service } = buildUpdateService();

      await expect(
        service.update('alert-1', { status: AlertStatus.RESOLVED }, adminUser),
      ).rejects.toThrow('Use PATCH /alerts/:id/resolve to resolve an alert');
    });

    it('emits a DERIVED event when derivedTo becomes non-null', async () => {
      const { service, recordEvent } = buildUpdateService();

      await service.update('alert-1', { derivedTo: 'Defensoría' }, adminUser);

      expect(recordEvent).toHaveBeenCalledWith(
        'alert-1',
        'agent-1',
        'DERIVED',
        'Alerta Derivada a: Defensoría',
        'Se derivó la gestión a la entidad externa indicada.',
        expect.anything(),
      );
    });
  });
});
