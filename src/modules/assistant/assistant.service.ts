import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Content, Part } from '@google/generative-ai';
import { Repository } from 'typeorm';
import { AssistantConversation } from '../../database/entities/assistant-conversation.entity';
import {
  AssistantMessage,
  AssistantMessageRole,
  AssistantToolCall,
} from '../../database/entities/assistant-message.entity';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.enum';
import { AssistantMode } from '../../database/entities/assistant-mode.enum';
import { KnowledgeAnswerService } from '../knowledge/knowledge-answer.service';
import { GeminiAssistantClient } from '../../integrations/gemini/gemini-assistant.client';
import { AssistantPseudonymizer } from './assistant-pseudonyms';
import {
  AssistantToolError,
  AssistantToolsService,
} from './assistant-tools.service';

const MAX_STEPS = 8;
const HISTORY_MESSAGES = 12;

function systemPrompt() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
  }).format(new Date());
  return `Eres el asistente de datos del CRM del programa SEPA de la Fundación Peruana de Cáncer.
Respondes preguntas del equipo de la fundación sobre indicadores, pacientes, alertas de hospitales y la carga del call center.
Hoy es ${today} (hora de Lima).

Reglas:
- Usa SIEMPRE las herramientas para obtener datos. Nunca inventes ni estimes cifras: si una herramienta no da el dato, dilo.
- Puedes encadenar herramientas (p. ej. buscar el hospital para obtener su ID y luego filtrar indicadores).
- Los pacientes aparecen como códigos P-001, P-002…; nómbralos solo con ese código, exactamente como viene. No pidas ni intentes deducir nombres reales.
- Indica siempre el periodo y los filtros que usaste. Si la pregunta no tiene periodo, aclara que el dato es acumulado o al día de hoy.
- Si la pregunta es ambigua, elige la interpretación más razonable y dila en una frase.
- Responde en español neutro (tú, no vos), breve y directo. Usa listas o tablas Markdown cuando ayuden.
- No respondas temas ajenos al programa ni des consejo médico.`;
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    @InjectRepository(AssistantConversation)
    private readonly conversations: Repository<AssistantConversation>,
    @InjectRepository(AssistantMessage)
    private readonly messages: Repository<AssistantMessage>,
    private readonly tools: AssistantToolsService,
    private readonly model: GeminiAssistantClient,
    private readonly knowledge: KnowledgeAnswerService,
  ) {}

  listConversations(user: User, mode = AssistantMode.DATA) {
    return this.conversations.find({
      where: {
        userId: user.id,
        mode: user.role === UserRole.AGENT ? AssistantMode.DOCUMENTS : mode,
      },
      order: { updatedAt: 'DESC' },
      take: 50,
    });
  }

  async getConversation(id: string, user: User) {
    const conversation = await this.conversations.findOne({
      where: { id, userId: user.id },
      relations: { messages: true },
      order: { messages: { createdAt: 'ASC' } },
    });
    if (!conversation)
      throw new NotFoundException('No se encontró la conversación.');
    this.assertModeAccess(user, conversation.mode);
    return conversation;
  }

  async deleteConversation(id: string, user: User) {
    await this.getConversation(id, user);
    const result = await this.conversations.delete({ id, userId: user.id });
    if (!result.affected)
      throw new NotFoundException('No se encontró la conversación.');
  }

  private assertModeAccess(user: User, mode: AssistantMode) {
    if (
      mode === AssistantMode.DATA &&
      ![UserRole.ADMIN, UserRole.FOUNDATION].includes(user.role)
    )
      throw new ForbiddenException(
        'Tu rol solo puede consultar documentos del programa.',
      );
  }

  async ask(
    user: User,
    question: string,
    conversationId?: string,
    mode = AssistantMode.DATA,
  ) {
    this.assertModeAccess(user, mode);
    const conversation = conversationId
      ? await this.getConversation(conversationId, user)
      : await this.conversations.save(
          this.conversations.create({
            userId: user.id,
            mode,
            title: question.trim().slice(0, 200),
            pseudonyms: {},
            messages: [],
          }),
        );
    if (conversation.mode !== mode)
      throw new BadRequestException(
        'Empieza una conversación nueva para cambiar el modo de consulta.',
      );
    const history = (conversation.messages ?? [])
      .filter((message) => !message.error)
      .slice(-HISTORY_MESSAGES);
    const userMessage = await this.messages.save(
      this.messages.create({
        conversationId: conversation.id,
        role: AssistantMessageRole.USER,
        content: question.trim(),
        toolCalls: [],
      }),
    );

    if (mode === AssistantMode.DOCUMENTS) {
      let result: Awaited<ReturnType<KnowledgeAnswerService['answer']>>;
      let error: string | null = null;
      try {
        result = await this.knowledge.answer(
          question,
          history
            .filter((message) => message.role === AssistantMessageRole.USER)
            .map((message) => message.content),
        );
      } catch {
        error =
          'No se pudo consultar la biblioteca en este momento. Intenta de nuevo.';
        result = {
          content: error,
          citations: [],
          unanswered: false,
          model: null,
          inputTokens: null,
          outputTokens: null,
        };
      }
      await this.conversations.update(conversation.id, {
        updatedAt: new Date(),
      });
      const assistantMessage = await this.messages.save(
        this.messages.create({
          conversationId: conversation.id,
          role: AssistantMessageRole.ASSISTANT,
          ...result,
          toolCalls: [],
          error,
        }),
      );
      return { conversation, userMessage, assistantMessage };
    }

    const pseudonyms = new AssistantPseudonymizer(conversation.pseudonyms);
    const contents: Content[] = [
      ...history.map((message) => ({
        role: message.role === AssistantMessageRole.USER ? 'user' : 'model',
        parts: [{ text: message.content }],
      })),
      { role: 'user', parts: [{ text: question.trim() }] },
    ];
    const toolCalls: AssistantToolCall[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let modelName: string | null = null;
    let answer: string | null = null;
    let failure: string | null = null;

    try {
      for (let step = 0; step < MAX_STEPS && answer === null; step++) {
        const turn = await this.model.generate({
          system: systemPrompt(),
          contents,
          tools: this.tools.declarationsFor(user),
        });
        modelName = turn.model;
        inputTokens += turn.inputTokens ?? 0;
        outputTokens += turn.outputTokens ?? 0;
        const calls = turn.content.parts.filter((part) => part.functionCall);
        if (!calls.length) {
          answer = turn.content.parts
            .map((part) =>
              (part as { thought?: boolean }).thought ? '' : (part.text ?? ''),
            )
            .join('')
            .trim();
          break;
        }
        contents.push(turn.content);
        const responses: Part[] = [];
        for (const { functionCall } of calls) {
          const { name, args } = functionCall!;
          const started = Date.now();
          const call: AssistantToolCall = {
            name,
            args: (args ?? {}) as Record<string, unknown>,
            ok: true,
            durationMs: 0,
          };
          let response: object;
          try {
            response = {
              result: await this.tools.run(name, call.args, {
                user,
                pseudonyms,
              }),
            };
          } catch (error) {
            call.ok = false;
            // Los 4xx de los servicios ya traen un mensaje en español que le
            // sirve al modelo para corregir los argumentos.
            const expected =
              error instanceof AssistantToolError ||
              (error instanceof HttpException && error.getStatus() < 500);
            call.error = expected ? error.message : 'La herramienta falló.';
            if (!expected)
              this.logger.error(error, `Assistant tool ${name} failed`);
            response = { error: call.error };
          }
          call.durationMs = Date.now() - started;
          toolCalls.push(call);
          responses.push({ functionResponse: { name, response } });
        }
        contents.push({ role: 'function', parts: responses });
      }
      if (answer === null)
        failure =
          'La consulta necesitó demasiados pasos. Prueba con una pregunta más acotada.';
      else if (!answer)
        failure =
          'El asistente no devolvió una respuesta. Intenta reformular la pregunta.';
    } catch (error) {
      failure =
        error instanceof Error && 'getStatus' in error
          ? error.message
          : 'El asistente no está disponible en este momento. Intenta de nuevo.';
      if (!(error instanceof Error && 'getStatus' in error))
        this.logger.error(error, 'Assistant failed');
    }

    conversation.pseudonyms = pseudonyms.map;
    await this.conversations.save({
      id: conversation.id,
      pseudonyms: conversation.pseudonyms,
      updatedAt: new Date(),
    });
    const assistantMessage = await this.messages.save(
      this.messages.create({
        conversationId: conversation.id,
        role: AssistantMessageRole.ASSISTANT,
        content: answer || failure || '',
        toolCalls,
        model: modelName,
        inputTokens: inputTokens || null,
        outputTokens: outputTokens || null,
        error: failure,
      }),
    );
    return { conversation, userMessage, assistantMessage };
  }
}
