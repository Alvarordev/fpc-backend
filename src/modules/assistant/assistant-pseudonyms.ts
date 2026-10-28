import { AssistantPseudonyms } from '../../database/entities/assistant-conversation.entity';

const TOKEN = /\bP-\d{3,}\b/g;

/**
 * IA4: los pacientes viajan al modelo como P-001, P-002… El mapa se guarda en
 * la conversación para que el seudónimo sea estable entre preguntas y para
 * rehidratar los nombres al mostrar la respuesta.
 */
export class AssistantPseudonymizer {
  private readonly byPatient = new Map<string, string>();

  constructor(readonly map: AssistantPseudonyms) {
    for (const [token, value] of Object.entries(map))
      this.byPatient.set(value.patientId, token);
  }

  tokenFor(patientId: string, name: string): string {
    const known = this.byPatient.get(patientId);
    if (known) return known;
    const token = `P-${String(this.byPatient.size + 1).padStart(3, '0')}`;
    this.map[token] = { patientId, name };
    this.byPatient.set(patientId, token);
    return token;
  }

  patientIdFor(token: string): string | null {
    return this.map[token.trim().toUpperCase()]?.patientId ?? null;
  }

  rehydrate(text: string): string {
    return text.replace(TOKEN, (token) => this.map[token]?.name ?? token);
  }

  mentioned(text: string) {
    const tokens = new Set(text.match(TOKEN) ?? []);
    return [...tokens]
      .filter((token) => this.map[token])
      .map((token) => ({ token, ...this.map[token] }));
  }
}
