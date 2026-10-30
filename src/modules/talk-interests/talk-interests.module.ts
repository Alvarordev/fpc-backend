import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanionTalkInterest } from '../../database/entities/companion-talk-interest.entity';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { PatientAccessModule } from '../patients/access/patient-access.module';
import { TalkInterestsController } from './talk-interests.controller';
import { TalkInterestsService } from './talk-interests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanionTalkInterest]),
    CatalogsModule,
    PatientAccessModule,
  ],
  controllers: [TalkInterestsController],
  providers: [TalkInterestsService],
  exports: [TalkInterestsService],
})
export class TalkInterestsModule {}
