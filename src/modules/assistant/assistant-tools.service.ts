import { Injectable } from '@nestjs/common';
import { FunctionDeclaration, Schema, SchemaType } from '@google/generative-ai';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { PatientHealthPhase } from '../../database/entities/patient-health-phase.enum';
import { PatientActivityStatus } from '../../database/entities/patient-activity-status.enum';
import { PatientListSegment } from '../../database/entities/patient-list-segment.enum';
import {
  AlertSeverity,
  AlertStatus,
} from '../../database/entities/alert.entity';
import { DashboardIndicatorsService } from '../dashboard/dashboard-indicators.service';
import {
  DashboardIndicatorQueryDto,
  DashboardPopulation,
} from '../dashboard/dto/dashboard-indicator-query.dto';
import { DashboardPeriod } from '../dashboard/dto/dashboard-query.dto';
import { PatientsService } from '../patients/patients.service';
import { ListPatientsDto } from '../patients/dto/list-patients.dto';
import { AlertsService } from '../alerts/alerts.service';
import { FindAlertsDto } from '../alerts/dto/list-alerts.dto';
import { CallCenterService } from '../call-center/call-center.service';
import { HealthCentersService } from '../health-centers/health-centers.service';
import { AssistantPseudonymizer } from './assistant-pseudonyms';

export type AssistantToolContext = {
  user: User;
  pseudonyms: AssistantPseudonymizer;
};

/**
 * IA2: toda herramienta es de solo lectura, reutiliza un servicio existente
 * (nunca SQL libre) y declara qué roles pueden usarla.
 */
type AssistantTool = {
  declaration: FunctionDeclaration;
  label: string;
  roles: UserRole[];
  run(
    args: Record<string, unknown>,
    context: AssistantToolContext,
  ): Promise<unknown>;
};

export class AssistantToolError extends Error {}

const DATA_ROLES = [UserRole.ADMIN, UserRole.FOUNDATION];

const INDICATOR_GROUPS = [
  'demographics',
  'epidemiology',
  'management',
  'productivity',
  'adherence',
  'abandonment',
  'satisfaction',
] as const;
type IndicatorGroup = (typeof INDICATOR_GROUPS)[number];

const enumOf = (values: object, description: string) => ({
  type: SchemaType.STRING as const,
  format: 'enum' as const,
  enum: Object.values(values) as string[],
  description,
});

const periodProperties: Record<string, Schema> = {
  period: enumOf(
    DashboardPeriod,
    'month o year. Úsalo con year (y month si es month). Alternativa a from/to.',
  ),
  year: { type: SchemaType.INTEGER, description: 'Año, p. ej. 2026.' },
  month: {
    type: SchemaType.INTEGER,
    description: 'Mes 1–12 (con period=month).',
  },
  from: {
    type: SchemaType.STRING,
    description: 'Fecha inicial inclusiva AAAA-MM-DD (hora de Lima).',
  },
  to: {
    type: SchemaType.STRING,
    description: 'Fecha final EXCLUSIVA AAAA-MM-DD (hora de Lima).',
  },
};

async function validated<T extends object>(
  type: new () => T,
  args: Record<string, unknown>,
): Promise<T> {
  const instance = plainToInstance(type, args);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length)
    throw new AssistantToolError(
      'Argumentos inválidos: ' +
        errors
          .map(
            (error) =>
              `${error.property} (${Object.keys(error.constraints ?? {}).join(', ')})`,
          )
          .join('; '),
    );
  return instance;
}

@Injectable()
export class AssistantToolsService {
  private readonly tools: AssistantTool[];

  constructor(
    private readonly indicators: DashboardIndicatorsService,
    private readonly patients: PatientsService,
    private readonly alerts: AlertsService,
    private readonly callCenter: CallCenterService,
    private readonly healthCenters: HealthCentersService,
  ) {
    this.tools = [
      this.indicatorsTool(),
      this.healthCentersTool(),
      this.patientsTool(),
      this.alertsTool(),
      this.workloadTool(),
    ];
  }

