/**
 * CORRECAO RETROATIVA — normaliza categorias das faturas ja analisadas.
 *
 * O caminho PDF antigo gravava categorias sem acento ("Alimentacao").
 * Este script percorre as faturas analisadas e regrava as categorias nas
 * 9 canonicas (com acento), tanto em `categorias` quanto em `transacoes`,
 * usando a MESMA funcao que a rota usa agora (normalizarCategoria).
 *
 * COMO RODAR (na raiz do projeto):
 *   1) PRIMEIRO em modo simulacao (nao grava nada):
 *        npx tsx --env-file=.env.local scripts/corrigir-acentos.ts --dry
 *   2) Conferiu? Aplica de verdade:
 *        npx tsx --env-file=.env.local scripts/corrigir-acentos.ts
 *
 * Idempotente: rodar de novo depois de aplicado nao muda mais nada.
 */
 
import { createClient } from '@supabase/supabase-js';
import { normalizarCategoria } from '../lib/analise-fatura';
 
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
 
if (!url || !serviceKey) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}
 
const supabase = createClient(url, serviceKey);
 
const DRY = process.argv.includes('--dry');
 
type Categoria = { nome: string; valor: number };
type Transacao = { descricao: string; valor: number; categoria: string };
 
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
 
// Re-agrupa categorias por nome normalizado, somando valores (funde duplicatas).
function normalizaCategorias(cats: Categoria[]): Categoria[] {
  const mapa = new Map<string, number>();
  for (const c of cats) {
    const nome = normalizarCategoria(c?.nome);
    const valor = typeof c?.valor === 'number' ? c.valor : 0;
    mapa.set(nome, (mapa.get(nome) || 0) + valor);
  }
  return Array.from(mapa.entries())
    .map(([nome, valor]) => ({ nome, valor: round2(valor) }))
    .sort((a, b) => b.valor - a.valor);
}
 
function normalizaTransacoes(txs: Transacao[]): Transacao[] {
  return txs.map((t) => ({
    descricao: t?.descricao ?? '',
    valor: typeof t?.valor === 'number' ? t.valor : 0,
    categoria: normalizarCategoria(t?.categoria),
  }));
}
 
async function main() {
  console.log(`\n=== CORRECAO DE ACENTOS ${DRY ? '(SIMULACAO --dry)' : '(APLICANDO)'} ===\n`);
 
  const { data: faturas, error } = await supabase
    .from('faturas')
    .select('id, categorias, transacoes')
    .not('analisado_em', 'is', null);
 
  if (error) {
    console.error('Erro buscando faturas:', error);
    process.exit(1);
  }
  if (!faturas || faturas.length === 0) {
    console.log('Nenhuma fatura analisada encontrada.');
    return;
  }
 
  let verificadas = 0;
  let corrigidas = 0;
 
  for (const f of faturas) {
    verificadas++;
 
    const catsOriginais = Array.isArray(f.categorias) ? (f.categorias as Categoria[]) : [];
    const txsOriginais = Array.isArray(f.transacoes) ? (f.transacoes as Transacao[]) : [];
 
    const catsNovas = normalizaCategorias(catsOriginais);
    const txsNovas = normalizaTransacoes(txsOriginais);
 
    const mudou =
      JSON.stringify(catsOriginais) !== JSON.stringify(catsNovas) ||
      JSON.stringify(txsOriginais) !== JSON.stringify(txsNovas);
 
    if (!mudou) continue;
 
    corrigidas++;
    console.log(`Fatura ${f.id}: precisa corrigir`);
 
    if (!DRY) {
      const { error: updErr } = await supabase
        .from('faturas')
        .update({ categorias: catsNovas, transacoes: txsNovas })
        .eq('id', f.id);
      if (updErr) {
        console.error(`  -> erro ao gravar:`, updErr);
      } else {
        console.log(`  -> corrigida`);
      }
    }
  }
 
  console.log(`\nResumo: ${verificadas} verificada(s), ${corrigidas} ${DRY ? 'a corrigir' : 'corrigida(s)'}.`);
  if (DRY && corrigidas > 0) {
    console.log('Rode sem --dry pra aplicar.');
  }
  console.log('');
}
 
main().catch((e) => {
  console.error('Script falhou:', e);
  process.exit(1);
});