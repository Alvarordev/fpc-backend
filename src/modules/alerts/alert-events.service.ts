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

export function resolvedEventDescription(resolverFullName: string): string {
  return `El caso fue marcado como resuelto por ${resolverFullName}.`;
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

export function statusChangedEventDescription(
  previousStatus: string,
  newStatus: string,
): string {
  return `El estado cambió de ${previousStatus} a ${newStatus}.`;
}

@Injectable()
export class AlertEventsService {
  constructor(
    @InjectRepository(AlertEvent)
    private readonly events: Repository<AlertEvent>,
  ) {}

  async record(
    alertId: string,
    agentId: string | null,
    eventType: AlertEventType,
    title: string,
    description: string | null,
    manager?: EntityManager,
  ): Promise<AlertEvent> {
    const repo = manager ? manager.getRepository(AlertEvent) : this.events;
    return repo.save(
      repo.create({ alertId, agentId, eventType, title, description }),
    );
  }

  async findAll(alertId: string): Promise<AlertEvent[]> {
    return this.events.find({
      where: { alertId },
      relations: { agent: true },
      order: { createdAt: 'ASC' },
    });
  }
}
