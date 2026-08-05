import { Repository } from 'typeorm';
import { MedicalAppointmentsService } from './medical-appointments.service';
import { PatientMedicalAppointment } from '../patients/entities/patient-medical-appointment.entity';
import { Agent } from '../database/entities/agent.entity';
import { PatientsService } from '../patients/patients.service';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { HistoryVersioningService } from '../patients/history-versioning/history-versioning.service';
import { PatientSummaryInvalidationService } from '../patient-summaries/patient-summary-invalidation.service';
import { PatientAccessService } from '../patient-access/patient-access.service';
import { N8nTransactionalDispatchService } from '../webhooks/transactional-dispatch.service';
import { User } from '../database/entities/user.entity';
import { UserRole } from '../database/entities/user-role.enum';
import {
  FindMedicalAppointmentsDto,
  UpdateMedicalAppointmentDto,
} from './medical-appointments.dto';

describe('MedicalAppointmentsService', () => {
  const adminUser = { id: 'user-1', role: UserRole.ADMIN } as User;
  const webhooksStub = {
    enqueue: jest.fn().mockResolvedValue(undefined),
  } as unknown as N8nTransactionalDispatchService;

  function buildFindAllService() {
    const foundAppointment = {
      id: 'appointment-1',
      patient: { fullName: 'Paciente Uno', dni: '123' },
      healthCenter: { name: 'Centro' },
    } as unknown as PatientMedicalAppointment;
    const getManyAndCount = jest
      .fn()
      .mockResolvedValue([[foundAppointment], 1]);
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount,
    };
    const appointments = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<PatientMedicalAppointment>;

    const access = {
      scopeQuery: jest.fn().mockImplementation((q: unknown) => q),
    } as unknown as PatientAccessService;

    const service = new MedicalAppointmentsService(
      appointments,
      {} as Repository<Agent>,
      {} as PatientsService,
      {} as FollowUpsService,
      {} as HistoryVersioningService,
      { markDirty: jest.fn() } as unknown as PatientSummaryInvalidationService,
      access,
      webhooksStub,
    );
    return { service, queryBuilder };
  }

  it('filters to current-only rows by default', async () => {
    const { service, queryBuilder } = buildFindAllService();

    await service.findAll({} as FindMedicalAppointmentsDto, adminUser);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'appointment.is_current = true',
    );
  });

  it('includes superseded rows when includeHistory is true', async () => {
    const { service, queryBuilder } = buildFindAllService();

    await service.findAll(
      { includeHistory: true } as FindMedicalAppointmentsDto,
      adminUser,
    );

    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      'appointment.is_current = true',
    );
  });

  it('applies volunteer scoping via PatientAccessService', async () => {
    const { queryBuilder } = buildFindAllService();
    const scopeQuery = jest.fn().mockResolvedValue(queryBuilder);
    const access = { scopeQuery } as unknown as PatientAccessService;
    const appointments = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<PatientMedicalAppointment>;
    const service2 = new MedicalAppointmentsService(
      appointments,
      {} as Repository<Agent>,
      {} as PatientsService,
      {} as FollowUpsService,
      {} as HistoryVersioningService,
      { markDirty: jest.fn() } as unknown as PatientSummaryInvalidationService,
      access,
      webhooksStub,
    );

    await service2.findAll({} as FindMedicalAppointmentsDto, adminUser);

    expect(scopeQuery).toHaveBeenCalledWith(
      queryBuilder,
      'appointment.patient_id',
      adminUser,
    );
  });

  it('returns total from getManyAndCount, not the page size', async () => {
    const { service } = buildFindAllService();

    const result = await service.findAll({ limit: 1, offset: 0 }, adminUser);

    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
  });

  it('passes changeReason through to HistoryVersioningService.replaceCurrent', async () => {
    const existing = {
      id: 'appointment-1',
      patientId: 'patient-1',
      followUpId: 'fu-1',
      specialty: 'Oncología',
      healthCenterId: null,
      appointmentDate: null,
      appointmentTime: null,
      nextAppointmentDate: null,
      hasReferralSheet: false,
      referredTo: null,
      difficulties: null,
      isFirstConsultation: false,
    } as unknown as PatientMedicalAppointment;
    const appointments = {
      findOne: jest.fn().mockResolvedValue(existing),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'appointment-2',
          patient: { fullName: 'X', dni: null },
          healthCenter: null,
        }),
      }),
    } as unknown as Repository<PatientMedicalAppointment>;
    const replaceCurrent = jest.fn().mockResolvedValue({ id: 'appointment-2' });
    const versioning = {
      replaceCurrent,
    } as unknown as HistoryVersioningService;

    const service = new MedicalAppointmentsService(
      appointments,
      {} as Repository<Agent>,
      {} as PatientsService,
      {} as FollowUpsService,
      versioning,
      { markDirty: jest.fn() } as unknown as PatientSummaryInvalidationService,
      { scopeQuery: jest.fn() } as unknown as PatientAccessService,
      webhooksStub,
    );

    const dto: UpdateMedicalAppointmentDto = {
      changeReason: 'Cambio de fecha por disponibilidad',
    };
    await service.update('appointment-1', dto);

    expect(replaceCurrent).toHaveBeenCalledWith(
      PatientMedicalAppointment,
      { patientId: 'patient-1', specialty: 'Oncología', isCurrent: true },
      expect.objectContaining({
        changeReason: 'Cambio de fecha por disponibilidad',
        specialty: 'Oncología',
      }),
    );
  });
});
