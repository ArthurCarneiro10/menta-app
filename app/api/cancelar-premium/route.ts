/**
 * Cancela o Premium do usuario.
 *
 * Fluxo Caminho C (grace period de 30 dias):
 *   1. Autentica usuario
 *   2. Cancela a preapproval ativa no MP (best-effort)
 *   3. Marca cancelamento no profile (cancelado_em + dados_apagar_em)
 *   4. Cria notificacao informativa
 *   5. /api/limpeza-vencidos vai limpar tudo apos 30 dias
 *
 * Dados bancarios (connections, contas, transacoes) ficam preservados
 * durante o grace period - se o usuario reativar antes, nao perde nada.
 *
 * IMPORTANTE: esta rota chama tanto a logica local (lib/premium.ts) quanto
 * o MP. Se o webhook do MP chegar primeiro (ex: o usuario cancelou pelo
 * proprio MP), a lib/premium.ts ja vai ter marcado - eh idempotente.
 */
 
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { marcarCancelamentoPremium, DIAS_GRACE } from '@/lib/premium';
import { cancelarPreapproval } from '@/lib/mercadopago';
 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
 
export async function POST(request: Request) {
  try {
    // ===== Auth =====
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json(
        { erro: 'Sessao invalida ou expirada.' },
        { status: 401 }
      );
    }
 
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { erro: 'Sessao invalida ou expirada.' },
        { status: 401 }
      );
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
 
    // ===== Cancela no MP (best-effort) =====
    // Busca a assinatura ativa mais recente do usuario
    const { data: assinaturaAtiva } = await supabase
      .from('assinaturas')
      .select('mp_preapproval_id')
      .eq('user_id', user.id)
      .eq('status', 'authorized')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
 
    if (assinaturaAtiva?.mp_preapproval_id) {
      try {
        await cancelarPreapproval(assinaturaAtiva.mp_preapproval_id);
        console.log(
          `[cancelar-premium] preapproval ${assinaturaAtiva.mp_preapproval_id} cancelada no MP`
        );
      } catch (e) {
        // MP pode falhar (preapproval ja cancelada, rede caiu, etc).
        // Nao bloqueia - o estado local eh a fonte de verdade pro usuario.
        const msg = e instanceof Error ? e.message : 'desconhecido';
        console.warn(`[cancelar-premium] falha cancelando no MP:`, msg);
      }
    } else {
      console.log(
        `[cancelar-premium] user ${user.id} sem assinatura ativa no DB (ok)`
      );
    }
 
    // ===== Aplica grace period local =====
    const { dataApagarISO } = await marcarCancelamentoPremium(
      user.id,
      supabase
    );
 
    return NextResponse.json({
      sucesso: true,
      canceladoEm: new Date().toISOString(),
      dadosApagarEm: dataApagarISO,
      diasGrace: DIAS_GRACE,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : 'desconhecido' },
      { status: 500 }
    );
  }
}