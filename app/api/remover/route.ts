import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
 
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
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
    const faturaId = body.faturaId;
 
    if (!faturaId) {
      return NextResponse.json({ erro: 'Fatura nao informada.' }, { status: 400 });
    }
 
    // ===== SEGURANCA: 2) busca a fatura e confirma que e do usuario =====
    const { data: fatura, error: faturaError } = await supabase
      .from('faturas')
      .select('id, user_id, arquivo_path')
      .eq('id', faturaId)
      .single();
 
    if (faturaError || !fatura) {
      return NextResponse.json({ erro: 'Fatura nao encontrada.' }, { status: 404 });
    }
 
    if (fatura.user_id !== user.id) {
      return NextResponse.json({ erro: 'Essa fatura nao pertence a sua conta.' }, { status: 403 });
    }
 
    // ===== Apaga o PDF do storage (se existir) =====
    if (fatura.arquivo_path) {
      await supabase.storage.from('faturas').remove([fatura.arquivo_path]);
    }
 
    // ===== Apaga o registro do banco =====
    const { error: delError } = await supabase
      .from('faturas')
      .delete()
      .eq('id', faturaId);
 
    if (delError) {
      return NextResponse.json({ erro: 'Nao foi possivel remover: ' + delError.message }, { status: 500 });
    }
 
    return NextResponse.json({ sucesso: true });
  } catch (erro) {
    return NextResponse.json(
      { erro: 'Erro ao remover: ' + (erro instanceof Error ? erro.message : 'desconhecido') },
      { status: 500 }
    );
  }
}