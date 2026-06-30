/**
 * POST /api/mp/pix/iniciar
 *
 * Inicia um pagamento UNICO via Pix para o plano ANUAL (com 10% de desconto).
 * Caminho SEPARADO do cartao (que usa /api/mp/iniciar-assinatura + Preapproval).
 *
 * 1. Autentica via JWT
 * 2. Bloqueia quem ja eh assinante de CARTAO ativo (plano pago e expira_em NULL)
 * 3. Cria uma ordem 'pending' em pagamentos_pix
 * 4. Cria uma preference no MP restrita a Pix (external_reference = id da ordem)
 * 5. Retorna init_point - o front redireciona pra pagina do QR Code
 *
 * A ativacao do plano (com validade de 12 meses) acontece no webhook quando
 * o pagamento for aprovado. AQUI nada vira premium ainda.
 *
 * Body: { nivel: 'premium' | 'max' }   (Pix eh sempre anual)
 * Header: Authorization: Bearer <jwt>
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  criarPreferenciaPix,
  PRECOS_PIX,
  NOME_NIVEL_PIX,
  type NivelPagoPix,
} from '@/lib/mercadopago-pix';

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
      return NextResponse.json({ erro: 'Usuario sem email cadastrado' }, { status: 400 });
    }

    if (!APP_URL) {
      return NextResponse.json(
        { erro: 'NEXT_PUBLIC_APP_URL nao configurado' },
        { status: 500 }
      );
    }

    // ===== Bloqueia assinante de CARTAO ativo =====
    // Cartao => plano pago COM plano_expira_em NULL (quem gerencia eh o MP).
    // Pix    => plano pago COM plano_expira_em preenchido (renovavel, pode pagar de novo).
    // Free   => liberado.
    const { data: perfil } = await supabase
      .from('profiles')
      .select('plano, plano_expira_em')
      .eq('id', user.id)
      .single();

    const ehPagoPorCartao =
      (perfil?.plano === 'premium' || perfil?.plano === 'max') && !perfil?.plano_expira_em;
    if (ehPagoPorCartao) {
      return NextResponse.json(
        { erro: 'Voce ja tem uma assinatura ativa no cartao.' },
        { status: 400 }
      );
    }

    // ===== Nivel (Pix eh sempre anual) =====
    const body = await request.json().catch(() => ({}));
    const nivel: NivelPagoPix = body.nivel === 'max' ? 'max' : 'premium';
    const valor = PRECOS_PIX[nivel];

    // ===== Cria a ordem pendente =====
    const { data: ordem, error: ordemError } = await supabase
      .from('pagamentos_pix')
      .insert({
        user_id: user.id,
        nivel,
        ciclo: 'anual',
        valor,
        status: 'pending',
      })
      .select('id')
      .single();

    if (ordemError || !ordem) {
      console.error('[pix-iniciar] erro criando ordem:', ordemError);
      return NextResponse.json({ erro: 'Erro ao iniciar pagamento' }, { status: 500 });
    }

    // ===== Cria a preference (so Pix) =====
    const pref = await criarPreferenciaPix({
      titulo: `Menta ${NOME_NIVEL_PIX[nivel]} - Anual (Pix)`,
      valor,
      payerEmail: user.email,
      externalReference: ordem.id, // liga o pagamento a esta ordem
      backUrl: `${APP_URL}/config?pix=ok`,
      notificationUrl: `${APP_URL}/api/mp/webhook`,
    });

    // ===== Guarda o preference id na ordem =====
    await supabase
      .from('pagamentos_pix')
      .update({ mp_preference_id: pref.id })
      .eq('id', ordem.id);

    return NextResponse.json({
      sucesso: true,
      init_point: pref.init_point,
      ordem_id: ordem.id,
    });
  } catch (e) {
    console.error('[pix-iniciar] erro:', e);
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : 'desconhecido' },
      { status: 500 }
    );
  }
}