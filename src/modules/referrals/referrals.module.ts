import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FollowUp } from '../../database/entities/follow-up.entity';
import { HealthCenter } from '../../database/entities/health-center.entity';
import { PatientDocument } from '../../database/entities/patient-document.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Referral } from '../../database/entities/referral.entity';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { PatientAccessModule } from '../patients/access/patient-access.module';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Referral,
      Patient,
      HealthCenter,
      FollowUp,
      PatientDocument,
    ]),
    CatalogsModule,
    PatientAccessModule,
  ],
  controllers: [ReferralsController],
  providers: [ReferralsService],
})
export class ReferralsModule {}
