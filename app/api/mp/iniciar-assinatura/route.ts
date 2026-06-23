/**
 * Inicia o fluxo de assinatura no Mercado Pago.
 *
 * 1. Autentica usuario via JWT
 * 2. Verifica se nao eh Premium (nao deixa duplicar)
 * 3. PREVENCAO: cancela pending antigas pra nao empilhar (anti cobranca dupla)
 * 4. Cria uma preapproval no MP com status 'pending' (sem cartao definido ainda)
 * 5. Salva no DB como pending
 * 6. Retorna init_point - frontend redireciona pra essa URL
 *
 * O usuario vai pro checkout do MP, cadastra cartao, e aprova. Quando isso
 * acontece, MP dispara webhook pra /api/mp/webhook que entao marca o usuario
 * como Premium (e cura quaisquer duplicadas remanescentes).
 *
 * Body: { plano: 'mensal' | 'anual' }
 * Header: Authorization: Bearer <jwt>
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { criarPreapproval, PRECOS } from '@/lib/mercadopago';
import { cancelarAssinaturasVivas } from '@/lib/assinaturas';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

export async function POST(request: Request) {
  try {
    // ===== Auth =====
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ erro: 'Sessao invalida' }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ erro: 'Sessao invalida' }, { status: 401 });
    }

    if (!user.email) {
      return NextResponse.json(
        { erro: 'Usuario sem email cadastrado' },
        { status: 400 }
      );
    }

    // ===== Confere se ja eh Premium =====
    const { data: perfil } = await supabase
      .from('profiles')
      .select('plano')
      .eq('id', user.id)
      .single();

    if (perfil?.plano === 'premium') {
      return NextResponse.json(
        { erro: 'Voce ja tem uma assinatura ativa' },
        { status: 400 }
      );
    }

    // ===== Valida config =====
    if (!APP_URL) {
      return NextResponse.json(
        { erro: 'NEXT_PUBLIC_APP_URL nao configurado' },
        { status: 500 }
      );
    }

    // ===== PREVENCAO: limpa pending antigas =====
    // Se o usuario clicou "assinar" varias vezes sem concluir, ele tem
    // preapprovals 'pending' empilhadas no MP. Cancelamos todas antes de
    // criar a nova, garantindo uma tentativa aberta por vez.
    // A cura definitiva contra cobranca dupla esta no webhook (ao autorizar).
    // Tolerante a falha: se nao der pra limpar, segue mesmo assim.
    try {
      const limpas = await cancelarAssinaturasVivas(user.id, supabase, {
        statuses: ['pending'],
      });
      if (limpas > 0) {
        console.log(`[iniciar-assinatura] ${limpas} pending antiga(s) cancelada(s)`);
      }
    } catch (e) {
      console.error('[iniciar-assinatura] erro limpando pending antigas:', e);
    }

    // ===== Body =====
    const body = await request.json().catch(() => ({}));
    const planoTipo: 'mensal' | 'anual' =
      body.plano === 'anual' ? 'anual' : 'mensal';

    const valor = planoTipo === 'anual' ? PRECOS.ANUAL : PRECOS.MENSAL;
    const frequency = planoTipo === 'anual' ? 12 : 1;

    // ===== Cria preapproval no MP (sem plano associado) =====
    // Status 'pending' significa: aguardando o usuario completar o cadastro
    // do cartao no checkout do MP. Quando ele completar, MP autoriza e
    // dispara webhook pra /api/mp/webhook.
    // SEM free_trial: a cobranca ocorre na primeira fatura imediatamente
    // apos o cadastro do cartao (sem periodo gratuito).
    const preapproval = await criarPreapproval({
      reason: `Menta Premium - ${planoTipo === 'anual' ? 'Anual' : 'Mensal'}`,
      payer_email: user.email,
      external_reference: user.id,
      back_url: `${APP_URL}/config?assinatura=ok`,
      notification_url: `${APP_URL}/api/mp/webhook`,
      auto_recurring: {
        frequency,
        frequency_type: 'months',
        transaction_amount: valor,
        currency_id: 'BRL',
      },
      status: 'pending',
    });

    // ===== Salva no DB (status pending) =====
    const { error: upsertError } = await supabase
      .from('assinaturas')
      .upsert(
        {
          user_id: user.id,
          mp_preapproval_id: preapproval.id,
          mp_preapproval_plan_id: '', // nao usamos plano associado
          plano_tipo: planoTipo,
          valor,
          status: 'pending',
        },
        { onConflict: 'mp_preapproval_id' }
      );

    if (upsertError) {
      console.error('[iniciar-assinatura] erro salvando DB:', upsertError);
      // Continua mesmo assim - o webhook depois corrige
    }

    return NextResponse.json({
      sucesso: true,
      init_point: preapproval.init_point,
      preapproval_id: preapproval.id,
    });
  } catch (e) {
    console.error('[iniciar-assinatura] Erro:', e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : 'desconhecido' },
      { status: 500 }
    );
  }
}