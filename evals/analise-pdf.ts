/**
 * EVAL — Caminho PDF (analise de fatura).
 *
 * Roda analisarTextoFatura() contra textos de fatura sinteticos rotulados
 * e mede, por fatura e no geral:
 *  - COBERTURA DE EXTRACAO: das compras esperadas, quantas a IA encontrou
 *    (match por valor, tolerancia de 1 centavo)
 *  - ACURACIA DE CATEGORIA: das encontradas, quantas a categoria bateu
 *    (comparacao sem acento - veja a nota sobre acentos no fim)
 *  - EXTRAS: transacoes que a IA inventou (na saida, sem par esperado)
 *  - RUIDO: confere se a IA ignorou pagamentos/estornos como mandado
 *
 * COMO RODAR (na raiz do projeto):
 *   npx tsx --env-file=.env.local evals/analise-pdf.ts
 *
 * (Node 20.6+ pro --env-file. Gasta ~1 chamada de IA por fatura sintetica.)
 *
 * Os textos e rotulos abaixo sao PONTO DE PARTIDA - revise o que considera
 * "certo". Se tiver texto de faturas reais (anonimizadas), cole aqui que
 * o eval fica muito mais fiel.
 */
 
import { analisarTextoFatura } from '../lib/analise-fatura';
 
type Esperada = { valor: number; categoria: string };
type FaturaTeste = { nome: string; texto: string; esperadas: Esperada[] };
 
const FATURAS: FaturaTeste[] = [
  {
    nome: 'Fatura A (cartao roxo)',
    texto: `Fatura de Maio 2026
Pagamento recebido em 10/04 -1.200,00
05/05 IFOOD *IFOODSP 47,90
06/05 UBER *TRIP 19,80
08/05 DROGASIL FILIAL 33,50
12/05 AMAZON BR 89,90
15/05 POSTO IPIRANGA 200,00
20/05 NETFLIX.COM 39,90
Estorno compra 22/05 -15,00
Total da fatura: 416,00`,
    esperadas: [
      { valor: 47.90, categoria: 'Alimentacao' },
      { valor: 19.80, categoria: 'Transporte' },
      { valor: 33.50, categoria: 'Saude' },
      { valor: 89.90, categoria: 'Compras' },
      { valor: 200.00, categoria: 'Transporte' },
      { valor: 39.90, categoria: 'Lazer' },
    ],
  },
  {
    nome: 'Fatura B (banco tradicional)',
    texto: `Demonstrativo do cartao - vencimento 10/06/2026
SALDO ANTERIOR 0,00
02/05 SUPERMERCADO PAO DE ACUCAR 312,45
03/05 DROGARIA SP 28,00
09/05 99 TECNOLOGIA 16,30
11/05 SPOTIFY 21,90
18/05 C&A MODAS 159,90
25/05 SABESP 94,20
PAGAMENTO FATURA ANTERIOR -800,00
JUROS INFORMATIVO 0,00`,
    esperadas: [
      { valor: 312.45, categoria: 'Alimentacao' },
      { valor: 28.00, categoria: 'Saude' },
      { valor: 16.30, categoria: 'Transporte' },
      { valor: 21.90, categoria: 'Servicos' }, // AMBIGUO (Lazer vs Servicos)
      { valor: 159.90, categoria: 'Compras' },
      { valor: 94.20, categoria: 'Moradia' },
    ],
  },
  {
    nome: 'Fatura C (repeticoes)',
    texto: `Fatura cartao - Abril 2026
07/04 UBER *TRIP 14,50
09/04 UBER *TRIP 22,10
14/04 UBER *TRIP 18,75
10/04 IFOOD *IFOOD 55,00
16/04 IFOOD *IFOOD 41,20
21/04 FARMACIA PAGUE MENOS 67,30
28/04 CINEMARK 64,00
Total: 282,85`,
    esperadas: [
      { valor: 14.50, categoria: 'Transporte' },
      { valor: 22.10, categoria: 'Transporte' },
      { valor: 18.75, categoria: 'Transporte' },
      { valor: 55.00, categoria: 'Alimentacao' },
      { valor: 41.20, categoria: 'Alimentacao' },
      { valor: 67.30, categoria: 'Saude' },
      { valor: 64.00, categoria: 'Lazer' },
    ],
  },
  {
    nome: 'Fatura D (mista com servicos)',
    texto: `Resumo da fatura
01/05 ALUGUEL IMOBILIARIA LAR 1.450,00
05/05 ENEL SP 187,60
08/05 FACULDADE ANHANGUERA 499,00
13/05 LAVANDERIA LAVE BEM 45,00
19/05 MAGAZINE LUIZA 230,00
24/05 PADARIA DO ZE 19,90
Pagamento anterior -2.000,00`,
    esperadas: [
      { valor: 1450.00, categoria: 'Moradia' },
      { valor: 187.60, categoria: 'Moradia' },
      { valor: 499.00, categoria: 'Educacao' },
      { valor: 45.00, categoria: 'Servicos' },
      { valor: 230.00, categoria: 'Compras' },
      { valor: 19.90, categoria: 'Alimentacao' },
    ],
  },
];
 
