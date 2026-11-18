import {
  SupportTicketStatus,
  SupportTicketType,
} from '../../database/entities/support-ticket.entity';
import {
  ticketNewMessageEmail,
  ticketStatusChangedEmail,
} from './support-ticket-emails';

const ticket = {
  ticketNumber: 12,
  title: 'No guarda <el> seguimiento',
  type: SupportTicketType.FUNCTIONAL_BUG,
};

describe('support ticket emails', () => {
  it('describes the status change with Spanish labels', () => {
    const email = ticketStatusChangedEmail({
      to: 'reporter@example.com',
      ticket,
      previousStatus: SupportTicketStatus.PENDING,
      status: SupportTicketStatus.COMPLETED,
      ticketsUrl: 'https://crm.example/tickets',
    });
    expect(email.subject).toBe('Ticket #12: Completado');
    expect(email.text).toContain('Estado: Recibido → Completado');
    expect(email.html).toContain('https://crm.example/tickets');
    expect(email.html).toContain('No guarda &lt;el&gt; seguimiento');
  });

  it('quotes the new message escaped and mentions attachments', () => {
    const email = ticketNewMessageEmail({
      to: 'reporter@example.com',
      ticket,
      body: '<script>alert(1)</script> Ya quedó',
      imageCount: 2,
      ticketsUrl: 'https://crm.example/tickets',
    });
    expect(email.subject).toBe('Ticket #12: nueva respuesta');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.text).toContain('2 imágenes adjuntas');
  });

  it('truncates long messages', () => {
    const email = ticketNewMessageEmail({
      to: 'r@example.com',
      ticket,
      body: 'a'.repeat(2000),
      imageCount: 0,
      ticketsUrl: 'https://crm.example/tickets',
    });
    expect(email.text).toContain('a'.repeat(800) + '…');
    expect(email.text).not.toContain('a'.repeat(801));
  });
});
