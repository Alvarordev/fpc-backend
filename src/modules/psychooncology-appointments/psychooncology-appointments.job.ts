import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditContextKind } from '../../shared/audit/audit-context';
import { AuditContextService } from '../../shared/audit/audit-context.service';
import { PsychooncologyAppointmentsService } from './psychooncology-appointments.service';

@Injectable()
export class PsychooncologyAppointmentsJob {
  private readonly logger = new Logger(PsychooncologyAppointmentsJob.name);
  // Single instance: skip a tick while the previous one is still sending.
  private sending = false;

  constructor(
    private readonly appointments: PsychooncologyAppointmentsService,
    private readonly audit: AuditContextService,
  ) {}

  @Cron('0 30 0 * * *', { timeZone: 'America/Lima' })
  async markOverdue() {
    const affected = await this.audit.run(
      { actorUserId: null, context: AuditContextKind.SYSTEM },
      () => this.appointments.markOverdue(),
    );
    if (affected)
      this.logger.log(`Marked ${affected} psycho-oncology sessions as overdue`);
  }

  @Cron('0 */5 * * * *')
  async sendDueReminders() {
    if (this.sending) return;
    this.sending = true;
    try {
      const sent = await this.audit.run(
        { actorUserId: null, context: AuditContextKind.SYSTEM },
        () => this.appointments.sendDueReminders(),
      );
      if (sent) this.logger.log(`Emailed ${sent} psycho-oncology reminders`);
    } finally {
      this.sending = false;
    }
  }
}
