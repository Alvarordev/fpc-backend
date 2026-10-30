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
import { AssistantWorkloadQueryDto } from './dto/assistant-workload-query.dto';
import { dateOnlyInLima } from '../../shared/date-only/date-only.util';
import { CatalogsService } from '../catalogs/catalogs.service';
import { AssistantCatalogQueryDto } from './dto/assistant-catalog-query.dto';
import { CATALOG_KINDS } from '../../database/entities/catalog-item.entity';

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
    private readonly catalogs: CatalogsService,
  ) {
    this.tools = [
      this.indicatorsTool(),
      this.healthCentersTool(),
      this.patientsTool(),
      this.alertsTool(),
      this.workloadTool(),
      this.catalogsTool(),
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
          'Indicadores del programa SEPA, los mismos del dashboard. Grupos: demographics (edad, sexo, residencia, educación, seguro, lengua), epidemiology (mortalidad, tipo de cáncer, estadio, por departamento), management (gestión SEPA: afiliaciones, derivaciones, diagnósticos, tratamientos), productivity (tiempos de atención y beneficios recibidos), adherence (cumplimiento y barreras de tratamiento), abandonment (abandono y bajas), satisfaction (encuestas). Exige period=year con year, period=month con year y month, o rango from/to. Para personas con correo o recordatorios pendientes usa search_patients; para sus tareas usa get_call_center_workload.',
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
            healthSubcategory: {
              type: SchemaType.STRING,
              description: 'Código de subcategoría de salud.',
            },
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
          'Busca y cuenta pacientes combinando filtros personales, clínicos y de atención ANTES de paginar. Edad al día de hoy en Lima; residencia principal actual; hospital principal; diagnósticos, seguros y tratamientos vigentes. Diagnóstico y estadio deben coincidir en el MISMO diagnóstico; tipo y situación en el MISMO tratamiento. Consulta get_patient_filter_options para códigos de catálogo y search_health_centers para hospitales: nunca inventes códigos. Incluye históricos. Devuelve códigos P-001… y presencia de contacto sin direcciones ni teléfonos. Para distribuciones usa get_indicators y para tareas concretas get_call_center_workload.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            gender: {
              type: SchemaType.STRING,
              format: 'enum',
              enum: ['M', 'F', 'OTHER'],
              description:
                'Sexo registrado: M masculino, F femenino, OTHER otro.',
            },
            minAge: {
              type: SchemaType.INTEGER,
              description:
                'Edad mínima inclusiva, 0–130, al día de hoy en Lima.',
            },
            maxAge: {
              type: SchemaType.INTEGER,
              description: 'Edad máxima inclusiva, 0–130.',
            },
            department: {
              type: SchemaType.STRING,
              description:
                'Departamento de residencia principal actual, p. ej. LIMA.',
            },
            healthCenterId: {
              type: SchemaType.STRING,
              description:
                'UUID del hospital PRINCIPAL, obtenido de search_health_centers.',
            },
            diagnosis: {
              type: SchemaType.STRING,
              description:
                'Código de cancer_diagnosis, entre los diagnósticos vigentes.',
            },
            cancerStage: {
              type: SchemaType.STRING,
              description:
                'Código de cancer_stage del mismo diagnóstico filtrado.',
            },
            insuranceType: {
              type: SchemaType.STRING,
              description: 'Código de insurance_type del seguro vigente.',
            },
            treatmentType: {
              type: SchemaType.STRING,
              description:
                'Código de treatment_type de un tratamiento vigente.',
            },
            treatmentSituation: {
              type: SchemaType.STRING,
              description:
                'Código de treatment_situation del mismo tratamiento filtrado.',
            },
            enrolledFrom: {
              type: SchemaType.STRING,
              description: 'Primer enrolamiento desde AAAA-MM-DD inclusivo.',
            },
            enrolledTo: {
              type: SchemaType.STRING,
              description: 'Primer enrolamiento antes de AAAA-MM-DD exclusivo.',
            },
            lastContactBefore: {
              type: SchemaType.STRING,
              description:
                'Último contacto COMPLETED antes de AAAA-MM-DD exclusivo; excluye quienes nunca tuvieron contacto completado.',
            },
            hasPhone: {
              type: SchemaType.BOOLEAN,
              description: 'Tiene teléfono principal o auxiliar registrado.',
            },
            hasCompanion: {
              type: SchemaType.BOOLEAN,
              description:
                'Tiene al menos un acompañante vinculado, no sólo contacto principal.',
            },
            hasPendingFollowUps: {
              type: SchemaType.BOOLEAN,
              description:
                'Tiene seguimientos programados o vencidos sin reemplazo al reagendar.',
            },
            activityStatus: enumOf(
              PatientActivityStatus,
              'ACTIVE, INACTIVE o REACTIVE.',
            ),
            healthPhase: enumOf(PatientHealthPhase, 'Fase de salud actual.'),
            healthSubcategory: {
              type: SchemaType.STRING,
              description: 'Código de subcategoría de salud.',
            },
            hasEmail: {
              type: SchemaType.BOOLEAN,
              description:
                'true: tiene correo registrado; false: no tiene. Omitir para ambos.',
            },
            hasPendingReminders: {
              type: SchemaType.BOOLEAN,
              description:
                'true: tiene al menos un recordatorio PENDING (incluye vencidos e históricos); false: no tiene ninguno. No equivale al estado de entrega del aviso.',
            },
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
          filters,
          limit: filters.limit,
          offset: filters.offset,
          hasMore: filters.offset + data.length < total,
          items: data.map((patient) => ({
            patient: pseudonyms.tokenFor(patient.id, patient.fullName),
            hasEmail: Boolean(patient.email?.trim()),
            hasPhone: Boolean(
              patient.primaryPhone?.trim() || patient.secondaryPhone?.trim(),
            ),
            hasWhatsapp: patient.hasWhatsapp,
            gender: patient.gender,
            status: patient.status,
            activityStatus: patient.activityStatus,
            healthPhase: patient.healthPhase,
            healthSubcategory: patient.healthSubcategory,
            latestCurrentDiagnosis: patient.currentDiagnosis
              ? {
                  diagnosis: patient.currentDiagnosis.diagnosis,
                  cancerStage: patient.currentDiagnosis.cancerStage,
                }
              : null,
            department: patient.currentDepartment,
            lastFollowUpAt:
              patient.latestFollowUp?.completedAt ??
              patient.latestFollowUp?.completedOn ??
              null,
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

  private catalogsTool(): AssistantTool {
    return {
      label: 'Opciones de filtros de pacientes',
      roles: DATA_ROLES,
      declaration: {
        name: 'get_patient_filter_options',
        description:
          'Resuelve etiquetas en códigos reales de catálogos antes de filtrar pacientes o indicadores. Por ejemplo: kind=cancer_diagnosis y search=mama; kind=treatment_type y search=quimio; kind=treatment_situation y search=proceso. Los ítems inactivos se incluyen porque pueden seguir registrados en pacientes. No contiene datos de pacientes.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            kind: enumOf(CATALOG_KINDS, 'Catálogo que deseas consultar.'),
            search: {
              type: SchemaType.STRING,
              description:
                'Fragmento de etiqueta o código, máximo 100 caracteres.',
            },
            limit: {
              type: SchemaType.INTEGER,
              description: '1–50, default 20.',
            },
            offset: { type: SchemaType.INTEGER, description: 'Desde 0.' },
          },
          required: ['kind'],
        },
      },
      run: async (args) => {
        const filters = await validated(AssistantCatalogQueryDto, args);
        const normalized = (value: string) =>
          value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
        const search = normalized(filters.search?.trim() ?? '');
        const items = (await this.catalogs.findAll(filters.kind, true)).filter(
          (item) => normalized(`${item.code} ${item.label}`).includes(search),
        );
        return {
          kind: filters.kind,
          total: items.length,
          hasMore: filters.offset + filters.limit < items.length,
          limit: filters.limit,
          offset: filters.offset,
          items: items
            .slice(filters.offset, filters.offset + filters.limit)
            .map((item) => ({
              code: item.code,
              label: item.label,
              isActive: item.isActive,
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
          'Consulta pendientes concretos por paciente y agente: seguimientos SCHEDULED/OVERDUE y recordatorios PENDING, con fecha real y si el paciente tiene correo. Incluye vencidos e históricos. Acepta patient=P-001 (obtenido con search_patients o una consulta anterior), agentId y hasEmail. Devuelve totales filtrados, pacientes seudonimizados y páginas de tareas; no envía correos ni modifica datos. Los contadores agents son la carga global por agente.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            patient: {
              type: SchemaType.STRING,
              description:
                'Código P-001… de la conversación. Omitir para todos.',
            },
            agentId: {
              type: SchemaType.STRING,
              description: 'ID de agente obtenido de agents.',
            },
            hasEmail: {
              type: SchemaType.BOOLEAN,
              description:
                'Filtra por presencia de correo registrado, sin revelar la dirección.',
            },
            limit: {
              type: SchemaType.INTEGER,
              description:
                'Por página de cada tipo de tarea: 1–50, default 20.',
            },
            offset: {
              type: SchemaType.INTEGER,
              description:
                'Desplazamiento desde 0 para paginar cada tipo de tarea.',
            },
          },
        },
      },
      run: async (args, { pseudonyms }) => {
        const filters = await validated(AssistantWorkloadQueryDto, args);
        const patientId = filters.patient
          ? pseudonyms.patientIdFor(filters.patient)
          : null;
        if (filters.patient && !patientId)
          throw new AssistantToolError(
            'Paciente desconocido en esta conversación. Busca primero con search_patients y usa el código P-001… devuelto.',
          );
        const workload = await this.callCenter.workload();
        const matches = (
          item: { subjectPatientId: string; patientHasEmail: boolean },
          agentId: string,
        ) =>
          (!patientId || item.subjectPatientId === patientId) &&
          (!filters.agentId || agentId === filters.agentId) &&
          (filters.hasEmail == null ||
            item.patientHasEmail === filters.hasEmail);
        const reminders = workload.pendingReminders.filter((item) =>
          matches(item, item.assignedAgentId),
        );
        const followUps = workload.scheduledFollowUps.filter((item) =>
          matches(item, item.agentId),
        );
        const page = <T>(items: T[]) => ({
          total: items.length,
          offset: filters.offset,
          limit: filters.limit,
          hasMore: filters.offset + filters.limit < items.length,
          items: items.slice(filters.offset, filters.offset + filters.limit),
        });
        return {
          today: workload.today,
          weekEnd: workload.weekEnd,
          agents: workload.load,
          filters,
          patientsWithPendingReminders: new Set(
            reminders.map((item) => item.subjectPatientId),
          ).size,
          patientsWithEmailAndPendingReminders: new Set(
            reminders
              .filter((item) => item.patientHasEmail)
              .map((item) => item.subjectPatientId),
          ).size,
          pendingReminders: page(
            reminders.map((item) => ({
              id: item.id,
              patient: pseudonyms.tokenFor(
                item.subjectPatientId,
                item.subjectPatientName,
              ),
              hasEmail: item.patientHasEmail,
              agentId: item.assignedAgentId,
              dueOn: item.dueOn,
              dueAt: item.dueAt,
              overdue:
                (item.dueOn ??
                  (item.dueAt ? dateOnlyInLima(item.dueAt) : workload.today)) <
                workload.today,
            })),
          ),
          scheduledFollowUps: page(
            followUps.map((item) => ({
              id: item.id,
              patient: pseudonyms.tokenFor(
                item.subjectPatientId,
                item.subjectPatientName,
              ),
              hasEmail: item.patientHasEmail,
              agentId: item.agentId,
              status: item.status,
              type: item.type,
              purpose: item.purpose,
              scheduledOn: item.scheduledOn,
              scheduledAt: item.scheduledAt,
            })),
          ),
        };
      },
    };
  }
}
