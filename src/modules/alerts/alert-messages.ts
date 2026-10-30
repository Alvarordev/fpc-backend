import {
  Alert,
  ALERT_SEVERITY_LABELS,
} from '../../database/entities/alert.entity';

const SIGNATURE = 'Programa SEPA - Fundación Peruana de Cáncer';

export function alertResolverName(alert: Alert): string | null {
  if (!alert.resolvedByUserId) return null;
  if (alert.resolverAgent) return alert.resolverAgent.fullName;
  if (alert.resolverFoundation)
    return [
      alert.resolverFoundation.firstName,
      alert.resolverFoundation.lastName,
    ]
      .filter(Boolean)
      .join(' ');
  return alert.resolvedByUser?.email ?? null;
}

export function foundationAlertMessage(alert: Alert) {
  const category = alert.categoryItem?.label ?? alert.category;
  return {
    subject: `Nueva alerta ${alert.ticketNumber ?? ''}: ${alert.title}`.trim(),
    text: [
      `Se reportó una nueva alerta en ${alert.healthCenter.name}.`,
      '',
      `Ticket: ${alert.ticketNumber ?? '-'}`,
      `Título: ${alert.title}`,
      `Categoría: ${category}`,
      `Severidad: ${ALERT_SEVERITY_LABELS[alert.severity] ?? alert.severity}`,
      `Reportada por: ${alert.createdBy?.fullName ?? '-'}`,
      '',
      alert.description,
      '',
      SIGNATURE,
    ].join('\n'),
  };
}

export function affectedPatientsMessage(
  alert: Alert,
  patientName: string | null,
) {
  const greeting = patientName ? `Hola ${patientName},` : 'Hola,';
  return {
    subject: `Aviso sobre ${alert.healthCenter.name}`,
    text: `${greeting} desde el Programa SEPA te informamos que en ${alert.healthCenter.name} se ha reportado la siguiente situación: ${alert.title}. ${alert.description}\n\nSi esto afecta tu tratamiento, comunícate con nosotros para ayudarte.\n\n${SIGNATURE}`,
  };
}
