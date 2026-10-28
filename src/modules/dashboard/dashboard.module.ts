import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardIndicatorsService } from './dashboard-indicators.service';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardIndicatorsService],
  exports: [DashboardIndicatorsService],
})
export class DashboardModule {}
