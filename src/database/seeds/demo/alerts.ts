import type { Agent } from '../../entities/agent.entity';
import {
  Alert,
  AlertCategory,
  AlertSeverity,
  AlertStatus,
} from '../../entities/alert.entity';
import { AlertEvent, AlertEventType } from '../../entities/alert-event.entity';
import type { DemoContext } from './context';
import type { PatientFollowUps } from './follow-ups';
import { addDays } from './rng';
import {
  createdEventDescription,
  createdEventTitle,
  resolvedEventDescription,
} from '../../../alerts/alert-events.service';

/** Three hand-written cases — alerts are rare and specific by design. */
const ALERT_CASES = [
  {
    title: 'Desabastecimiento de medicamento oncológico',
    description:
      'La farmacia del hospital no cuenta con capecitabina desde hace dos semanas. Tres pacientes del programa atendidos en este centro reportan lo mismo. Se requiere gestión con la dirección del establecimiento.',
    severity: AlertSeverity.HIGH,
    category: AlertCategory.MEDICATION_SHORTAGE,
  },
  {
    title: 'Cita de oncología reprogramada más de 30 días',
    description:
      'La cita de control fue reprogramada dos veces y la nueva fecha supera el mes de espera. El paciente se encuentra en tratamiento activo y el retraso compromete la continuidad del esquema.',
    severity: AlertSeverity.MEDIUM,
    category: AlertCategory.APPOINTMENT_DELAY,
  },
  {
    title: 'Paciente en tratamiento activo sin cobertura vigente',
    description:
      'El SIS del paciente figura como no vigente en el sistema del hospital y se le está cobrando por los exámenes. Se necesita apoyo para regularizar la afiliación antes del siguiente ciclo.',
    severity: AlertSeverity.HIGH,
    category: AlertCategory.INSURANCE_COVERAGE,
  },
] as const;

export async function seedAlerts(
  { manager, rng, now }: DemoContext,
  histories: PatientFollowUps[],
  agents: Agent[],
): Promise<void> {
  // Alerts are raised during a real conversation, so anchor them to one.
  const candidates = histories.filter(
    (history) => history.completed.length > 0,
  );
  const chosen = rng.pickN(candidates, ALERT_CASES.length);

  // Sequential on purpose: `manager` shares one connection, and concurrent
  // `nextval()` queries on the same client are unsafe.
  const plan: {
    row: Alert;
    isResolved: boolean;
    creator: Agent;
    resolver: Agent;
    ticketNumber: string;
  }[] = [];
  for (const [index, alertCase] of ALERT_CASES.entries()) {
    const history = chosen[index];
    const isResolved = index === ALERT_CASES.length - 1;
    const creator = rng.pick(agents);
    const resolver = rng.pick(agents);
    // Advance the shared sequence so demo tickets never collide with ones
    // created afterwards through the API.
    const ticketRows = await manager.query<{ seq: string }[]>(
      `SELECT nextval('alert_ticket_seq') AS seq`,
    );
    const ticketNumber = `ALT-${now.getFullYear()}-${ticketRows[0].seq}`;

    const row = manager.create(Alert, {
      healthCenterId: history.demoPatient.healthCenter.id,
      followUpId: rng.pick(history.completed).id,
      createdById: creator.id,
      title: alertCase.title,
      description: alertCase.description,
      severity: alertCase.severity,
      category: alertCase.category,
      ticketNumber,
      status: isResolved ? AlertStatus.RESOLVED : AlertStatus.ACTIVE,
      resolvedAt: isResolved ? addDays(now, -rng.int(1, 15)) : null,
      // Both resolver columns exist (the user one was added later); keep them
      // pointing at the same person.
      resolvedById: isResolved ? resolver.id : null,
      resolvedByUserId: isResolved ? resolver.userId : null,
    });
    plan.push({ row, isResolved, creator, resolver, ticketNumber });
  }

  const rows = await manager.save(plan.map(({ row }) => row));

  const events: AlertEvent[] = [];
  rows.forEach((row, index) => {
    const { isResolved, creator, resolver, ticketNumber } = plan[index];
    events.push(
      manager.create(AlertEvent, {
        alertId: row.id,
        agentId: creator.id,
        eventType: AlertEventType.CREATED,
        title: createdEventTitle(ticketNumber),
        description: createdEventDescription(creator.fullName, row.title),
      }),
    );
    if (isResolved) {
      events.push(
        manager.create(AlertEvent, {
          alertId: row.id,
          agentId: resolver.id,
          eventType: AlertEventType.RESOLVED,
          title: 'Alerta Resuelta',
          description: resolvedEventDescription(resolver.fullName),
        }),
      );
    }
  });
  await manager.save(events);
}
