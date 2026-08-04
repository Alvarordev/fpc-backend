import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { AgentsModule } from './agents/agents.module';
import { AlertsModule } from './alerts/alerts.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { HealthCentersModule } from './health-centers/health-centers.module';
import { FollowUpsModule } from './follow-ups/follow-ups.module';
import { PsychooncologyAppointmentsModule } from './psychooncology-appointments/psychooncology-appointments.module';
import { RemindersModule } from './reminders/reminders.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { VolunteersModule } from './volunteers/volunteers.module';
import { VolunteerAvailabilityModule } from './volunteer-availability/volunteer-availability.module';
import { WebsocketsModule } from './websockets/websockets.module';
import { PatientSummariesModule } from './patient-summaries/patient-summaries.module';
import { CallCenterModule } from './call-center/call-center.module';
import { VolunteerCalendarModule } from './volunteer-calendar/volunteer-calendar.module';
import { DashboardModule } from './dashboard/dashboard.module';

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
      }),
    }),
    UsersModule,
    AuthModule,
    PatientsModule,
    AgentsModule,
    VolunteersModule,
    VolunteerCalendarModule,
    VolunteerAvailabilityModule,
    HealthCentersModule,
    FollowUpsModule,
    RemindersModule,
    EnrollmentsModule,
    PsychooncologyAppointmentsModule,
    AlertsModule,
    HealthModule,
    WebsocketsModule,
    PatientSummariesModule,
    CallCenterModule,
    DashboardModule,
  ],
})
export class AppModule {}
