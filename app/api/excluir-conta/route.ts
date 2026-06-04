import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
 
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
export async function POST(request: Request) {
  try {
    // 1) Confirma quem esta chamando
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
 
    if (!token) {
      return NextResponse.json({ erro: 'Sessao invalida ou expirada. Entre novamente.' }, { status: 401 });
    }
 
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ erro: 'Sessao invalida ou expirada. Entre novamente.' }, { status: 401 });
    }
 
    const userId = user.id;
 
    // 2) Apaga arquivos do storage 'faturas'
    const { data: faturasArquivos } = await supabase.storage.from('faturas').list(userId);
    if (faturasArquivos && faturasArquivos.length > 0) {
      const paths = faturasArquivos.map((f) => `${userId}/${f.name}`);
      await supabase.storage.from('faturas').remove(paths);
    }
 
    // 3) Apaga arquivos do storage 'avatares'
    const { data: avatarArquivos } = await supabase.storage.from('avatares').list(userId);
    if (avatarArquivos && avatarArquivos.length > 0) {
      const paths = avatarArquivos.map((f) => `${userId}/${f.name}`);
      await supabase.storage.from('avatares').remove(paths);
    }
 
    // 4) Apaga registros do banco (notificacoes, faturas, perfil)
    await supabase.from('notificacoes').delete().eq('user_id', userId);
    await supabase.from('faturas').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);
 
    // 5) Apaga o usuario do Auth (precisa do service role)
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      return NextResponse.json(
        { erro: 'Nao foi possivel excluir o usuario: ' + deleteUserError.message },
        { status: 500 }
      );
    }
 
    return NextResponse.json({ sucesso: true });
  } catch (erro) {
    return NextResponse.json(
      { erro: 'Erro ao excluir conta: ' + (erro instanceof Error ? erro.message : 'desconhecido') },
      { status: 500 }
    );
  }
}