import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  KnowledgeDocument,
  KnowledgeIndexStatus,
  KnowledgeStatus,
} from '../../database/entities/knowledge-document.entity';
import type { AssistantDocumentCitation } from '../../database/entities/assistant-message.entity';
import { GeminiKnowledgeClient } from '../../integrations/gemini/gemini-knowledge.client';

const NOT_FOUND =
  'No encontré información suficiente en los documentos publicados para responder esta pregunta. Consulta con la fundación para ampliar o aclarar el material disponible.';

@Injectable()
export class KnowledgeAnswerService {
  constructor(
    @InjectRepository(KnowledgeDocument)
    private readonly docs: Repository<KnowledgeDocument>,
    private readonly gemini: GeminiKnowledgeClient,
  ) {}

  async answer(question: string, previousQuestions: string[]) {
    const documents = await this.docs.findBy({
      status: KnowledgeStatus.PUBLISHED,
      indexStatus: KnowledgeIndexStatus.READY,
    });
    const fallback = {
      content: NOT_FOUND,
      citations: [] as AssistantDocumentCitation[],
      unanswered: true,
      model: null as string | null,
      inputTokens: null as number | null,
      outputTokens: null as number | null,
    };
    if (!documents.length)
      return {
        ...fallback,
        content:
          'Todavía no hay documentos publicados para consultar. La fundación puede subir y publicar el material desde Biblioteca del programa.',
      };
    const { response, model } = await this.gemini.answer(
      question,
      previousQuestions,
      documents,
    );
    const usage = {
      model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    };
    const candidate = response.candidates?.[0];
    const grounding = candidate?.groundingMetadata;
    const contexts = grounding?.groundingChunks ?? [];
    const citations: AssistantDocumentCitation[] = [];
    const citationFor = new Map<number, number>();
    for (const [index, chunk] of contexts.entries()) {
      const context = chunk.retrievedContext;
      if (!context?.text?.trim()) continue;
      const documentId = context.customMetadata?.find(
        (item) => item.key === 'document_id',
      )?.stringValue;
      const document = documents.find(
        (doc) =>
          doc.id === documentId ||
          context.title === `KDOC_${doc.id}` ||
          (doc.remoteName && context.uri === doc.remoteName),
      );
      if (!document) continue;
      const number = citations.length + 1;
      citations.push({
        number,
        documentId: document.id,
        title: document.title,
        version: document.version,
        originalName: document.originalName,
        page: context.pageNumber ?? null,
        excerpt: context.text.slice(0, 3000),
      });
      citationFor.set(index, number);
    }
    const segments: string[] = [];
    const usedCitations = new Set<number>();
    for (const support of grounding?.groundingSupports ?? []) {
      if (
        !(support.groundingChunkIndices ?? []).every((index) =>
          citationFor.has(index),
        )
      )
        continue;
      const numbers = [
        ...new Set(
          (support.groundingChunkIndices ?? []).flatMap((index) =>
            citationFor.has(index) ? [citationFor.get(index)!] : [],
          ),
        ),
      ];
      const segment = support.segment;
      const part =
        candidate?.content?.parts?.[segment?.partIndex ?? 0]?.text ?? '';
      const text =
        segment?.text ??
        Buffer.from(part)
          .subarray(segment?.startIndex ?? 0, segment?.endIndex)
          .toString('utf8');
      if (numbers.length && text.trim()) {
        numbers.forEach((number) => usedCitations.add(number));
        const cleanText = text
          .replace(/\s*\(?KDOC_[0-9a-f-]{36}\)?/gi, '')
          .trim();
        segments.push(
          `${cleanText} ${numbers.map((number) => `[${number}](#source-${number})`).join(' ')}`,
        );
      }
    }
    if (!segments.length) return { ...fallback, ...usage };
    // Una retirada concurrente invalida también la respuesta que estaba generándose.
    const active = await this.docs.countBy({
      id: In(citations.map((citation) => citation.documentId)),
      status: KnowledgeStatus.PUBLISHED,
      indexStatus: KnowledgeIndexStatus.READY,
    });
    if (
      active !== new Set(citations.map((citation) => citation.documentId)).size
    )
      return { ...fallback, ...usage };
    return {
      content: [...new Set(segments)].join('\n\n'),
      citations: citations.filter((citation) =>
        usedCitations.has(citation.number),
      ),
      unanswered: false,
      ...usage,
    };
  }
}
