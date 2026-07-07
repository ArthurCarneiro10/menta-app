/**
 * Analise de fatura: PDF -> JSON estruturado.
 *
 * Dois caminhos:
 *  - analisarTextoFatura(texto): PDF com texto selecionavel (caminho padrao,
 *    rapido e barato). INALTERADO.
 *  - analisarFaturaVisao(base64Pdf): PDF escaneado/imagem, sem texto. Envia o
 *    PDF direto pro Claude via OpenRouter (leitura por VISAO). Usado como
 *    fallback pela rota quando o pdf-parse nao acha texto legivel.
 *
 * Ambos compartilham as mesmas REGRAS, o mesmo formato de JSON e a mesma
 * reconciliacao (normalizacao de categorias + soma no sistema).
 */

// ===== MODELO DE IA =====
const MODELO_IA = 'anthropic/claude-haiku-4.5';
// =========================

// Teto de caracteres do texto da fatura enviado pra IA (caminho de texto).
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

// Mapa de qualquer grafia -> canonica.
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

export { CANONICAS };

// ===== REGRAS COMPARTILHADAS (texto e visao usam as mesmas) =====
const REGRAS = `Responda APENAS com um JSON valido, sem nenhum texto antes ou depois, neste formato exato:
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
- Nao precisa calcular totais nem somas: apenas identifique e classifique cada transacao. A soma e feita depois pelo sistema.`;

// Chama o OpenRouter e devolve o conteudo cru. `plugins` so no caminho de visao.
async function chamarIA(
  messages: unknown[],
  plugins?: unknown[],
): Promise<string> {
  const body: Record<string, unknown> = { model: MODELO_IA, messages };
  if (plugins) body.plugins = plugins;

  const respostaIA = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.mentaapp.com.br',
      'X-Title': 'Menta App',
    },
    body: JSON.stringify(body),
  });

  if (!respostaIA.ok) {
    const erroTexto = await respostaIA.text();
    throw new Error('Erro da IA: ' + erroTexto);
  }

  const dadosIA = await respostaIA.json();
  return dadosIA.choices?.[0]?.message?.content || '';
}

// Extrai o JSON do conteudo cru e reconcilia (mesma logica dos dois caminhos).
function parseAnalise(conteudo: string, truncado: boolean): AnaliseFatura {
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

/**
 * CAMINHO PADRAO: PDF com texto selecionavel.
 * Recebe o texto ja extraido (pdf-parse) e retorna a analise estruturada.
 */
export async function analisarTextoFatura(textoFatura: string): Promise<AnaliseFatura> {
  const truncado = textoFatura.length > LIMITE_TEXTO;
  const texto = truncado ? textoFatura.slice(0, LIMITE_TEXTO) : textoFatura;

  const prompt = `Voce e um assistente financeiro. Analise o texto de uma fatura de cartao de credito abaixo.

${REGRAS}

Texto da fatura:
${texto}`;

  const conteudo = await chamarIA([{ role: 'user', content: prompt }]);
  return parseAnalise(conteudo, truncado);
}

/**
 * CAMINHO DE VISAO: PDF escaneado / imagem (sem texto).
 * Envia o PDF direto pro Claude, que le por visao. Usado como fallback
 * pela rota quando o pdf-parse nao encontra texto legivel.
 *
 * engine 'native' = usa a leitura nativa do proprio Claude (visao), sem
 * custo extra de OCR de terceiros.
 */
export async function analisarFaturaVisao(base64Pdf: string): Promise<AnaliseFatura> {
  const instrucao = `Voce e um assistente financeiro. Analise a fatura de cartao de credito no arquivo em anexo.

${REGRAS}`;

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: instrucao },
        {
          type: 'file',
          file: {
            filename: 'fatura.pdf',
            file_data: `data:application/pdf;base64,${base64Pdf}`,
          },
        },
      ],
    },
  ];

  const plugins = [{ id: 'file-parser', pdf: { engine: 'native' } }];

  const conteudo = await chamarIA(messages, plugins);
  return parseAnalise(conteudo, false);
}