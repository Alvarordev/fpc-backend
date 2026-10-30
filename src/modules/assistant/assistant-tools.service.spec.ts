import { Test } from '@nestjs/testing';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { AlertsService } from '../alerts/alerts.service';
import { CallCenterService } from '../call-center/call-center.service';
import { DashboardIndicatorsService } from '../dashboard/dashboard-indicators.service';
import { HealthCentersService } from '../health-centers/health-centers.service';
import { PatientsService } from '../patients/patients.service';
import { CatalogsService } from '../catalogs/catalogs.service';
import { AssistantPseudonymizer } from './assistant-pseudonyms';
import { AssistantToolsService } from './assistant-tools.service';

describe('Assistant read-only patient queries', () => {
  let tools: AssistantToolsService;
  const patients = { findAll: jest.fn() };
  const callCenter = { workload: jest.fn() };
  const catalogs = { findAll: jest.fn() };
  const user = Object.assign(new User(), { role: UserRole.ADMIN });
  const context = () => ({ user, pseudonyms: new AssistantPseudonymizer({}) });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AssistantToolsService,
        { provide: PatientsService, useValue: patients },
        { provide: CallCenterService, useValue: callCenter },
        { provide: CatalogsService, useValue: catalogs },
        { provide: DashboardIndicatorsService, useValue: {} },
        { provide: AlertsService, useValue: {} },
        { provide: HealthCentersService, useValue: {} },
      ],
    }).compile();
    tools = module.get(AssistantToolsService);
    const reminder = (id: string, patientId: string, hasEmail: boolean) => ({
      id,
      subjectPatientId: patientId,
      subjectPatientName: `Nombre privado ${patientId}`,
      patientHasEmail: hasEmail,
      assignedAgentId: 'e6ccbc88-22a1-4e36-a5cf-ae2be78cd849',
      description: 'Texto privado del recordatorio',
      dueOn: null,
      // Still yesterday in Lima, even though the UTC day is today.
      dueAt: new Date('2026-10-29T01:00:00Z'),
    });
    callCenter.workload.mockResolvedValue({
      today: '2026-10-29',
      weekEnd: '2026-11-01',
      load: [],
      scheduledFollowUps: [],
      pendingReminders: [
        reminder('r-1', 'private-patient-1', true),
        reminder('r-2', 'private-patient-1', true),
        reminder('r-3', 'private-patient-2', false),
      ],
    });
  });

  it('distinguishes patients from reminders and keeps totals when paginating', async () => {
    const result = await tools.run(
      'get_call_center_workload',
      { limit: 1 },
      context(),
    );
    expect(result).toMatchObject({
      patientsWithPendingReminders: 2,
      patientsWithEmailAndPendingReminders: 1,
      pendingReminders: {
        total: 3,
        hasMore: true,
        items: [{ patient: 'P-001', hasEmail: true, overdue: true }],
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Nombre privado');
    expect(serialized).not.toContain('private-patient');
    expect(serialized).not.toContain('Texto privado');
  });

  it('can find patients without email and paginate a known patient across tools', async () => {
    const ctx = context();
    const withoutEmail = await tools.run(
      'get_call_center_workload',
      { hasEmail: false },
      ctx,
    );
    expect(withoutEmail).toMatchObject({
      patientsWithEmailAndPendingReminders: 0,
      pendingReminders: {
        total: 1,
        items: [{ patient: 'P-001', hasEmail: false }],
      },
    });
    const knownPatient = await tools.run(
      'get_call_center_workload',
      { patient: 'P-001' },
      ctx,
    );
    expect(knownPatient).toMatchObject({ pendingReminders: { total: 1 } });
    const firstPatient = ctx.pseudonyms.tokenFor(
      'private-patient-1',
      'Nombre privado',
    );
    const nextPage = await tools.run(
      'get_call_center_workload',
      { patient: firstPatient, limit: 1, offset: 1 },
      ctx,
    );
    expect(nextPage).toMatchObject({
      pendingReminders: { total: 2, hasMore: false, items: [{ id: 'r-2' }] },
    });
  });

  it('uses server-side patient filters and returns presence, not the email address', async () => {
    patients.findAll.mockResolvedValue({
      total: 57,
      data: [
        {
          id: 'private-patient',
          fullName: 'Nombre secreto',
          email: 'private@example.com',
          latestFollowUp: { completedAt: null, completedOn: '2026-10-14' },
        },
      ],
    });
    const result = await tools.run(
      'search_patients',
      { hasEmail: true, hasPendingReminders: true, limit: 1, offset: 0 },
      context(),
    );
    expect(patients.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        hasEmail: true,
        hasPendingReminders: true,
        limit: 1,
      }),
      user,
    );
    expect(result).toMatchObject({
      total: 57,
      hasMore: true,
      items: [
        { patient: 'P-001', hasEmail: true, lastFollowUpAt: '2026-10-14' },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /Nombre secreto|private@example.com|private-patient/,
    );
  });

  it('combines clinical and demographic filters rather than filtering a returned page', async () => {
    patients.findAll.mockResolvedValue({ data: [], total: 0 });
    const filters = {
      minAge: 40,
      maxAge: 65,
      gender: 'F',
      department: 'LIMA',
      diagnosis: 'MAMA',
      cancerStage: 'STAGE_2',
      insuranceType: 'SIS',
      treatmentType: 'QUIMIOTERAPIA',
      treatmentSituation: 'EN_PROCESO',
      hasCompanion: false,
      hasPendingFollowUps: true,
      enrolledFrom: '2026-01-01',
      enrolledTo: '2027-01-01',
    };
    await tools.run('search_patients', filters, context());
    expect(patients.findAll).toHaveBeenCalledWith(
      expect.objectContaining(filters),
      user,
    );
  });

  it('resolves catalog labels, including accents and inactive historical codes', async () => {
    catalogs.findAll.mockResolvedValue([
      { code: 'QUIMIO', label: 'Quimioterapia', isActive: true },
      { code: 'OLD', label: 'Químico previo', isActive: false },
    ]);
    const result = await tools.run(
      'get_patient_filter_options',
      { kind: 'treatment_type', search: 'quim', limit: 1 },
      context(),
    );
    expect(catalogs.findAll).toHaveBeenCalledWith('treatment_type', true);
    expect(result).toMatchObject({
      total: 2,
      hasMore: true,
      items: [{ code: 'QUIMIO' }],
    });
    await expect(
      tools.run('get_patient_filter_options', { kind: 'unknown' }, context()),
    ).rejects.toThrow('Argumentos inválidos');
  });

  it.each([
    { limit: 0 },
    { limit: 51 },
    { limit: null },
    { offset: -1 },
    { hasEmail: 'false' },
    { unexpected: true },
  ])('rejects invalid workload filters %j', async (args) => {
    await expect(
      tools.run('get_call_center_workload', args, context()),
    ).rejects.toThrow('Argumentos inválidos');
    expect(callCenter.workload).not.toHaveBeenCalled();
  });

  it('does not accept another conversation’s patient reference or raw ID', async () => {
    await expect(
      tools.run('get_call_center_workload', { patient: 'P-001' }, context()),
    ).rejects.toThrow('Paciente desconocido');
    await expect(
      tools.run(
        'get_call_center_workload',
        { patient: 'private-patient-1' },
        context(),
      ),
    ).rejects.toThrow('Argumentos inválidos');
  });

  it('keeps data tools unavailable to agent and volunteer roles', async () => {
    for (const role of [UserRole.AGENT, UserRole.VOLUNTEER]) {
      const ctx = {
        user: Object.assign(new User(), { role }),
        pseudonyms: new AssistantPseudonymizer({}),
      };
      expect(tools.declarationsFor(ctx.user)).toHaveLength(0);
      await expect(
        tools.run('get_call_center_workload', {}, ctx),
      ).rejects.toThrow('no está disponible');
    }
    expect(callCenter.workload).not.toHaveBeenCalled();
  });
});
