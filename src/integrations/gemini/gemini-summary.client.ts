import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  PatientSummaryError,
  PatientSummaryErrorCode,
  normalizePatientSummaryError,
} from '../../modules/patient-summaries/patient-summary-error';

@Injectable()
export class GeminiSummaryClient {
  constructor(private readonly config: ConfigService) {}

  async generate(prompt: string): Promise<{ text: string; model: string }> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey)
      throw new PatientSummaryError(
        PatientSummaryErrorCode.CONFIGURATION,
        false,
        'GEMINI_API_KEY is not configured',
      );

    const model = this.config.getOrThrow<string>('GEMINI_MODEL');
    try {
      const client = new GoogleGenerativeAI(apiKey);
      const response = await client
        .getGenerativeModel({ model })
        .generateContent(prompt);
      const text = sanitizeSummaryText(response.response.text());
      if (!text)
        throw new PatientSummaryError(
          PatientSummaryErrorCode.PROVIDER,
          false,
          'The summary provider returned an empty response',
        );
      return { text, model };
    } catch (error) {
      throw normalizePatientSummaryError(error);
    }
  }
}

// The prompt asks the model for plain, preamble-free prose, but small/fast
// models don't always follow that instruction — strip stray markdown and
// common lead-in sentences as a safety net rather than trust the output.
export function sanitizeSummaryText(raw: string): string {
  return raw
    .replace(
      /^\s*(aqu[ií]\s+(presento|tienes|est[aá]|dejo)|a\s+continuaci[oó]n\s+(se\s+presenta|presento))[^:\n]*:\s*/i,
      '',
    )
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/(^|\n)[ \t]*[*•-]\s+/g, '$1')
    .replace(/\s\*\s/g, '. ')
    .replace(/\*/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
