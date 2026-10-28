import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthCenter } from '../../database/entities/health-center.entity';
import { UbigeoDistrict } from '../../database/entities/ubigeo.entity';
import { HealthCentersController } from './health-centers.controller';
import { HealthCentersService } from './health-centers.service';
@Module({
  imports: [TypeOrmModule.forFeature([HealthCenter, UbigeoDistrict])],
  controllers: [HealthCentersController],
  providers: [HealthCentersService],
  exports: [HealthCentersService],
})
export class HealthCentersModule {}
