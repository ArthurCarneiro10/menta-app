/**
 * EVAL — Motor de categorizacao (caminho Pluggy).
 *
 * Roda categorizarLote() contra um dataset rotulado a mao e mede:
 *  - acuracia global
 *  - acuracia por categoria esperada
 *  - acuracia separada por camada (regra gratis vs IA Haiku)
 *  - lista de erros (pra inspecionar onde o julgamento falha)
 *
 * COMO RODAR (na raiz do projeto):
 *   npx tsx --env-file=.env.local evals/categorizacao.ts
 *
 * (precisa de Node 20.6+ pro --env-file; se o seu for mais antigo, me avise.
 *  Gasta alguns centavos de IA por rodada, so nas transacoes que caem na camada IA.)
 *
 * O dataset abaixo eh um PONTO DE PARTIDA. Revise os rotulos `esperado`:
 * o "certo" eh decisao de negocio sua. Casos marcados com // AMBIGUO sao
 * de propria escolha duvidosa - bons pra calibrar sua regua.
 */
 
import { categorizarLote, categorizarPorRegra, type CategoriaMenta } from '../lib/categorias-banco';
 
type Caso = {
  descricao: string;
  categoriaPluggy: string | null;
  esperado: CategoriaMenta;
};
 
const DATASET: Caso[] = [
  // ===== Casos que caem na REGRA (categoria Pluggy mapeavel) =====
  { descricao: 'Padaria Pao Quente', categoriaPluggy: 'Food and drink', esperado: 'Alimentação' },
  { descricao: 'Posto Shell', categoriaPluggy: 'Gas stations', esperado: 'Transporte' },
  { descricao: 'Renner', categoriaPluggy: 'Shopping', esperado: 'Compras' },
  { descricao: 'Netflix', categoriaPluggy: 'Streaming', esperado: 'Lazer' },
  { descricao: 'Drogasil', categoriaPluggy: 'Pharmacy', esperado: 'Saúde' },
  { descricao: 'Curso Udemy', categoriaPluggy: 'Education', esperado: 'Educação' },
  { descricao: 'Conta de luz', categoriaPluggy: 'Utilities', esperado: 'Moradia' },
  { descricao: 'Spotify', categoriaPluggy: 'Subscription', esperado: 'Serviços' }, // AMBIGUO (Lazer vs Servicos)
  { descricao: 'PIX recebido', categoriaPluggy: 'Transfer', esperado: 'Outros' },
  { descricao: 'Uber viagem', categoriaPluggy: 'Uber', esperado: 'Transporte' },
  { descricao: 'iFood pedido', categoriaPluggy: 'Delivery', esperado: 'Alimentação' },
  { descricao: 'Academia SmartFit', categoriaPluggy: 'Gym', esperado: 'Saúde' },
  { descricao: 'Aluguel apto', categoriaPluggy: 'Rent', esperado: 'Moradia' },
  { descricao: 'Cinema', categoriaPluggy: 'Movies', esperado: 'Lazer' },
  { descricao: 'Mercado Extra', categoriaPluggy: 'Groceries', esperado: 'Alimentação' },
 
  // ===== Casos que caem na IA (categoria vazia/desconhecida, so descricao) =====
  { descricao: 'IFD*IFOOD', categoriaPluggy: null, esperado: 'Alimentação' },
  { descricao: '99*99APP SAO PAULO', categoriaPluggy: null, esperado: 'Transporte' },
  { descricao: 'AMAZON BR', categoriaPluggy: '', esperado: 'Compras' },
  { descricao: 'PG *MERCADOLIVRE', categoriaPluggy: null, esperado: 'Compras' },
  { descricao: 'DROGARIA SAO PAULO', categoriaPluggy: null, esperado: 'Saúde' },
  { descricao: 'POSTO IPIRANGA AV PAULISTA', categoriaPluggy: null, esperado: 'Transporte' },
  { descricao: 'PADARIA DOCE PAO', categoriaPluggy: null, esperado: 'Alimentação' },
  { descricao: 'ENEL DISTRIBUICAO SP', categoriaPluggy: null, esperado: 'Moradia' },
  { descricao: 'VIVO FIXO INTERNET', categoriaPluggy: null, esperado: 'Moradia' },
  { descricao: 'PIX ENVIADO JOAO SILVA', categoriaPluggy: null, esperado: 'Outros' },
  { descricao: 'TED RECEBIDA', categoriaPluggy: null, esperado: 'Outros' },
  { descricao: 'PARCELA EMPRESTIMO', categoriaPluggy: null, esperado: 'Outros' }, // AMBIGUO
  { descricao: 'C&A MODAS', categoriaPluggy: null, esperado: 'Compras' },
  { descricao: 'CINEMARK SHOPPING IBIRAPUERA', categoriaPluggy: null, esperado: 'Lazer' },
  { descricao: 'DR CARLOS ODONTOLOGIA', categoriaPluggy: null, esperado: 'Saúde' },
  { descricao: 'FACULDADE ANHANGUERA MENSALIDADE', categoriaPluggy: null, esperado: 'Educação' },
  { descricao: 'PETZ PET SHOP', categoriaPluggy: null, esperado: 'Compras' }, // AMBIGUO (Compras vs Servicos)
  { descricao: 'LAVANDERIA LAVE BEM', categoriaPluggy: null, esperado: 'Serviços' },
  { descricao: 'BARBEARIA CORTE FINO', categoriaPluggy: null, esperado: 'Serviços' }, // AMBIGUO (Servicos vs Saude)
  { descricao: 'SUPERMERCADO PAO DE ACUCAR', categoriaPluggy: null, esperado: 'Alimentação' },
  { descricao: 'SHELL BOX COMBUSTIVEL', categoriaPluggy: null, esperado: 'Transporte' },
  { descricao: 'MAGAZINE LUIZA', categoriaPluggy: null, esperado: 'Compras' },
  { descricao: 'HOSPITAL SAO LUIZ', categoriaPluggy: null, esperado: 'Saúde' },
  { descricao: 'ESCOLA INFANTIL PEQUENO PRINCIPE', categoriaPluggy: null, esperado: 'Educação' },
  { descricao: 'SABESP AGUA E ESGOTO', categoriaPluggy: null, esperado: 'Moradia' },
];
 
