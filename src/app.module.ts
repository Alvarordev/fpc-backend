import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './modules/auth/auth.module';
import { AgentsModule } from './modules/agents/agents.module';
import { FoundationsModule } from './modules/foundations/foundations.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './modules/health/health.module';
import { HealthCentersModule } from './modules/health-centers/health-centers.module';
import { FollowUpsModule } from './modules/follow-ups/follow-ups.module';
import { PsychooncologyAppointmentsModule } from './modules/psychooncology-appointments/psychooncology-appointments.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { UsersModule } from './modules/users/users.module';
import { PatientsModule } from './modules/patients/patients.module';
import { VolunteersModule } from './modules/volunteers/volunteers.module';
import { VolunteerAvailabilityModule } from './modules/volunteers/availability/volunteer-availability.module';
import { WebsocketsModule } from './websockets/websockets.module';
import { PatientSummariesModule } from './modules/patient-summaries/patient-summaries.module';
import { CallCenterModule } from './modules/call-center/call-center.module';
import { VolunteerCalendarModule } from './modules/volunteers/calendar/volunteer-calendar.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MedicalAppointmentsModule } from './modules/patients/clinical/medical-appointments/medical-appointments.module';
import { N8nModule } from './integrations/n8n/n8n.module';
import { EmbeddedUnderscoreNamingStrategy } from './database/embedded-underscore-naming.strategy';
import { HistoricalRecordsModule } from './modules/historical-records/historical-records.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    EventEmitterModule.forRoot(),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                },
              }
            : undefined,
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        namingStrategy: new EmbeddedUnderscoreNamingStrategy(),
      }),
    }),
    UsersModule,
    AuthModule,
    N8nModule,
    PatientsModule,
    AgentsModule,
    FoundationsModule,
    VolunteersModule,
    VolunteerCalendarModule,
    VolunteerAvailabilityModule,
    HealthCentersModule,
    FollowUpsModule,
    RemindersModule,
    EnrollmentsModule,
    PsychooncologyAppointmentsModule,
    MedicalAppointmentsModule,
    AlertsModule,
    HealthModule,
    WebsocketsModule,
    PatientSummariesModule,
    CallCenterModule,
    DashboardModule,
    HistoricalRecordsModule,
  ],
})
export class AppModule {}