// Remove acento e baixa pra comparar julgamento de categoria, nao grafia.
function normCat(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
 
function achaPorValor(transacoes: { valor: number; categoria: string }[], valor: number) {
  return transacoes.find((t) => Math.abs(t.valor - valor) < 0.01);
}
 
async function main() {
  console.log(`\n=== EVAL ANALISE PDF (caminho /api/analisar) ===\n`);
 
  let totEsperadas = 0;
  let totEncontradas = 0;
  let totCategoriaOk = 0;
  let totExtras = 0;
  let totSemAcento = 0;
 
  for (const fatura of FATURAS) {
    let analise;
    try {
      analise = await analisarTextoFatura(fatura.texto);
    } catch (e) {
      console.log(`[${fatura.nome}] FALHOU: ${e instanceof Error ? e.message : e}\n`);
      continue;
    }
 
    const obtidas = analise.transacoes.map((t) => ({ valor: t.valor, categoria: t.categoria }));
    const usadas = new Set<number>(); // indices ja casados, pra nao casar 2x o mesmo
 
    let encontradas = 0;
    let categoriaOk = 0;
    const detalhes: string[] = [];
 
    for (const esp of fatura.esperadas) {
      // acha um obtido com mesmo valor ainda nao usado
      const idx = obtidas.findIndex((t, i) => !usadas.has(i) && Math.abs(t.valor - esp.valor) < 0.01);
      if (idx === -1) {
        detalhes.push(`  FALTOU  R$ ${esp.valor.toFixed(2)} (esperava ${esp.categoria})`);
        continue;
      }
      usadas.add(idx);
      encontradas++;
      const obt = obtidas[idx];
      if (normCat(obt.categoria) === normCat(esp.categoria)) {
        categoriaOk++;
      } else {
        detalhes.push(`  CAT     R$ ${esp.valor.toFixed(2)}: esperava ${esp.categoria}, veio ${obt.categoria}`);
      }
    }
 
    // extras = obtidas que nao casaram com nenhuma esperada
    const extras = obtidas.filter((_, i) => !usadas.has(i));
 
    // conta categorias sem acento (sinaliza inconsistencia de grafia do caminho PDF)
    const semAcento = obtidas.filter((t) => /alimentacao|saude|servicos|educacao/i.test(t.categoria)).length;
 
    totEsperadas += fatura.esperadas.length;
    totEncontradas += encontradas;
    totCategoriaOk += categoriaOk;
    totExtras += extras.length;
    totSemAcento += semAcento;
 
    const pct = (a: number, t: number) => (t === 0 ? '-' : `${Math.round((a / t) * 100)}%`);
    console.log(`[${fatura.nome}]`);
    console.log(`  Extracao: ${encontradas}/${fatura.esperadas.length} (${pct(encontradas, fatura.esperadas.length)})  |  Categoria: ${categoriaOk}/${encontradas} (${pct(categoriaOk, encontradas)})  |  Extras: ${extras.length}`);
    if (detalhes.length > 0) detalhes.forEach((d) => console.log(d));
    if (extras.length > 0) {
      extras.forEach((e) => console.log(`  EXTRA   R$ ${e.valor.toFixed(2)} (${e.categoria}) - IA inventou ou nao estava no gabarito`));
    }
    console.log('');
  }
 
  const pct = (a: number, t: number) => (t === 0 ? '-' : `${Math.round((a / t) * 100)}%`);
  console.log(`=== GERAL ===`);
  console.log(`Cobertura de extracao: ${totEncontradas}/${totEsperadas} (${pct(totEncontradas, totEsperadas)})`);
  console.log(`Acuracia de categoria: ${totCategoriaOk}/${totEncontradas} (${pct(totCategoriaOk, totEncontradas)})`);
  console.log(`Transacoes extras (ruido nao ignorado / invencao): ${totExtras}`);
  if (totSemAcento > 0) {
    console.log(`\nNOTA: ${totSemAcento} categoria(s) vieram SEM acento (ex: "Alimentacao").`);
    console.log(`O caminho PDF nao normaliza acento como o caminho Pluggy faz - isso`);
    console.log(`gera divergencia de grafia no banco. Candidato a correcao na Wave C.`);
  }
  console.log('');
}
 
main().catch((e) => {
  console.error('Eval falhou:', e);
  process.exit(1);
});