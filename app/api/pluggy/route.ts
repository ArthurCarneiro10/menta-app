import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAccounts, getTransactions } from '@/lib/pluggy';
 
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
// AJUSTE: 365 dias para sandbox (dados de teste tem datas espalhadas)
// Em producao com bancos reais, podemos voltar para 90.
const DIAS_HISTORICO = 365;
 
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
 
    const hoje = new Date();
    const inicio = new Date();
    inicio.setDate(hoje.getDate() - DIAS_HISTORICO);
 
    const fromDate = inicio.toISOString().slice(0, 10);
    const toDate = hoje.toISOString().slice(0, 10);
 
    let totalContas = 0;
    let totalTransacoes = 0;
    const erros: string[] = [];
    // Debug: rastreia quantas transacoes a Pluggy retornou por conta
    const debugPorConta: { conta: string; tipo: string | null; retornado: number; salvo: number }[] = [];
 
    for (const conexao of conexoes) {
      try {
        const accounts = await getAccounts(conexao.pluggy_item_id);
 
        for (const acc of accounts) {
          const { data: contaInserida, error: contaError } = await supabase
            .from('contas_bancarias')
            .upsert(
              {
                user_id: user.id,
                connection_id: conexao.id,
                pluggy_account_id: acc.id,
                tipo: acc.type || null,
                subtipo: acc.subtype || null,
                nome: acc.name || 'Conta',
                numero: acc.number || null,
                moeda: acc.currencyCode || 'BRL',
                saldo: acc.balance ?? null,
                limite: acc.creditData?.creditLimit ?? null,
                atualizado_em: new Date().toISOString(),
              },
              { onConflict: 'pluggy_account_id' }
            )
            .select()
            .single();
 
          if (contaError || !contaInserida) {
            erros.push(`Conta ${acc.id}: ${contaError?.message || 'falhou'}`);
            continue;
          }
          totalContas++;
 
          const transactions = await getTransactions(acc.id, fromDate, toDate);
          let salvoNessaConta = 0;
 
          if (transactions.length > 0) {
            const rows = transactions.map((t) => ({
              user_id: user.id,
              conta_id: contaInserida.id,
              pluggy_transaction_id: t.id,
              data: (t.date || '').slice(0, 10) || toDate,
              descricao: t.description || 'Sem descricao',
              valor: t.amount,
              tipo: t.type || null,
              categoria: t.category || null,
              merchant_nome: t.merchant?.name || null,
              moeda: t.currencyCode || 'BRL',
            }));
 
            for (let i = 0; i < rows.length; i += 100) {
              const lote = rows.slice(i, i + 100);
              const { error: txError } = await supabase
                .from('transacoes_banco')
                .upsert(lote, { onConflict: 'pluggy_transaction_id' });
 
              if (txError) {
                erros.push(`Lote tx (${lote.length} itens) na conta ${acc.name}: ${txError.message}`);
              } else {
                totalTransacoes += lote.length;
                salvoNessaConta += lote.length;
              }
            }
          }
 
          debugPorConta.push({
            conta: acc.name || acc.id,
            tipo: acc.type || null,
            retornado: transactions.length,
            salvo: salvoNessaConta,
          });
        }
 
        await supabase
          .from('connections')
          .update({
            last_updated_at: new Date().toISOString(),
            status: 'UPDATED',
            erro: null,
          })
          .eq('id', conexao.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'desconhecido';
        erros.push(`Conexao ${conexao.connector_name || conexao.id}: ${msg}`);
 
        await supabase
          .from('connections')
          .update({ status: 'ERROR', erro: msg.slice(0, 500) })
          .eq('id', conexao.id);
      }
    }
 
    return NextResponse.json({
      sucesso: true,
      totalContas,
      totalTransacoes,
      periodo: { from: fromDate, to: toDate },
      debugPorConta,
      erros: erros.length > 0 ? erros : undefined,
    });
  } catch (erro) {
    return NextResponse.json(
      { erro: 'Erro: ' + (erro instanceof Error ? erro.message : 'desconhecido') },
      { status: 500 }
    );
  }
}