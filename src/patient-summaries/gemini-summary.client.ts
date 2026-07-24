import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  PatientSummaryError,
  PatientSummaryErrorCode,
  normalizePatientSummaryError,
} from './patient-summary-error';

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
      const text = response.response.text().trim();
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
