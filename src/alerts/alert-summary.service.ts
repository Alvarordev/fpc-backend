import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Alert, AlertStatus } from '../database/entities/alert.entity';
import {
  AlertEvent,
  AlertEventType,
} from '../database/entities/alert-event.entity';
import {
  AI_SUMMARY_EVENT_TITLE,
  AlertEventsService,
} from './alert-events.service';

// Fixed on purpose, not env-configurable: making the timezone an env var
// would make the generated summary text non-reproducible across
// environments and untestable with a fixed clock.
export const ALERT_SUMMARY_TIMEZONE = 'America/Lima';

export interface AlertSummaryInput {
  title: string;
  healthCenterName: string;
  status: AlertStatus;
  severity: string;
  createdAt: Date | null;
  createdByName: string;
  derivedTo: string | null;
  derivationNotes: string | null;
  derivedEventDescription: string | null;
  commentsCount: number;
  resolvedAt: Date | null;
  resolvedByName: string | null;
}

function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('es-PE', {
    timeZone: ALERT_SUMMARY_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

/**
 * Pure port of fpc-back's AIService.generateExecutiveSummary — a
 * deterministic Spanish template, not an actual model call.
 */
export function buildExecutiveSummary(input: AlertSummaryInput): string {
  const statusLabel =
    input.status === AlertStatus.ACTIVE ? 'ACTIVA' : 'RESUELTA';

  let summary = '📋 RESUMEN EJECUTIVO IA:\n';
  summary += `La alerta '${input.title}' reportada en '${input.healthCenterName}' se encuentra actualmente en estado ${statusLabel} (Severidad: ${input.severity}). `;

  if (input.createdAt) {
    summary += `Iniciada el ${formatDate(input.createdAt)} por ${input.createdByName}. `;
  }

  if (input.derivedEventDescription !== null || input.derivedTo !== null) {
    const target =
      input.derivedTo ?? input.derivedEventDescription ?? 'entidad externa';
    summary += `Caso derivado a: '${target}'. `;
    if (input.derivationNotes && input.derivationNotes.trim() !== '') {
      summary += `Nota de derivación: "${input.derivationNotes}". `;
    }
  }

  if (input.commentsCount > 0) {
    summary += `Cuenta con ${input.commentsCount} avance(s) registrado(s) en la línea de tiempo. `;
  }

  if (input.status === AlertStatus.RESOLVED && input.resolvedAt) {
    summary += `Atención concluida y resuelta el ${formatDate(input.resolvedAt)} por ${input.resolvedByName ?? 'Agente'}.`;
  } else {
    summary +=
      'Se recomienda seguimiento activo con el centro de salud para la resolución del incidente.';
  }

  return summary;
}

@Injectable()
export class AlertSummaryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: AlertEventsService,
  ) {}

  async generate(id: string): Promise<Alert> {
    return this.dataSource.transaction(async (manager) => {
      const alert = await manager.getRepository(Alert).findOne({
        where: { id },
        relations: {
          healthCenter: true,
          createdBy: true,
          resolvedBy: true,
          resolvedByUser: true,
        },
      });
      if (!alert) throw new NotFoundException('Alert not found');

      const alertEvents = await manager.getRepository(AlertEvent).find({
        where: { alertId: id },
        order: { createdAt: 'ASC' },
      });
      const commentsCount = alertEvents.filter(
        (event) => event.eventType === AlertEventType.COMMENT,
      ).length;
      const derivedEvent = alertEvents.find(
        (event) => event.eventType === AlertEventType.DERIVED,
      );

      const summary = buildExecutiveSummary({
        title: alert.title,
        healthCenterName: alert.healthCenter.name,
        status: alert.status,
        severity: alert.severity,
        createdAt: alert.createdAt,
        createdByName: alert.createdBy.fullName,
        derivedTo: alert.derivedTo,
        derivationNotes: alert.derivationNotes,
        derivedEventDescription: derivedEvent?.description ?? null,
        commentsCount,
        resolvedAt: alert.resolvedAt,
        resolvedByName:
          alert.resolvedBy?.fullName ?? alert.resolvedByUser?.email ?? null,
      });

      alert.aiSummary = summary;
      await manager.getRepository(Alert).save(alert);
      await this.events.record(
        alert.id,
        alert.createdById,
        AlertEventType.AI_SUMMARY_GENERATED,
        AI_SUMMARY_EVENT_TITLE,
        summary,
        manager,
      );
      return alert;
    });
  }
}
