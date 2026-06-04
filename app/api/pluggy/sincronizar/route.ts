import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sincronizarUmaConexao, BreakdownItem } from '@/lib/sincronizar';
 
export const maxDuration = 60;
 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
 
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ erro: 'Sessao invalida ou expirada.' }, { status: 401 });
    }
 
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ erro: 'Sessao invalida ou expirada.' }, { status: 401 });
    }
 
    const { data: perfil } = await supabase
      .from('profiles')
      .select('plano')
      .eq('id', user.id)
      .single();
 
    if (perfil?.plano !== 'premium') {
      return NextResponse.json(
        { erro: 'Open Finance esta disponivel apenas para contas Premium.' },
        { status: 403 }
      );
    }
 
    const body = await request.json().catch(() => ({}));
    const itemIdFiltro: string | undefined = body?.itemId;
 
    let query = supabase.from('connections').select('*').eq('user_id', user.id);
    if (itemIdFiltro) query = query.eq('pluggy_item_id', itemIdFiltro);
 
    const { data: conexoes, error: conexoesError } = await query;
 
    if (conexoesError) {
      return NextResponse.json(
        { erro: 'Erro ao buscar conexoes: ' + conexoesError.message },
        { status: 500 }
      );
    }
 
    if (!conexoes || conexoes.length === 0) {
      return NextResponse.json(
        { erro: 'Nenhuma conexao bancaria encontrada. Conecte uma conta primeiro.' },
        { status: 404 }
      );
    }
 
    let totalContas = 0;
    let totalTransacoes = 0;
    const todosErros: string[] = [];
    const breakdownMap = new Map<string, BreakdownItem>();
    let periodoFinal = { from: '', to: '' };
 
    for (const conexao of conexoes) {
      const resultado = await sincronizarUmaConexao(conexao);
      totalContas += resultado.totalContas;
      totalTransacoes += resultado.totalTransacoes;
      todosErros.push(...resultado.erros);
      periodoFinal = resultado.periodo;
 
      // Agrega breakdowns
      for (const item of resultado.breakdownCategorias) {
        const chave = `${item.pluggyRaw || 'NULL'} -> ${item.menta}`;
        const existing = breakdownMap.get(chave);
        if (existing) {
          existing.count += item.count;
        } else {
          breakdownMap.set(chave, { ...item });
        }
      }
    }
 
    const breakdownCategorias = Array.from(breakdownMap.values()).sort((a, b) => b.count - a.count);
 
    return NextResponse.json({
      sucesso: true,
      totalContas,
      totalTransacoes,
      periodo: periodoFinal,
      breakdownCategorias,
      erros: todosErros.length > 0 ? todosErros : undefined,
    });
  } catch (erro) {
    return NextResponse.json(
      { erro: 'Erro: ' + (erro instanceof Error ? erro.message : 'desconhecido') },
      { status: 500 }
    );
  }
}