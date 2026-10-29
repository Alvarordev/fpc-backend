import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { KnowledgeDocument } from '../../database/entities/knowledge-document.entity';
import { GeminiKnowledgeClient } from '../../integrations/gemini/gemini-knowledge.client';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeIndexerService } from './knowledge-indexer.service';
import { KnowledgeAnswerService } from './knowledge-answer.service';

@Module({
  imports: [TypeOrmModule.forFeature([KnowledgeDocument]), ThrottlerModule],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeService,
    KnowledgeIndexerService,
    KnowledgeAnswerService,
    GeminiKnowledgeClient,
  ],
  exports: [KnowledgeAnswerService],
})
export class KnowledgeModule {}