  declarationsFor(user: User): FunctionDeclaration[] {
    return this.tools
      .filter((tool) => tool.roles.includes(user.role))
      .map((tool) => tool.declaration);
  }

  labelFor(name: string): string {
    return (
      this.tools.find((tool) => tool.declaration.name === name)?.label ?? name
    );
  }

  async run(
    name: string,
    args: Record<string, unknown>,
    context: AssistantToolContext,
  ): Promise<unknown> {
    const tool = this.tools.find((item) => item.declaration.name === name);
    if (!tool || !tool.roles.includes(context.user.role))
      throw new AssistantToolError(
        `La herramienta ${name} no está disponible.`,
      );
    return tool.run(args, context);
  }

  private indicatorsTool(): AssistantTool {
    const run: Record<
      IndicatorGroup,
      (q: DashboardIndicatorQueryDto) => Promise<unknown>
    > = {
      demographics: (q) => this.indicators.getDemographics(q),
      epidemiology: (q) => this.indicators.getEpidemiology(q),
      management: (q) => this.indicators.getManagement(q),
      productivity: (q) => this.indicators.getProductivity(q),
      adherence: (q) => this.indicators.getAdherence(q),
      abandonment: (q) => this.indicators.getAbandonment(q),
      satisfaction: (q) => this.indicators.getSatisfaction(q),
    };
    return {
      label: 'Indicadores del dashboard',
      roles: DATA_ROLES,
      declaration: {
        name: 'get_indicators',
        description:
          'Indicadores del programa SEPA, los mismos del dashboard. Grupos: demographics (edad, sexo, residencia, educación, seguro, lengua), epidemiology (mortalidad, tipo de cáncer, estadio, por departamento), management (gestión SEPA: afiliaciones, derivaciones, diagnósticos, tratamientos, tiempos), productivity (seguimientos y llamadas por agente), adherence (cumplimiento y barreras de tratamiento), abandonment (abandono y bajas), satisfaction (encuestas). Siempre exige un periodo: period=year con year, period=month con year y month, o un rango from/to. Para "en total" o "a la fecha" usa from=2020-01-01 y to=mañana.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            group: enumOf(INDICATOR_GROUPS, 'Grupo de indicadores.'),
            ...periodProperties,
            population: enumOf(
              DashboardPopulation,
              'all_active (default): activos al cierre del periodo. active_in_period: con actividad en el periodo. enrolled_in_period: enrolados en el periodo.',
            ),
            department: {
              type: SchemaType.STRING,
              description:
                'Departamento de residencia en mayúsculas, p. ej. LIMA, LA_LIBERTAD.',
            },
            healthCenterId: {
              type: SchemaType.STRING,
              description:
                'ID del hospital (búscalo con search_health_centers).',
            },
            agentId: {
              type: SchemaType.STRING,
              description: 'ID del agente (sale de get_call_center_workload).',
            },
            healthPhase: enumOf(PatientHealthPhase, 'Fase de salud actual.'),
          },
          required: ['group'],
        },
      },
      run: async ({ group, ...filters }) => {
        if (!INDICATOR_GROUPS.includes(group as IndicatorGroup))
          throw new AssistantToolError('Grupo de indicadores desconocido.');
        const query = await validated(DashboardIndicatorQueryDto, filters);
        return run[group as IndicatorGroup](query);
      },
    };
  }

  private healthCentersTool(): AssistantTool {
    return {
      label: 'Hospitales',
      roles: DATA_ROLES,
      declaration: {
        name: 'search_health_centers',
        description:
          'Busca hospitales y establecimientos por nombre o código RENIPRESS. Devuelve su ID para filtrar otras herramientas.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            search: {
              type: SchemaType.STRING,
              description: 'Nombre o código.',
            },
            department: {
              type: SchemaType.STRING,
              description: 'Departamento en mayúsculas, p. ej. LIMA.',
            },
          },
        },
      },
      run: async ({ search, department }) => {
        const centers = await this.healthCenters.findAll({
          search: typeof search === 'string' ? search : undefined,
          department: typeof department === 'string' ? department : undefined,
          isActive: true,
        });
        return {
          total: centers.length,
          items: centers.slice(0, 20).map((center) => ({
            id: center.id,
            name: center.name,
            department: center.department,
            careLevel: center.careLevel,
            institution: center.institution,
          })),
        };
      },
    };
  }

  private patientsTool(): AssistantTool {
    return {
      label: 'Pacientes',
      roles: DATA_ROLES,
      declaration: {
        name: 'search_patients',
        description:
          'Lista pacientes con filtros y devuelve el total. Los pacientes vienen seudonimizados (P-001…): refiérete a ellos solo con ese código. Para contar por indicadores usa get_indicators.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            activityStatus: enumOf(
              PatientActivityStatus,
              'ACTIVE, INACTIVE o REACTIVE.',
            ),
            healthPhase: enumOf(PatientHealthPhase, 'Fase de salud actual.'),
            segment: enumOf(
              PatientListSegment,
              'CARE: pacientes en atención. PROSPECTS: prospectos sin enrolar.',
            ),
            limit: {
              type: SchemaType.INTEGER,
              description: 'Máximo 50 (default 20).',
            },
            offset: { type: SchemaType.INTEGER, description: 'Para paginar.' },
          },
        },
      },
      run: async (args, { user, pseudonyms }) => {
        const filters = await validated(ListPatientsDto, {
          limit: 20,
          ...args,
        });
        filters.limit = Math.min(filters.limit, 50);
        const { data, total } = await this.patients.findAll(filters, user);
        return {
          total,
          items: data.map((patient) => ({
            patient: pseudonyms.tokenFor(patient.id, patient.fullName),
            status: patient.status,
            activityStatus: patient.activityStatus,
            healthPhase: patient.healthPhase,
            healthSubcategory: patient.healthSubcategory,
            diagnosis: patient.currentDiagnosis?.diagnosis ?? null,
            cancerStage: patient.currentDiagnosis?.cancerStage ?? null,
            department: patient.currentDepartment,
            lastFollowUpAt: patient.latestFollowUp?.completedAt ?? null,
          })),
        };
      },
    };
  }

  private alertsTool(): AssistantTool {
    return {
      label: 'Alertas',
      roles: DATA_ROLES,
      declaration: {
        name: 'list_alerts',
        description:
          'Alertas de hospitales (problemas reportados por pacientes: falta de medicinas, citas, equipos…), las más recientes primero.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            status: enumOf(AlertStatus, 'REPORTED, IN_REVIEW o RESOLVED.'),
            severity: enumOf(AlertSeverity, 'HIGH, MEDIUM o LOW.'),
            healthCenterId: {
              type: SchemaType.STRING,
              description:
                'ID del hospital (búscalo con search_health_centers).',
            },
          },
        },
      },
      run: async (args, { user }) => {
        const alerts = await this.alerts.findAll(
          await validated(FindAlertsDto, args),
          user,
        );
        return {
          total: alerts.length,
          items: alerts.slice(0, 50).map((alert) => ({
            ticket: alert.ticketNumber,
            title: alert.title,
            category: alert.category,
            severity: alert.severity,
            status: alert.status,
            healthCenter: alert.healthCenter?.name ?? null,
            reports: alert.reportsCount,
            createdAt: alert.createdAt,
            resolvedAt: alert.resolvedAt,
          })),
        };
      },
    };
  }

  private workloadTool(): AssistantTool {
    return {
      label: 'Carga del call center',
      roles: DATA_ROLES,
      declaration: {
        name: 'get_call_center_workload',
        description:
          'Agentes del call center y sus pendientes (seguimientos programados y recordatorios): para hoy, esta semana y vencidos.',
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      run: async () => {
        const workload = await this.callCenter.workload();
        return {
          today: workload.today,
          weekEnd: workload.weekEnd,
          agents: workload.load,
        };
      },
    };
  }
}
