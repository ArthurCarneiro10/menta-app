/**
 * Cliente Mercado Pago - API de Assinaturas (preapproval).
 *
 * Wrappa as chamadas basicas pra criar plano, criar assinatura individual,
 * consultar e cancelar. Token de acesso vem do .env (MP_ACCESS_TOKEN).
 *
 * Docs oficiais:
 * - Plano: https://www.mercadopago.com.br/developers/en/reference/subscriptions/_preapproval_plan/post
 * - Assinatura: https://www.mercadopago.com.br/developers/en/reference/subscriptions/_preapproval/post
 * - Authorized payment: https://www.mercadopago.com.br/developers/en/reference/subscriptions/_authorized_payments_id/get
 */

const MP_API_BASE = 'https://api.mercadopago.com';

function getAccessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MP_ACCESS_TOKEN nao configurado no .env.local');
  }
  return token;
}

// =========================================================================
// Tipos
// =========================================================================

export type MPFrequencyType = 'months' | 'days';

export type MPFreeTrial = {
  frequency: number;
  frequency_type: MPFrequencyType;
};

export type MPAutoRecurring = {
  frequency: number;
  frequency_type: MPFrequencyType;
  repetitions?: number;
  billing_day?: number;
  billing_day_proportional?: boolean;
  free_trial?: MPFreeTrial;
  transaction_amount: number;
  currency_id: 'BRL';
};

export type MPPreapprovalPlanCreate = {
  reason: string;
  auto_recurring: MPAutoRecurring;
  back_url: string;
  payment_methods_allowed?: {
    payment_types?: { id?: string }[];
    payment_methods?: { id?: string }[];
  };
};

export type MPPreapprovalPlanResponse = {
  id: string;
  application_id: number;
  collector_id: number;
  reason: string;
  status: 'active' | 'inactive';
  init_point: string;
  date_created: string;
  last_modified: string;
  auto_recurring: MPAutoRecurring;
};

export type MPPreapprovalStatus = 'pending' | 'authorized' | 'paused' | 'cancelled';

export type MPPreapprovalCreate = {
  // Pode ser criada de duas formas:
  // (A) Com plano associado: requer preapproval_plan_id + card_token_id + status='authorized'
  // (B) Sem plano associado: requer auto_recurring inline. Aceita status='pending' sem cartao.
  preapproval_plan_id?: string;
  auto_recurring?: MPAutoRecurring;
  card_token_id?: string;
  reason?: string;
  payer_email: string;
  back_url: string;
  external_reference?: string;
  notification_url?: string;
  status?: 'authorized' | 'pending';
};

export type MPPreapprovalResponse = {
  id: string;
  version: number;
  application_id: number;
  collector_id: number;
  preapproval_plan_id?: string;
  reason: string;
  external_reference?: string;
  back_url: string;
  init_point: string;
  status: MPPreapprovalStatus;
  payer_id?: number;
  card_id?: number;
  payment_method_id?: string;
  next_payment_date?: string;
  date_created: string;
  last_modified: string;
  auto_recurring: MPAutoRecurring;
};

/**
 * Resposta do endpoint /authorized_payments/{id}.
 *
 * Este recurso representa UMA cobranca recorrente (ex: a mensalidade do
 * mes). O campo que importa pra nos eh o preapproval_id, que liga essa
 * cobranca de volta a assinatura. Tipado de forma defensiva porque o MP
 * pode trazer campos a mais/a menos dependendo do estado.
 */
export type MPAuthorizedPaymentResponse = {
  id: number;
  preapproval_id?: string;
  type?: string;
  status?: string;
  date_created?: string;
  transaction_amount?: number;
  payment?: {
    id?: number;
    status?: string;
    status_detail?: string;
  };
};

// =========================================================================
// Cliente HTTP
// =========================================================================

async function mpFetch<T>(
  endpoint: string,
  options: { method?: string; body?: unknown; idempotencyKey?: string } = {}
): Promise<T> {
  const { method = 'GET', body, idempotencyKey } = options;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${getAccessToken()}`,
    'Content-Type': 'application/json',
  };

  if (idempotencyKey) {
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  const res = await fetch(`${MP_API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`MP API erro ${res.status} em ${method} ${endpoint}: ${errorText}`);
  }

  return res.json() as Promise<T>;
}

// =========================================================================
// Preapproval Plans (molde do plano)
// =========================================================================

export async function criarPreapprovalPlan(
  data: MPPreapprovalPlanCreate
): Promise<MPPreapprovalPlanResponse> {
  return mpFetch<MPPreapprovalPlanResponse>('/preapproval_plan', {
    method: 'POST',
    body: data,
  });
}

export async function getPreapprovalPlan(id: string): Promise<MPPreapprovalPlanResponse> {
  return mpFetch<MPPreapprovalPlanResponse>(`/preapproval_plan/${id}`);
}

// =========================================================================
// Preapprovals (assinatura individual)
// =========================================================================

export async function criarPreapproval(
  data: MPPreapprovalCreate
): Promise<MPPreapprovalResponse> {
  return mpFetch<MPPreapprovalResponse>('/preapproval', {
    method: 'POST',
    body: data,
    idempotencyKey: crypto.randomUUID(),
  });
}

export async function getPreapproval(id: string): Promise<MPPreapprovalResponse> {
  return mpFetch<MPPreapprovalResponse>(`/preapproval/${id}`);
}

export async function cancelarPreapproval(id: string): Promise<MPPreapprovalResponse> {
  return mpFetch<MPPreapprovalResponse>(`/preapproval/${id}`, {
    method: 'PUT',
    body: { status: 'cancelled' },
  });
}

/**
 * Consulta uma cobranca recorrente (authorized payment) pelo id.
 *
 * Usado pelo webhook quando chega o evento subscription_authorized_payment:
 * o data.id desse evento eh o id da cobranca, NAO da preapproval. Pegamos
 * o preapproval_id daqui pra ressincronizar a assinatura.
 */
export async function getAuthorizedPayment(
  id: string
): Promise<MPAuthorizedPaymentResponse> {
  return mpFetch<MPAuthorizedPaymentResponse>(`/authorized_payments/${id}`);
}

// =========================================================================
// Constantes de produto
// =========================================================================

// Niveis pagos e ciclos de cobranca
export type NivelPago = 'premium' | 'max';
export type CicloAssinatura = 'mensal' | 'anual';

// Precos por nivel e ciclo. Anual = "2 meses gratis".
// Acesso: PRECOS.premium.mensal, PRECOS.max.anual, etc.
export const PRECOS = {
  premium: { mensal: 29.90, anual: 299.00 },
  max: { mensal: 49.90, anual: 499.00 },
} as const;

// Nome amigavel do nivel (usado no "reason" da assinatura e na UI).
export const NOME_NIVEL: Record<NivelPago, string> = {
  premium: 'Premium',
  max: 'Max',
};