/**
 * Rota one-shot pra criar os 2 planos do Menta no Mercado Pago.
 *
 * Chama 2 vezes a API /preapproval_plan do MP (uma pra mensal, uma pra anual)
 * e retorna os IDs gerados. Arthur copia esses IDs pro .env.local pra que as
 * rotas de checkout possam referenciar.
 *
 * Eh executada UMA UNICA VEZ no setup. Se precisar atualizar precos depois,
 * use a rota PUT /preapproval_plan/{id} (vou criar quando precisarmos).
 *
 * Seguranca: protegida por ADMIN_SECRET (env var). Sem header valido, retorna 401.
 *
 * Como chamar:
 *   curl -X POST http://localhost:3000/api/admin/setup-mp-plans \
 *     -H "Authorization: Bearer SEU_ADMIN_SECRET"
 */
 
import { NextResponse } from 'next/server';
import { criarPreapprovalPlan, PRECOS, TRIAL_DIAS } from '@/lib/mercadopago';
 
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
 
export async function POST(request: Request) {
  // ===== Auth =====
  const auth = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
  if (!ADMIN_SECRET || auth !== ADMIN_SECRET) {
    return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
  }
 
  try {
    // ===== Cria plano mensal =====
    const planoMensal = await criarPreapprovalPlan({
      reason: 'Menta Premium - Mensal',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: PRECOS.MENSAL,
        currency_id: 'BRL',
        free_trial: {
          frequency: TRIAL_DIAS,
          frequency_type: 'days',
        },
      },
      back_url: `${APP_URL}/config?assinatura=ok`,
      payment_methods_allowed: {
        payment_types: [{ id: 'credit_card' }],
      },
    });
 
    // ===== Cria plano anual =====
    const planoAnual = await criarPreapprovalPlan({
      reason: 'Menta Premium - Anual',
      auto_recurring: {
        frequency: 12,
        frequency_type: 'months',
        transaction_amount: PRECOS.ANUAL,
        currency_id: 'BRL',
        free_trial: {
          frequency: TRIAL_DIAS,
          frequency_type: 'days',
        },
      },
      back_url: `${APP_URL}/config?assinatura=ok`,
      payment_methods_allowed: {
        payment_types: [{ id: 'credit_card' }],
      },
    });
 
    return NextResponse.json({
      sucesso: true,
      mensagem: 'Planos criados com sucesso. Copie os IDs abaixo pro .env.local:',
      env_vars: {
        MP_PREAPPROVAL_PLAN_MENSAL: planoMensal.id,
        MP_PREAPPROVAL_PLAN_ANUAL: planoAnual.id,
      },
      detalhes: {
        mensal: {
          id: planoMensal.id,
          status: planoMensal.status,
          init_point: planoMensal.init_point,
          valor: planoMensal.auto_recurring.transaction_amount,
          frequencia: `${planoMensal.auto_recurring.frequency} ${planoMensal.auto_recurring.frequency_type}`,
          trial: planoMensal.auto_recurring.free_trial,
        },
        anual: {
          id: planoAnual.id,
          status: planoAnual.status,
          init_point: planoAnual.init_point,
          valor: planoAnual.auto_recurring.transaction_amount,
          frequencia: `${planoAnual.auto_recurring.frequency} ${planoAnual.auto_recurring.frequency_type}`,
          trial: planoAnual.auto_recurring.free_trial,
        },
      },
    });
  } catch (e) {
    console.error('[setup-mp-plans] Erro:', e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : 'desconhecido' },
      { status: 500 }
    );
  }
}
 
// GET: status pra confirmar que a rota esta viva e configurada
export async function GET() {
  return NextResponse.json({
    status: 'setup-mp-plans endpoint ativo',
    configurado: !!ADMIN_SECRET && !!process.env.MP_ACCESS_TOKEN,
  });
}