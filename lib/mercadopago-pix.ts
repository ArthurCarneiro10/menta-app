/**
 * Mercado Pago - Pagamento unico via Pix (Checkout Pro / Preference).
 *
 * Diferente da assinatura recorrente (Preapproval, em lib/mercadopago.ts),
 * aqui criamos um PAGAMENTO UNICO restrito a Pix. Usado so no plano ANUAL:
 * o usuario paga uma vez (com 10% de desconto) e ganha 12 meses de acesso.
 * NAO ha renovacao automatica - a validade eh controlada pela coluna
 * profiles.plano_expira_em e por um cron diario.
 *
 * Fluxo:
 *   1. /api/mp/pix/iniciar cria uma preference (so Pix) e salva pending em pagamentos_pix
 *   2. usuario paga o QR Code na pagina do MP
 *   3. MP chama /api/mp/webhook com type=payment
 *   4. webhook confirma 'approved' e ativa o plano com validade de 12 meses
 *
 * Token de acesso vem do mesmo MP_ACCESS_TOKEN do fluxo de cartao.
 */

const MP_API_BASE = 'https://api.mercadopago.com';

function getAccessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MP_ACCESS_TOKEN nao configurado no .env');
  }
  return token;
}

// =========================================================================
// Precos e tipos
// =========================================================================

// Precos Pix ANUAL: 10% de desconto sobre o anual cheio (299 / 499).
//   premium: 299 -> 269.10
//   max:     499 -> 449.10
export const PRECOS_PIX = {
  premium: 1,
  max: 1,
} as const;

export type NivelPagoPix = 'premium' | 'max';

export const NOME_NIVEL_PIX: Record<NivelPagoPix, string> = {
  premium: 'Premium',
  max: 'Max',
};

export type MPPreferenceResponse = {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
  external_reference?: string;
};

export type MPPaymentResponse = {
  id: number;
  status?: string; // 'approved' | 'pending' | 'rejected' | 'cancelled' | ...
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  payment_method_id?: string;
  date_approved?: string | null;
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
    throw new Error(`MP Pix erro ${res.status} em ${method} ${endpoint}: ${errorText}`);
  }

  return res.json() as Promise<T>;
}

// =========================================================================
// Preference (so Pix)
// =========================================================================

/**
 * Cria uma preference de Checkout Pro restrita a Pix.
 *
 * Excluimos cartao de credito, debito e boleto, deixando so Pix (e saldo MP).
 * O external_reference liga o pagamento de volta a ordem em pagamentos_pix,
 * pra o webhook saber quem ativar.
 */
export async function criarPreferenciaPix(params: {
  titulo: string;
  valor: number;
  payerEmail: string;
  externalReference: string;
  backUrl: string;
  notificationUrl: string;
}): Promise<MPPreferenceResponse> {
  const { titulo, valor, payerEmail, externalReference, backUrl, notificationUrl } = params;

  return mpFetch<MPPreferenceResponse>('/checkout/preferences', {
    method: 'POST',
    idempotencyKey: crypto.randomUUID(),
    body: {
      items: [
        {
          title: titulo,
          quantity: 1,
          unit_price: valor,
          currency_id: 'BRL',
        },
      ],
      payer: { email: payerEmail },
      external_reference: externalReference,
      back_urls: {
        success: backUrl,
        pending: backUrl,
        failure: backUrl,
      },
      auto_return: 'approved',
      notification_url: notificationUrl,
      payment_methods: {
        // So Pix: exclui cartoes e boleto.
        excluded_payment_types: [
          { id: 'credit_card' },
          { id: 'debit_card' },
          { id: 'ticket' },
        ],
        installments: 1,
      },
    },
  });
}

/**
 * Consulta um pagamento pelo id (usado pelo webhook quando chega type=payment).
 */
export async function getPagamento(paymentId: string): Promise<MPPaymentResponse> {
  return mpFetch<MPPaymentResponse>(`/v1/payments/${paymentId}`);
}