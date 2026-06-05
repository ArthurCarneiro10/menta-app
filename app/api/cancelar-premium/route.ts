/**
 * Cancela o Premium do usuario atual.
 *
 * Comportamento (Caminho C com periodo de graca):
 *   - Marca plano = 'free' imediatamente
 *   - Marca cancelado_em = now()
 *   - Marca dados_apagar_em = now() + 30 dias
 *   - NAO apaga conexoes/contas/transacoes ainda (espera grace period)
 *   - Cria notificacao informativa
 *
 * Na Fase 7 essa rota vai ser chamada automaticamente pelo webhook
 * do Stripe/Mercado Pago quando a assinatura for cancelada. Por ora,
 * voce chama manualmente pra testar.
 */
 
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
 
const DIAS_GRACE = 30;
 
export async function POST(request: Request) {
  try {
    // ===== Auth =====
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ erro: 'Sessao invalida ou expirada.' }, { status: 401 });
    }
 
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ erro: 'Sessao invalida ou expirada.' }, { status: 401 });
    }
 
    // ===== Confere se realmente esta Premium =====
    const { data: perfil } = await supabase
      .from('profiles')
      .select('plano')
      .eq('id', user.id)
      .single();
 
    if (perfil?.plano !== 'premium') {
      return NextResponse.json(
        { erro: 'Voce nao esta no plano Premium.' },
        { status: 400 }
      );
    }
 
    // ===== Calcula datas =====
    const agora = new Date();
    const dataApagar = new Date(agora);
    dataApagar.setDate(dataApagar.getDate() + DIAS_GRACE);
 
    const agoraISO = agora.toISOString();
    const dataApagarISO = dataApagar.toISOString();
 
    // ===== Atualiza profile =====
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        plano: 'free',
        cancelado_em: agoraISO,
        dados_apagar_em: dataApagarISO,
      })
      .eq('id', user.id);
 
    if (updateError) {
      return NextResponse.json(
        { erro: 'Falha ao cancelar: ' + updateError.message },
        { status: 500 }
      );
    }
 
    // ===== Notifica usuario =====
    const dataLegivel = dataApagar.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
 
    await supabase.from('notificacoes').insert({
      user_id: user.id,
      tipo: 'premium_cancelado',
      titulo: 'Premium cancelado',
      mensagem: `Você cancelou o Premium. Suas conexões bancárias e transações ficam armazenadas por ${DIAS_GRACE} dias caso queira reativar. Após ${dataLegivel}, serão apagadas automaticamente.`,
    });
 
    return NextResponse.json({
      sucesso: true,
      canceladoEm: agoraISO,
      dadosApagarEm: dataApagarISO,
      diasGrace: DIAS_GRACE,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: 'Erro: ' + (e instanceof Error ? e.message : 'desconhecido') },
      { status: 500 }
    );
  }
}