async function main() {
  console.log(`\n=== EVAL CATEGORIZACAO (motor categorizarLote) ===`);
  console.log(`Total de casos: ${DATASET.length}\n`);
 
  const entrada = DATASET.map((c) => ({ description: c.descricao, category: c.categoriaPluggy }));
  const obtidos = await categorizarLote(entrada);
 
  let acertos = 0;
  const porCategoria = new Map<string, { acertos: number; total: number }>();
  const porCamada = { regra: { acertos: 0, total: 0 }, ia: { acertos: 0, total: 0 } };
  const erros: { descricao: string; pluggy: string; esperado: string; obtido: string; camada: string }[] = [];
 
  DATASET.forEach((caso, i) => {
    const obtido = obtidos[i];
    const ok = obtido === caso.esperado;
    const camada = categorizarPorRegra(caso.categoriaPluggy) !== null ? 'regra' : 'ia';
 
    if (ok) acertos++;
 
    const pc = porCategoria.get(caso.esperado) || { acertos: 0, total: 0 };
    pc.total++;
    if (ok) pc.acertos++;
    porCategoria.set(caso.esperado, pc);
 
    porCamada[camada].total++;
    if (ok) porCamada[camada].acertos++;
 
    if (!ok) {
      erros.push({
        descricao: caso.descricao,
        pluggy: caso.categoriaPluggy ?? '(vazio)',
        esperado: caso.esperado,
        obtido,
        camada,
      });
    }
  });
 
  const pct = (a: number, t: number) => (t === 0 ? '-' : `${Math.round((a / t) * 100)}%`);
 
  console.log(`ACURACIA GLOBAL: ${acertos}/${DATASET.length} (${pct(acertos, DATASET.length)})\n`);
 
  console.log(`Por camada:`);
  console.log(`  Regra: ${porCamada.regra.acertos}/${porCamada.regra.total} (${pct(porCamada.regra.acertos, porCamada.regra.total)})`);
  console.log(`  IA:    ${porCamada.ia.acertos}/${porCamada.ia.total} (${pct(porCamada.ia.acertos, porCamada.ia.total)})\n`);
 
  console.log(`Por categoria esperada:`);
  for (const [cat, v] of porCategoria) {
    console.log(`  ${cat.padEnd(14)} ${v.acertos}/${v.total} (${pct(v.acertos, v.total)})`);
  }
 
  if (erros.length > 0) {
    console.log(`\nERROS (${erros.length}):`);
    for (const e of erros) {
      console.log(`  [${e.camada}] "${e.descricao}" (pluggy: ${e.pluggy})`);
      console.log(`        esperado: ${e.esperado}  |  obtido: ${e.obtido}`);
    }
  } else {
    console.log(`\nSem erros. (Confira se os casos AMBIGUO refletem mesmo sua regra.)`);
  }
 
  console.log('');
}
 
main().catch((e) => {
  console.error('Eval falhou:', e);
  process.exit(1);
});