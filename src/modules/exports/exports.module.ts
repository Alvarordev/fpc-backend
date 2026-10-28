import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportLog } from '../../database/entities/export-log.entity';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExportLog]), DashboardModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
