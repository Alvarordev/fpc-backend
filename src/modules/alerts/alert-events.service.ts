import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  AlertEvent,
  AlertEventType,
} from '../../database/entities/alert-event.entity';

export function createdEventTitle(ticketNumber: string): string {
  return `Alerta Reportada [Ticket ${ticketNumber}]`;
}

export function createdEventDescription(
  agentFullName: string,
  alertTitle: string,
): string {
  return `Alerta iniciada por ${agentFullName}: "${alertTitle}"`;
}

export const RESOLVED_EVENT_TITLE = 'Alerta Resuelta';

export function resolvedEventDescription(
  resolverFullName: string,
  resolutionNotes?: string | null,
): string {
  const base = `El caso fue marcado como resuelto por ${resolverFullName}.`;
  return resolutionNotes ? `${base} Procedimiento: ${resolutionNotes}` : base;
}

export function derivedEventTitle(derivedTo: string): string {
  return `Alerta Derivada a: ${derivedTo}`;
}

export function derivedEventDescription(
  derivationNotes: string | null,
): string {
  return (
    derivationNotes ?? 'Se derivó la gestión a la entidad externa indicada.'
  );
}

export const AI_SUMMARY_EVENT_TITLE = 'Resumen Ejecutivo Generado por IA';

export const STATUS_CHANGED_EVENT_TITLE = 'Estado actualizado';

export const ALERT_STATUS_LABELS: Record<string, string> = {
  REPORTED: 'Reportada',
  IN_REVIEW: 'En revisión',
  RESOLVED: 'Resuelta',
};

export function statusChangedEventDescription(
  previousStatus: string,
  newStatus: string,
): string {
  return `El estado cambió de ${ALERT_STATUS_LABELS[previousStatus] ?? previousStatus} a ${ALERT_STATUS_LABELS[newStatus] ?? newStatus}.`;
}

export function reportLinkedEventTitle(patientFullName: string): string {
  return `Paciente vinculado: ${patientFullName}`;
}

export const PATIENTS_NOTIFIED_EVENT_TITLE = 'Aviso a pacientes afectados';

export interface AlertActor {
  agentId: string | null;
  userId: string | null;
  name: string;
}

export const SYSTEM_ACTOR: AlertActor = {
  agentId: null,
  userId: null,
  name: 'Sistema',
};

const ACTOR_NAME_SQL = `
  SELECT COALESCE(
           a.full_name,
           NULLIF(TRIM(CONCAT_WS(' ', f.first_name, f.last_name)), ''),
           u.email
         ) AS name,
         a.id AS agent_id
    FROM users u
    LEFT JOIN agents a ON a.user_id = u.id
    LEFT JOIN foundations f ON f.user_id = u.id
   WHERE u.id = $1`;

@Injectable()
export class AlertEventsService {
  constructor(
    @InjectRepository(AlertEvent)
    private readonly events: Repository<AlertEvent>,
  ) {}

  async actorFor(
    user: { id: string; email: string },
    manager?: EntityManager,
  ): Promise<AlertActor> {
    const rows = await (manager ?? this.events.manager).query<
      { name: string | null; agent_id: string | null }[]
    >(ACTOR_NAME_SQL, [user.id]);
    return {
      agentId: rows[0]?.agent_id ?? null,
      userId: user.id,
      name: rows[0]?.name ?? user.email,
    };
  }

  async nameFor(userId: string | null, manager?: EntityManager) {
    if (!userId) return null;
    const rows = await (manager ?? this.events.manager).query<
      { name: string | null }[]
    >(ACTOR_NAME_SQL, [userId]);
    return rows[0]?.name ?? null;
  }

  async record(
    alertId: string,
    actor: AlertActor,
    eventType: AlertEventType,
    title: string,
    description: string | null,
    manager?: EntityManager,
  ): Promise<AlertEvent> {
    const repo = manager ? manager.getRepository(AlertEvent) : this.events;
    return repo.save(
      repo.create({
        alertId,
        agentId: actor.agentId,
        actorUserId: actor.userId,
        eventType,
        title,
        description,
      }),
    );
  }

  async findAll(alertId: string): Promise<AlertEvent[]> {
    return this.events.find({
      where: { alertId },
      relations: { agent: true, actorUser: true },
      order: { createdAt: 'ASC' },
    });
  }
}
