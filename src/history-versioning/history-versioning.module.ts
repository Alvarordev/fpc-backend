import { Global, Module } from '@nestjs/common';
import { HistoryVersioningService } from './history-versioning.service';

@Global()
@Module({
  providers: [HistoryVersioningService],
  exports: [HistoryVersioningService],
})
export class HistoryVersioningModule {}
