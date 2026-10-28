import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Content,
  FunctionDeclaration,
  GoogleGenerativeAI,
} from '@google/generative-ai';

export type AssistantModelTurn = {
  content: Content;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

class TransientModelError extends Error {
  constructor(readonly status: number) {
    super(`Gemini ${status}`);
  }
}

const RETRY_DELAYS_MS = [1_000, 3_000];

/** Un paso del asistente de datos (IA2): Gemini con function calling. */
@Injectable()
export class GeminiAssistantClient {
  private readonly logger = new Logger(GeminiAssistantClient.name);

  constructor(private readonly config: ConfigService) {}

  async generate(input: {
    system: string;
    contents: Content[];
    tools: FunctionDeclaration[];
  }): Promise<AssistantModelTurn> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey)
      throw new ServiceUnavailableException(
        'El asistente no está configurado. Avisa al administrador.',
      );
    // Lista ordenada: si un modelo sigue saturado tras los reintentos, se pasa
    // al siguiente.
    const models = this.config
      .getOrThrow<string>('GEMINI_ASSISTANT_MODELS')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    for (const [index, model] of models.entries()) {
      try {
        return await this.generateWith(model, apiKey, input);
      } catch (error) {
        const transient = error instanceof TransientModelError;
        if (transient && index < models.length - 1) continue;
        throw new ServiceUnavailableException(
          transient && error.status === 429
            ? 'El asistente recibió demasiadas consultas. Intenta en un minuto.'
            : 'El asistente no está disponible en este momento. Intenta de nuevo.',
        );
      }
    }
    throw new ServiceUnavailableException(
      'El asistente no está configurado. Avisa al administrador.',
    );
  }

  private async generateWith(
    model: string,
    apiKey: string,
    input: {
      system: string;
      contents: Content[];
      tools: FunctionDeclaration[];
    },
  ): Promise<AssistantModelTurn> {
    const generative = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model,
      systemInstruction: input.system,
      tools: input.tools.length
        ? [{ functionDeclarations: input.tools }]
        : undefined,
      generationConfig: { temperature: 0.2 },
    });
    let response;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await generative.generateContent({
          contents: input.contents,
        });
        break;
      } catch (error) {
        const status = (error as { status?: number }).status;
        const transient =
          status === 429 || (status !== undefined && status >= 500);
        if (transient && attempt < RETRY_DELAYS_MS.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_DELAYS_MS[attempt]),
          );
          continue;
        }
        this.logger.warn(
          `Gemini assistant call to ${model} failed (${status ?? 'sin estado'}): ${(error as Error).message}`,
        );
        if (transient) throw new TransientModelError(status);
        throw error;
      }
    }
    const candidate = response.response.candidates?.[0];
    if (!candidate?.content?.parts?.length)
      throw new ServiceUnavailableException(
        'El asistente no devolvió una respuesta. Intenta reformular la pregunta.',
      );
    const usage = response.response.usageMetadata;
    return {
      // Se reenvía tal cual: Gemini 3 exige recibir de vuelta sus thought signatures.
      content: { role: 'model', parts: candidate.content.parts },
      model,
      inputTokens: usage?.promptTokenCount ?? null,
      outputTokens: usage?.candidatesTokenCount ?? null,
    };
  }
}
