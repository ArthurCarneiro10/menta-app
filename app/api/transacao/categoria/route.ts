import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
 
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
// 9 categorias canonicas da Menta. So aceitamos uma dessas como nova categoria.
const CATEGORIAS_VALIDAS = [
  'Alimentação', 'Transporte', 'Compras', 'Lazer', 'Saúde',
  'Educação', 'Moradia', 'Serviços', 'Outros',
];
 
export async function POST(request: Request) {
  try {
    // ===== SEGURANCA: 1) confirma quem esta chamando =====
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
 
    if (!token) {
      return NextResponse.json({ erro: 'Sessao invalida ou expirada. Entre novamente.' }, { status: 401 });
    }
 
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ erro: 'Sessao invalida ou expirada. Entre novamente.' }, { status: 401 });
    }
 
    // ===== Le o corpo =====
    const body = await request.json();
    const transacaoId = body.transacaoId;
    const novaCategoria = body.novaCategoria;
 
    if (!transacaoId) {
      return NextResponse.json({ erro: 'Transacao nao informada.' }, { status: 400 });
    }
    if (!novaCategoria || !CATEGORIAS_VALIDAS.includes(novaCategoria)) {
      return NextResponse.json({ erro: 'Categoria invalida.' }, { status: 400 });
    }
 
    // ===== SEGURANCA: 2) busca a transacao e confirma que e do usuario =====
    const { data: tx, error: txError } = await supabase
      .from('transacoes_banco')
      .select('id, user_id')
      .eq('id', transacaoId)
      .single();
 
    if (txError || !tx) {
      return NextResponse.json({ erro: 'Transacao nao encontrada.' }, { status: 404 });
    }
 
    if (tx.user_id !== user.id) {
      return NextResponse.json({ erro: 'Essa transacao nao pertence a sua conta.' }, { status: 403 });
    }
 
    // ===== Atualiza a categoria =====
    // Filtra tambem por user_id como cinto de seguranca extra (defense in depth).
    const { error: updError } = await supabase
      .from('transacoes_banco')
      .update({ categoria: novaCategoria })
      .eq('id', transacaoId)
      .eq('user_id', user.id);
 
    if (updError) {
      return NextResponse.json({ erro: 'Nao foi possivel atualizar: ' + updError.message }, { status: 500 });
    }
 
    return NextResponse.json({ sucesso: true, categoria: novaCategoria });
  } catch (erro) {
    return NextResponse.json(
      { erro: 'Erro ao atualizar categoria: ' + (erro instanceof Error ? erro.message : 'desconhecido') },
      { status: 500 }
    );
  }
}