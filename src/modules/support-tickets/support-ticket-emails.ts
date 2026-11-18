import type { EmailMessage } from '../../integrations/email/email.service';
import {
  SupportTicketStatus,
  SupportTicketType,
} from '../../database/entities/support-ticket.entity';

/** Mismas etiquetas que el front (src/pages/tickets/_lib/ticket-labels.ts). */
const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  [SupportTicketStatus.PENDING]: 'Recibido',
  [SupportTicketStatus.IN_REVIEW]: 'En revisión',
  [SupportTicketStatus.NEEDS_MEETING]: 'Requiere reunión',
  [SupportTicketStatus.COMPLETED]: 'Completado',
  [SupportTicketStatus.DISMISSED]: 'Descartado',
};

const STATUS_DESCRIPTIONS: Record<SupportTicketStatus, string> = {
  [SupportTicketStatus.PENDING]:
    'El ticket está en cola y el equipo lo revisará pronto.',
  [SupportTicketStatus.IN_REVIEW]: 'El equipo está revisando el ticket.',
  [SupportTicketStatus.NEEDS_MEETING]:
    'Hace falta conversarlo para avanzar. El equipo se pondrá en contacto para coordinar una reunión.',
  [SupportTicketStatus.COMPLETED]:
    'El ticket se dio por resuelto. Si el problema continúa, basta con responder en el ticket y se reabrirá.',
  [SupportTicketStatus.DISMISSED]:
    'Se decidió no avanzar con este ticket. El detalle está en la conversación del ticket.',
};

const STATUS_COLORS: Record<SupportTicketStatus, { bg: string; fg: string }> = {
  [SupportTicketStatus.PENDING]: { bg: '#fef3c7', fg: '#92400e' },
  [SupportTicketStatus.IN_REVIEW]: { bg: '#dbeafe', fg: '#1e40af' },
  [SupportTicketStatus.NEEDS_MEETING]: { bg: '#ede9fe', fg: '#5b21b6' },
  [SupportTicketStatus.COMPLETED]: { bg: '#dcfce7', fg: '#166534' },
  [SupportTicketStatus.DISMISSED]: { bg: '#f5f5f4', fg: '#44403c' },
};

const TYPE_LABELS: Record<SupportTicketType, string> = {
  [SupportTicketType.BLOCKING_BUG]: 'Error bloqueante',
  [SupportTicketType.FUNCTIONAL_BUG]: 'Error',
  [SupportTicketType.VISUAL_BUG]: 'Error visual',
  [SupportTicketType.CHANGE_REQUEST]: 'Cambio',
  [SupportTicketType.NEW_FEATURE]: 'Nueva funcionalidad',
  [SupportTicketType.QUESTION]: 'Consulta',
};

const MESSAGE_PREVIEW_CHARS = 800;

export interface TicketEmailTicket {
  ticketNumber: number;
  title: string;
  type: SupportTicketType;
}

export function ticketStatusChangedEmail(input: {
  to: string;
  ticket: TicketEmailTicket;
  previousStatus: SupportTicketStatus;
  status: SupportTicketStatus;
  ticketsUrl: string;
}): EmailMessage {
  const { ticket, status, previousStatus, ticketsUrl } = input;
  const label = STATUS_LABELS[status];
  const color = STATUS_COLORS[status];
  const subject = `Ticket #${ticket.ticketNumber}: ${label}`;

  const html = layout({
    heading: 'Tu ticket cambió de estado',
    ticket,
    body: `
      <p style="margin:0 0 8px;font-size:13px;color:#78716c">${escapeHtml(STATUS_LABELS[previousStatus])} &rarr;</p>
      <p style="margin:0 0 12px"><span style="display:inline-block;background:${color.bg};color:${color.fg};font-size:14px;font-weight:bold;padding:6px 12px;border-radius:999px">${escapeHtml(label)}</span></p>
      <p style="font-size:15px;line-height:1.5;margin:0 0 24px">${escapeHtml(STATUS_DESCRIPTIONS[status])}</p>`,
    cta: 'Ver ticket',
    ticketsUrl,
  });

  const text = [
    `Tu ticket #${ticket.ticketNumber} cambió de estado.`,
    '',
    `Ticket: ${ticket.title} (${TYPE_LABELS[ticket.type]})`,
    `Estado: ${STATUS_LABELS[previousStatus]} → ${label}`,
    '',
    STATUS_DESCRIPTIONS[status],
    '',
    `Ver ticket: ${ticketsUrl}`,
    '',
    FOOTER_TEXT,
  ].join('\n');

  return { to: input.to, subject, text, html };
}

export function ticketNewMessageEmail(input: {
  to: string;
  ticket: TicketEmailTicket;
  body: string | null;
  imageCount: number;
  ticketsUrl: string;
}): EmailMessage {
  const { ticket, ticketsUrl, imageCount } = input;
  const preview = truncate(input.body?.trim() ?? '', MESSAGE_PREVIEW_CHARS);
  const images =
    imageCount > 0
      ? `${imageCount} ${imageCount === 1 ? 'imagen adjunta' : 'imágenes adjuntas'}`
      : '';
  const subject = `Ticket #${ticket.ticketNumber}: nueva respuesta`;

  const html = layout({
    heading: 'Hay una nueva respuesta en tu ticket',
    ticket,
    body: `
      ${
        preview
          ? `<div style="border-left:3px solid #d71920;background:#fafaf9;padding:12px 16px;margin:0 0 ${images ? '8' : '24'}px;font-size:15px;line-height:1.5;white-space:pre-line">${escapeHtml(preview)}</div>`
          : ''
      }
      ${images ? `<p style="font-size:13px;color:#57534e;margin:0 0 24px">📎 ${images}</p>` : ''}`,
    cta: 'Responder en el CRM',
    ticketsUrl,
  });

  const text = [
    `Hay una nueva respuesta en tu ticket #${ticket.ticketNumber}.`,
    '',
    `Ticket: ${ticket.title} (${TYPE_LABELS[ticket.type]})`,
    '',
    ...(preview ? [preview, ''] : []),
    ...(images ? [`(${images})`, ''] : []),
    `Responder: ${ticketsUrl}`,
    '',
    FOOTER_TEXT,
  ].join('\n');

  return { to: input.to, subject, text, html };
}

const FOOTER_TEXT =
  'Recibes este correo porque reportaste este ticket en el CRM SEPA. Para responder, escribe desde el ticket: las respuestas a este correo no se leen.';

function layout(input: {
  heading: string;
  ticket: TicketEmailTicket;
  body: string;
  cta: string;
  ticketsUrl: string;
}): string {
  const { ticket } = input;
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f6f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
      <tr><td>
        <p style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#78716c;margin:0 0 8px">Ticket #${ticket.ticketNumber} · ${escapeHtml(TYPE_LABELS[ticket.type])}</p>
        <h1 style="font-size:20px;line-height:1.3;margin:0 0 4px">${escapeHtml(input.heading)}</h1>
        <p style="font-size:15px;line-height:1.5;color:#57534e;margin:0 0 20px">${escapeHtml(ticket.title)}</p>
        ${input.body}
        <p style="margin:0 0 24px"><a href="${escapeHtml(input.ticketsUrl)}" style="display:inline-block;background:#d71920;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">${escapeHtml(input.cta)}</a></p>
        <p style="font-size:12px;line-height:1.5;color:#78716c;margin:0;border-top:1px solid #e7e5e4;padding-top:16px">${escapeHtml(FOOTER_TEXT)}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
