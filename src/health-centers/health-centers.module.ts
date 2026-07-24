import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthCenter } from '../database/entities/health-center.entity';
import { HealthCentersController } from './health-centers.controller';
import { HealthCentersService } from './health-centers.service';
@Module({
  imports: [TypeOrmModule.forFeature([HealthCenter])],
  controllers: [HealthCentersController],
  providers: [HealthCentersService],
})
export class HealthCentersModule {}
