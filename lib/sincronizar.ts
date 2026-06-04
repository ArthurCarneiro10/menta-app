/**
 * Logica compartilhada de sincronizacao Pluggy.
 *
 * Usada por:
 *   - /api/pluggy/sincronizar (chamada manual pelo usuario)
 *   - /api/pluggy/webhook (chamada automatica pela Pluggy)
 *
 * Trabalha "por conexao": busca contas, transacoes, categoriza e salva.
 */
 
import { createClient } from '@supabase/supabase-js';
import { getAccounts, getTransactions } from './pluggy';
import { categorizarLote } from './categorias-banco';
 
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
 
const DIAS_HISTORICO = 365;
 
export type Conexao = {
  id: string;
  user_id: string;
  pluggy_item_id: string;
  connector_name?: string | null;
};
 
export type BreakdownItem = {
  pluggyRaw: string | null;
  menta: string;
  descricaoExemplo: string;
  count: number;
};
 
export type ResultadoSync = {
  totalContas: number;
  totalTransacoes: number;
  erros: string[];
  breakdownCategorias: BreakdownItem[];
  periodo: { from: string; to: string };
};
 
/**
 * Sincroniza UMA conexao bancaria com a Pluggy.
 * Busca contas, transacoes, categoriza e salva.
 * Atualiza o status da conexao no fim.
 */
export async function sincronizarUmaConexao(conexao: Conexao): Promise<ResultadoSync> {
  const hoje = new Date();
  const inicio = new Date();
  inicio.setDate(hoje.getDate() - DIAS_HISTORICO);
 
  const dateFrom = inicio.toISOString().slice(0, 10);
  const dateToShow = hoje.toISOString().slice(0, 10);
 
  let totalContas = 0;
  let totalTransacoes = 0;
  const erros: string[] = [];
  const breakdownMap = new Map<string, BreakdownItem>();
 
  try {
    const accounts = await getAccounts(conexao.pluggy_item_id);
 
    for (const acc of accounts) {
      const { data: contaInserida, error: contaError } = await supabase
        .from('contas_bancarias')
        .upsert(
          {
            user_id: conexao.user_id,
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
 
      const transactions = await getTransactions(acc.id, dateFrom);
 
      if (transactions.length > 0) {
        const txsParaCategorizacao = transactions.map((t) => ({
          description: t.description,
          category: t.category,
        }));
 
        let categoriasMenta: string[];
        try {
          categoriasMenta = await categorizarLote(txsParaCategorizacao);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'desconhecido';
          erros.push(`Categorizacao na conta ${acc.name}: ${msg}`);
          categoriasMenta = transactions.map((t) => t.category || 'Outros');
        }
 
        transactions.forEach((t, idx) => {
          const pluggyRaw = t.category || null;
          const menta = categoriasMenta[idx] || 'Outros';
          const chave = `${pluggyRaw || 'NULL'} -> ${menta}`;
          const existing = breakdownMap.get(chave);
          if (existing) {
            existing.count++;
          } else {
            breakdownMap.set(chave, {
              pluggyRaw,
              menta,
              descricaoExemplo: (t.description || '').slice(0, 50),
              count: 1,
            });
          }
        });
 
        const rows = transactions.map((t, idx) => ({
          user_id: conexao.user_id,
          conta_id: contaInserida.id,
          pluggy_transaction_id: t.id,
          data: (t.date || '').slice(0, 10) || dateToShow,
          descricao: t.description || 'Sem descricao',
          valor: t.amount,
          tipo: t.type || null,
          categoria: categoriasMenta[idx] || 'Outros',
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
          }
        }
      }
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
 
  const breakdownCategorias = Array.from(breakdownMap.values()).sort((a, b) => b.count - a.count);
 
  return {
    totalContas,
    totalTransacoes,
    erros,
    breakdownCategorias,
    periodo: { from: dateFrom, to: dateToShow },
  };
}