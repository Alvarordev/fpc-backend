import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import {
  KnowledgeDocument,
  KnowledgeIndexStatus,
} from '../../database/entities/knowledge-document.entity';
import { GeminiKnowledgeClient } from '../../integrations/gemini/gemini-knowledge.client';

@Injectable()
export class KnowledgeIndexerService {
  private readonly logger = new Logger(KnowledgeIndexerService.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly gemini: GeminiKnowledgeClient,
  ) {}

  @Cron('*/10 * * * * *', { waitForCompletion: true })
  async process() {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    let locked = false;
    try {
      const rows = (await runner.query(
        'SELECT pg_try_advisory_lock(17851008) AS locked',
      )) as { locked: boolean }[];
      locked = rows[0].locked;
      if (!locked) return;
      const repo = runner.manager.getRepository(KnowledgeDocument);
      const docs = await repo
        .createQueryBuilder('doc')
        .addSelect('doc.content')
        .where('doc.index_status IN (:...states)', {
          states: [
            KnowledgeIndexStatus.PENDING,
            KnowledgeIndexStatus.PROCESSING,
          ],
        })
        .orderBy('doc.updated_at', 'ASC')
        .take(3)
        .getMany();
      if (!docs.length) return;
      let settings = (await runner.query(
        'SELECT store_name FROM knowledge_search_settings WHERE id=1',
      )) as { store_name: string }[];
      if (!settings.length) {
        let store: string;
        try {
          store = await this.gemini.createStore();
        } catch {
          await repo.update(
            docs.map((doc) => doc.id),
            {
              indexStatus: KnowledgeIndexStatus.FAILED,
              indexError:
                'No se pudo conectar con la búsqueda de documentos. Avisa al administrador y vuelve a intentar.',
            },
          );
          return;
        }
        await runner.query(
          'INSERT INTO knowledge_search_settings(id,store_name) VALUES(1,$1)',
          [store],
        );
        settings = [{ store_name: store }];
      }
      for (const doc of docs) {
        try {
          if (
            Date.now() - (doc.indexStartedAt ?? doc.createdAt).getTime() >
              24 * 60 * 60 * 1000 &&
            doc.operationName
          )
            throw new Error('Indexing expired');
          if (!doc.operationName)
            await repo.update(doc.id, { indexStartedAt: new Date() });
          const operation = doc.operationName
            ? await this.gemini.poll(doc.operationName)
            : await this.gemini.upload(doc, settings[0].store_name);
          if (operation.error) throw new Error('Remote indexing failed');
          if (operation.done && !operation.response?.documentName)
            throw new Error('Index result missing');
          await repo.update(doc.id, {
            storeName: settings[0].store_name,
            operationName: operation.name ?? null,
            remoteName: operation.response?.documentName ?? null,
            indexStatus: operation.done
              ? KnowledgeIndexStatus.READY
              : KnowledgeIndexStatus.PROCESSING,
            indexError: null,
          });
        } catch {
          await repo.update(doc.id, {
            indexStatus: KnowledgeIndexStatus.FAILED,
            indexError:
              'No se pudo preparar el documento. Revisa el archivo y vuelve a intentar.',
          });
          this.logger.warn(`No se pudo indexar el documento ${doc.id}`);
        }
      }
    } catch {
      this.logger.warn(
        'No se pudo procesar la cola de documentos. Se volverá a intentar.',
      );
    } finally {
      try {
        if (locked) await runner.query('SELECT pg_advisory_unlock(17851008)');
      } finally {
        await runner.release();
      }
    }
  }
}
