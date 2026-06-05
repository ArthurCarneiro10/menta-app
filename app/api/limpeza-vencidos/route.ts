/**
 * Limpa dados de usuarios cujo grace period venceu.
 *
 * Para cada profile com dados_apagar_em < now():
 *   1. Lista conexoes Pluggy do usuario
 *   2. Pra cada uma, chama Pluggy DELETE /items/{itemId} (best-effort)
 *   3. Apaga connections do DB (CASCADE limpa contas_bancarias e transacoes_banco)
 *   4. Zera cancelado_em e dados_apagar_em no profile
 *
 * Seguranca: protegida por LIMPEZA_SECRET (env var). Sem ela, nao roda.
 * Designed pra ser chamada por cron no futuro. Por ora, chamada manual.
 */
 
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteItem } from '@/lib/pluggy';
 
export const maxDuration = 60;
 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
 
const LIMPEZA_SECRET = process.env.LIMPEZA_SECRET || '';
 
export async function POST(request: Request) {
  try {
    // ===== Auth via secret =====
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
 
    if (!LIMPEZA_SECRET) {
      console.error('[limpeza] LIMPEZA_SECRET nao configurado no servidor');
      return NextResponse.json(
        { erro: 'Rota nao configurada' },
        { status: 500 }
      );
    }
 
    if (token !== LIMPEZA_SECRET) {
      return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
    }
 
    // ===== Busca usuarios vencidos =====
    const agora = new Date().toISOString();
    const { data: profilesVencidos, error: profError } = await supabase
      .from('profiles')
      .select('id')
      .lt('dados_apagar_em', agora)
      .not('dados_apagar_em', 'is', null);
 
    if (profError) {
      return NextResponse.json(
        { erro: 'Erro ao buscar profiles: ' + profError.message },
        { status: 500 }
      );
    }
 
    if (!profilesVencidos || profilesVencidos.length === 0) {
      return NextResponse.json({
        sucesso: true,
        usuariosLimpos: 0,
        mensagem: 'Nenhum usuario com grace period vencido.',
      });
    }
 
    let totalLimpos = 0;
    let totalConexoesPluggy = 0;
    let totalFalhasPluggy = 0;
    const erros: string[] = [];
 
    for (const profile of profilesVencidos) {
      try {
        // 1) Busca conexoes Pluggy do usuario
        const { data: conexoes } = await supabase
          .from('connections')
          .select('id, pluggy_item_id, connector_name')
          .eq('user_id', profile.id);
 
        // 2) Tenta apagar cada uma na Pluggy (best-effort, nao bloqueia se falhar)
        for (const conn of conexoes || []) {
          try {
            await deleteItem(conn.pluggy_item_id);
            totalConexoesPluggy++;
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'desconhecido';
            console.warn(
              `[limpeza] Falha Pluggy DELETE item=${conn.pluggy_item_id} user=${profile.id}:`,
              msg
            );
            totalFalhasPluggy++;
            // Continua. Apaga local mesmo se Pluggy falhar.
          }
        }
 
        // 3) Apaga conexoes locais (CASCADE limpa contas + transacoes)
        const { error: delError } = await supabase
          .from('connections')
          .delete()
          .eq('user_id', profile.id);
 
        if (delError) {
          erros.push(`user=${profile.id}: delete connections falhou: ${delError.message}`);
          continue;
        }
 
        // 4) Zera flags do profile
        const { error: clearError } = await supabase
          .from('profiles')
          .update({
            cancelado_em: null,
            dados_apagar_em: null,
          })
          .eq('id', profile.id);
 
        if (clearError) {
          erros.push(`user=${profile.id}: clear flags falhou: ${clearError.message}`);
          continue;
        }
 
        totalLimpos++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'desconhecido';
        erros.push(`user=${profile.id}: ${msg}`);
      }
    }
 
    console.log(
      `[limpeza] OK: usuarios=${totalLimpos} pluggyDeletes=${totalConexoesPluggy} pluggyFalhas=${totalFalhasPluggy} erros=${erros.length}`
    );
 
    return NextResponse.json({
      sucesso: true,
      usuariosLimpos: totalLimpos,
      conexoesApagadasNoPluggy: totalConexoesPluggy,
      falhasNoPluggy: totalFalhasPluggy,
      erros: erros.length > 0 ? erros : undefined,
    });
  } catch (e) {
    console.error('[limpeza] Erro:', e);
    return NextResponse.json(
      { erro: 'Erro: ' + (e instanceof Error ? e.message : 'desconhecido') },
      { status: 500 }
    );
  }
}
 
// GET: status pra ver se a rota ta viva e configurada
export async function GET() {
  return NextResponse.json({
    status: 'limpeza endpoint ativo',
    configurado: !!LIMPEZA_SECRET,
  });
}