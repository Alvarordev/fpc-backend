export const N8N_WEBHOOK_EVENT = 'n8n.webhook';

export type N8nWebhookVar =
  'Alerta' | 'AlertaResuelta' | 'AlertaDerivar' | 'Cita' | 'Registro';

export interface N8nWebhookEnvelope {
  var: N8nWebhookVar;
  query: Record<string, string>;
}

export class N8nWebhookDispatchEvent {
  constructor(public readonly envelope: N8nWebhookEnvelope) {}
}
