/**
 * Desconecta uma conexao bancaria.
 *
 * 1. Verifica que o usuario e dono da conexao
 * 2. Tenta apagar o item na Pluggy (best-effort: nao falha tudo se Pluggy falhar)
 * 3. Apaga a conexao no nosso DB (cascade limpa contas_bancarias + transacoes_banco)
 */
 
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteItem } from '@/lib/pluggy';
 
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
      return NextResponse.json({ erro: 'Sessao invalida ou expirada.' }, { status: 401 });
    }
 
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ erro: 'Sessao invalida ou expirada.' }, { status: 401 });
    }
 
    // ===== Body =====
    const body = await request.json().catch(() => ({}));
    const connectionId = body?.connectionId;
    if (!connectionId) {
      return NextResponse.json(
        { erro: 'connectionId obrigatorio' },
        { status: 400 }
      );
    }
 
    // ===== Confirma posse =====
    const { data: conexao, error: connError } = await supabase
      .from('connections')
      .select('id, pluggy_item_id, user_id, connector_name')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .single();
 
    if (connError || !conexao) {
      return NextResponse.json(
        { erro: 'Conexao nao encontrada ou nao pertence a voce.' },
        { status: 404 }
      );
    }
 
    // ===== Apaga na Pluggy (best-effort) =====
    let pluggyOk = true;
    let pluggyErro: string | null = null;
    try {
      await deleteItem(conexao.pluggy_item_id);
    } catch (e) {
      pluggyOk = false;
      pluggyErro = e instanceof Error ? e.message : 'desconhecido';
      console.warn('[desconectar] Falha ao deletar item Pluggy:', pluggyErro);
      // Continua mesmo assim: vamos limpar o lado nosso
    }
 
    // ===== Apaga local (CASCADE remove contas e transacoes) =====
    const { error: deleteError } = await supabase
      .from('connections')
      .delete()
      .eq('id', connectionId)
      .eq('user_id', user.id);
 
    if (deleteError) {
      return NextResponse.json(
        { erro: 'Falha ao remover conexao local: ' + deleteError.message },
        { status: 500 }
      );
    }
 
    return NextResponse.json({
      sucesso: true,
      conector: conexao.connector_name,
      pluggyOk,
      pluggyErro,
    });
  } catch (e) {
    return NextResponse.json(
      { erro: 'Erro: ' + (e instanceof Error ? e.message : 'desconhecido') },
      { status: 500 }
    );
  }
}