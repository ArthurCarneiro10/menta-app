/**
 * POST /api/apple/validar
 *
 * O app iOS chama esta rota logo apos uma compra (ou restauracao) bem
 * sucedida, mandando o transactionId. NUNCA confiamos no que o app diz:
 * reconsultamos a Apple pelo transactionId e so liberamos o plano se a
 * resposta AUTENTICADA da Apple confirmar assinatura ativa.
 *
 * Mesma filosofia do webhook do MP (que sempre chama getPreapproval).
 *
 * Body: { transactionId: string }
 * Header: Authorization: Bearer <supabase access token>
 *
 * Retorna: { sucesso: true, nivel, expiraEm } ou { erro }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStatusAssinatura, produtoParaPlano, ambienteAtual } from '@/lib/apple-iap';
import { ativarPremium } from '@/lib/premium';

export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    // ===== 1) Autentica o usuario =====
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ erro: 'Sessao invalida.' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ erro: 'Sessao invalida.' }, { status: 401 });
    }

    // ===== 2) Le o transactionId =====
    const body = await request.json();
    const transactionId: string | undefined = body?.transactionId;
    if (!transactionId) {
      return NextResponse.json({ erro: 'transactionId nao informado.' }, { status: 400 });
    }

    // ===== 3) FONTE DA VERDADE: reconsulta a Apple =====
    let status;
    try {
      status = await getStatusAssinatura(transactionId);
    } catch (e) {
      console.error('[apple-validar] falha consultando Apple:', e);
      return NextResponse.json(
        { erro: 'Nao foi possivel confirmar a compra com a Apple. Tente novamente.' },
        { status: 502 }
      );
    }

    const { transacao, ativa } = status;

    // ===== 4) A compra e deste usuario? =====
    // O app manda appAccountToken = user.id na hora da compra. Se vier
    // preenchido e nao bater, recusamos (alguem tentando reusar recibo alheio).
    if (transacao.appAccountToken && transacao.appAccountToken !== user.id) {
      console.warn(
        `[apple-validar] appAccountToken ${transacao.appAccountToken} != user ${user.id}`
      );
      return NextResponse.json(
        { erro: 'Esta compra pertence a outra conta.' },
        { status: 403 }
      );
    }

    // ===== 5) Reembolsada / revogada? =====
    if (transacao.revocationDate) {
      return NextResponse.json({ erro: 'Esta compra foi reembolsada.' }, { status: 403 });
    }

    // ===== 6) Assinatura ativa? =====
    if (!ativa) {
      return NextResponse.json(
        { erro: 'Esta assinatura nao esta ativa.', status: status.status },
        { status: 403 }
      );
    }

    // ===== 7) Produto conhecido? =====
    const plano = produtoParaPlano(transacao.productId);
    if (!plano) {
      console.error(`[apple-validar] productId desconhecido: ${transacao.productId}`);
      return NextResponse.json({ erro: 'Produto nao reconhecido.' }, { status: 400 });
    }

    // ===== 8) Espelha na tabela assinaturas =====
    // Apple e como o CARTAO: recorrencia gerenciada por eles. Por isso usamos
    // ativarPremium (que NAO mexe em plano_expira_em) e nunca ativarPlanoPix.
    const expiraEmISO = transacao.expiresDate
      ? new Date(transacao.expiresDate).toISOString()
      : null;

    const { error: upsertError } = await supabase
      .from('assinaturas')
      .upsert(
        {
          user_id: user.id,
          origem: 'apple',
          apple_original_transaction_id: transacao.originalTransactionId,
          apple_product_id: transacao.productId,
          apple_expira_em: expiraEmISO,
          plano_tipo: plano.ciclo,
          nivel: plano.nivel,
          valor: plano.valor,
          status: 'authorized',
          proximo_pagamento: expiraEmISO,
        },
        { onConflict: 'apple_original_transaction_id' }
      );

    if (upsertError) {
      console.error('[apple-validar] erro upsert assinaturas:', upsertError);
      // Nao bloqueia: o importante e o profiles.plano abaixo.
    }

    // ===== 9) Libera o plano (reusa a MESMA logica do MP) =====
    await ativarPremium(user.id, supabase, plano.nivel);

    console.log(
      `[apple-validar] user ${user.id} virou ${plano.nivel} (${ambienteAtual()}) origTx=${transacao.originalTransactionId}`
    );

    return NextResponse.json({
      sucesso: true,
      nivel: plano.nivel,
      ciclo: plano.ciclo,
      expiraEm: expiraEmISO,
    });
  } catch (e) {
    console.error('[apple-validar] erro:', e);
    return NextResponse.json(
      { erro: 'Erro ao validar a compra.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'apple-validar ativo',
    ambiente: ambienteAtual(),
  });
}