import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditContextKind } from '../../shared/audit/audit-context';
import { AuditContextService } from '../../shared/audit/audit-context.service';
import { PsychooncologyAppointmentsService } from './psychooncology-appointments.service';

@Injectable()
export class PsychooncologyAppointmentsJob {
  private readonly logger = new Logger(PsychooncologyAppointmentsJob.name);

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

  // TODO(reminders): once the mail service exists, add a frequent @Cron here
  // that sends `appointments.findDueReminders()` to the patient email (text
  // from the reminder message) and stamps `reminder_sent_at`.
}
