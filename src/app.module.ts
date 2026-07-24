import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { AgentsModule } from './agents/agents.module';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { HealthCentersModule } from './health-centers/health-centers.module';
import { InteractionsModule } from './interactions/interactions.module';
import { RemindersModule } from './reminders/reminders.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { VolunteersModule } from './volunteers/volunteers.module';
import { WebsocketsModule } from './websockets/websockets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
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
    HealthCentersModule,
    InteractionsModule,
    RemindersModule,
    HealthModule,
    WebsocketsModule,
  ],
})
export class AppModule {}
