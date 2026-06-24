/**
 * Analise de fatura: texto -> JSON estruturado.
 *
 * Esta funcao foi extraida de /api/analisar pra ser testavel isoladamente
 * (eval) e pra centralizar o prompt num lugar so. A rota cuida de auth,
 * limite, download e pdf-parse; aqui entra o TEXTO ja extraido e sai a
 * analise reconciliada.
 *
 * Lanca Error com mensagem amigavel em caso de falha de IA ou JSON invalido
 * (a rota mapeia pra HTTP). O conteudo cru da IA eh logado no servidor pra
 * debug, mas NAO retornado ao cliente.
 */
 
// ===== MODELO DE IA =====
const MODELO_IA = 'anthropic/claude-haiku-4.5';
// =========================
 
// Teto de caracteres do texto da fatura enviado pra IA. O Haiku aguenta bem
// mais contexto que os 8000 antigos; 16000 cobre faturas longas sem cortar.
// Se exceder, sinalizamos via flag truncado (a UI avisa o usuario).
const LIMITE_TEXTO = 16000;
 
export type Transacao = { descricao: string; valor: number; categoria: string };
export type Categoria = { nome: string; valor: number };
export type AnaliseFatura = {
  total: number;
  categorias: Categoria[];
  transacoes: Transacao[];
  insight: string;
  truncado: boolean;
};
 
// As 9 categorias canonicas da Menta (com acento). Fonte unica da grafia.
const CANONICAS = [
  'Alimentação',
  'Transporte',
  'Compras',
  'Lazer',
  'Saúde',
  'Educação',
  'Moradia',
  'Serviços',
  'Outros',
] as const;
 
// Mapa de qualquer grafia (com ou sem acento, minuscula) -> canonica.
// A IA do PDF costuma responder sem acento ("Alimentacao"); aqui alinhamos
// com o caminho Pluggy pra nao haver divergencia de grafia no banco.
const NORMALIZADAS: Record<string, string> = {
  'alimentacao': 'Alimentação',
  'alimentação': 'Alimentação',
  'transporte': 'Transporte',
  'compras': 'Compras',
  'lazer': 'Lazer',
  'saude': 'Saúde',
  'saúde': 'Saúde',
  'educacao': 'Educação',
  'educação': 'Educação',
  'moradia': 'Moradia',
  'servicos': 'Serviços',
  'serviços': 'Serviços',
  'outros': 'Outros',
};
 
/**
 * Normaliza uma categoria vinda da IA pra uma das 9 canonicas (com acento).
 * Exportada pra ser reusada pelo script de correcao retroativa.
 */
export function normalizarCategoria(valor: unknown): string {
  if (typeof valor !== 'string') return 'Outros';
  const norm = valor.toLowerCase().trim();
  return NORMALIZADAS[norm] || 'Outros';
}
 
function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    let s = v.replace(/[^\d.,-]/g, '').trim();
    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
 
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reconcilia(analise: any, truncado: boolean): AnaliseFatura {
  const transacoesBrutas = Array.isArray(analise?.transacoes) ? analise.transacoes : [];
 
  const transacoes: Transacao[] = transacoesBrutas.map((t: Transacao) => ({
    descricao: String(t?.descricao ?? '').trim() || 'Sem descricao',
    valor: round2(num(t?.valor)),
    // Normaliza a categoria pra canonica (com acento) - alinha com Pluggy
    categoria: normalizarCategoria(t?.categoria),
  }));
 
  let categorias: Categoria[];
 
  if (transacoes.length > 0) {
    const mapa = new Map<string, number>();
    for (const t of transacoes) {
      mapa.set(t.categoria, (mapa.get(t.categoria) || 0) + t.valor);
    }
    categorias = Array.from(mapa.entries())
      .map(([nome, valor]) => ({ nome, valor: round2(valor) }))
      .sort((a, b) => b.valor - a.valor);
  } else {
    const catBrutas = Array.isArray(analise?.categorias) ? analise.categorias : [];
    categorias = catBrutas
      .map((c: Categoria) => ({
        nome: normalizarCategoria(c?.nome),
        valor: round2(num(c?.valor)),
      }))
      .sort((a: Categoria, b: Categoria) => b.valor - a.valor);
  }
 
  const total = round2(categorias.reduce((acc, c) => acc + c.valor, 0));
 
  return {
    total,
    categorias,
    transacoes,
    insight: String(analise?.insight ?? '').trim(),
    truncado,
  };
}
 
// Exporto a lista canonica caso outros modulos precisem validar
export { CANONICAS };
 
/**
 * Recebe o texto de uma fatura e retorna a analise estruturada.
 * Usado pela rota /api/analisar e pelos evals.
 */
export async function analisarTextoFatura(textoFatura: string): Promise<AnaliseFatura> {
  const truncado = textoFatura.length > LIMITE_TEXTO;
  const texto = truncado ? textoFatura.slice(0, LIMITE_TEXTO) : textoFatura;
 
  const prompt = `Voce e um assistente financeiro. Analise o texto de uma fatura de cartao de credito abaixo.
 
Responda APENAS com um JSON valido, sem nenhum texto antes ou depois, neste formato exato:
{
  "transacoes": [
    { "descricao": "iFood", "valor": 38.90, "categoria": "Alimentacao" },
    { "descricao": "Uber", "valor": 22.40, "categoria": "Transporte" }
  ],
  "insight": "uma frase curta e util sobre os gastos, em portugues"
}
 
Categorias possiveis: Alimentacao, Transporte, Compras, Lazer, Saude, Educacao, Moradia, Servicos, Outros.
 
REGRAS IMPORTANTES:
- Liste em "transacoes" CADA compra/gasto individual da fatura, uma por uma.
- Se o mesmo estabelecimento aparece varias vezes (ex: 5 corridas de Uber no mes), liste TODAS, uma linha para cada. NAO junte nem resuma.
- Use ponto como separador decimal (ex: 38.90), nunca virgula.
- Ignore linhas que NAO sao gastos: pagamento da fatura anterior, saldo anterior, estornos/creditos, limite, juros informativos. Liste apenas as COMPRAS.
- Nao precisa calcular totais nem somas: apenas identifique e classifique cada transacao. A soma e feita depois pelo sistema.
 
Texto da fatura:
${texto}`;
 
  const respostaIA = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.mentaapp.com.br',
      'X-Title': 'Menta App',
    },
    body: JSON.stringify({
      model: MODELO_IA,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
 
  if (!respostaIA.ok) {
    const erroTexto = await respostaIA.text();
    throw new Error('Erro da IA: ' + erroTexto);
  }
 
  const dadosIA = await respostaIA.json();
  const conteudo = dadosIA.choices?.[0]?.message?.content || '';
 
  const inicio = conteudo.indexOf('{');
  const fim = conteudo.lastIndexOf('}');
  if (inicio === -1 || fim === -1) {
    console.error('[analise-fatura] IA nao retornou JSON. Conteudo cru:', conteudo);
    throw new Error('A IA nao retornou um JSON valido');
  }
 
  try {
    const bruta = JSON.parse(conteudo.slice(inicio, fim + 1));
    return reconcilia(bruta, truncado);
  } catch {
    console.error('[analise-fatura] JSON invalido. Conteudo cru:', conteudo);
    throw new Error('Nao foi possivel ler o JSON da IA');
  }
}