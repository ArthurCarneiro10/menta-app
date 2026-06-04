/**
 * Categorizacao de transacoes bancarias (Pluggy -> Menta).
 *
 * Estrategia hibrida:
 *   1. Regras de mapeamento (gratis, instantaneo) cobrem as categorias
 *      mais comuns que a Pluggy retorna em ingles
 *   2. IA (Claude Haiku) e usada APENAS para transacoes onde a regra
 *      nao encontrou correspondencia (descricao livre ou categoria
 *      desconhecida)
 *
 * Resultado: todas as transacoes ficam em uma das 9 categorias da Menta,
 * em portugues, com custo de IA minimo.
 */
 
// Categorias canonicas da Menta (mesma lista usada no PDF flow)
const CATEGORIAS = [
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
 
export type CategoriaMenta = typeof CATEGORIAS[number];
 
// Mapa de strings comuns (lower case) -> categoria Menta.
// Cobre as principais categorias que a Pluggy retorna em ingles.
const MAPA: Record<string, CategoriaMenta> = {
  // ========== ALIMENTACAO ==========
  'food': 'Alimentação',
  'food and drink': 'Alimentação',
  'food and drinks': 'Alimentação',
  'foodanddrink': 'Alimentação',
  'restaurants': 'Alimentação',
  'restaurant': 'Alimentação',
  'fast food': 'Alimentação',
  'coffee shop': 'Alimentação',
  'coffee shops': 'Alimentação',
  'coffee': 'Alimentação',
  'groceries': 'Alimentação',
  'supermarket': 'Alimentação',
  'supermarkets': 'Alimentação',
  'bakery': 'Alimentação',
  'bar': 'Alimentação',
  'bars': 'Alimentação',
  'delivery': 'Alimentação',
  'alimentacao': 'Alimentação',
  'alimentação': 'Alimentação',
 
  // ========== TRANSPORTE ==========
  'transportation': 'Transporte',
  'transport': 'Transporte',
  'travel': 'Transporte',
  'gas stations': 'Transporte',
  'gas station': 'Transporte',
  'gas': 'Transporte',
  'parking': 'Transporte',
  'ride share': 'Transporte',
  'rideshare': 'Transporte',
  'taxi': 'Transporte',
  'public transportation': 'Transporte',
  'public transport': 'Transporte',
  'airline': 'Transporte',
  'airlines': 'Transporte',
  'uber': 'Transporte',
  'transporte': 'Transporte',
 
  // ========== COMPRAS ==========
  'shopping': 'Compras',
  'clothing': 'Compras',
  'electronics': 'Compras',
  'general merchandise': 'Compras',
  'department stores': 'Compras',
  'home improvement': 'Compras',
  'pets': 'Compras',
  'pet': 'Compras',
  'gifts': 'Compras',
  'compras': 'Compras',
 
  // ========== LAZER ==========
  'entertainment': 'Lazer',
  'recreation': 'Lazer',
  'sports': 'Lazer',
  'movies': 'Lazer',
  'music': 'Lazer',
  'games': 'Lazer',
  'arts and entertainment': 'Lazer',
  'leisure': 'Lazer',
  'streaming': 'Lazer',
  'lazer': 'Lazer',
 
  // ========== SAUDE ==========
  'healthcare': 'Saúde',
  'health and fitness': 'Saúde',
  'health': 'Saúde',
  'pharmacy': 'Saúde',
  'pharmacies': 'Saúde',
  'doctor': 'Saúde',
  'doctors': 'Saúde',
  'medical': 'Saúde',
  'personal care': 'Saúde',
  'gym': 'Saúde',
  'fitness': 'Saúde',
  'saúde': 'Saúde',
  'saude': 'Saúde',
 
  // ========== EDUCACAO ==========
  'education': 'Educação',
  'school': 'Educação',
  'schools': 'Educação',
  'tuition': 'Educação',
  'books': 'Educação',
  'educação': 'Educação',
  'educacao': 'Educação',
 
  // ========== MORADIA ==========
  'housing': 'Moradia',
  'rent': 'Moradia',
  'mortgage': 'Moradia',
  'home': 'Moradia',
  'utilities': 'Moradia',
  'water': 'Moradia',
  'electricity': 'Moradia',
  'internet': 'Moradia',
  'moradia': 'Moradia',
 
  // ========== SERVICOS ==========
  'bills and utilities': 'Serviços',
  'bills': 'Serviços',
  'subscription': 'Serviços',
  'subscriptions': 'Serviços',
  'services': 'Serviços',
  'services and subscriptions': 'Serviços',
  'professional services': 'Serviços',
  'serviços': 'Serviços',
  'servicos': 'Serviços',
 
  // ========== OUTROS ==========
  'transfer': 'Outros',
  'transfers': 'Outros',
  'cash and checks': 'Outros',
  'cash': 'Outros',
  'fees': 'Outros',
  'taxes': 'Outros',
  'income': 'Outros',
  'salary': 'Outros',
  'deposit': 'Outros',
  'withdrawal': 'Outros',
  'atm': 'Outros',
  'pix': 'Outros',
  'ted': 'Outros',
  'outros': 'Outros',
  'other': 'Outros',
  'others': 'Outros',
  'uncategorized': 'Outros',
};
 
function normalizar(s: string): string {
  return s.toLowerCase().trim();
}
 
/**
 * Tenta mapear uma categoria Pluggy para uma categoria Menta usando apenas regras.
 * Retorna null se nao conseguiu mapear (IA precisa decidir).
 */
export function categorizarPorRegra(pluggyCategoria: string | null | undefined): CategoriaMenta | null {
  if (!pluggyCategoria) return null;
 
  const norm = normalizar(pluggyCategoria);
 
  // 1) Match exato
  if (MAPA[norm]) return MAPA[norm];
 
  // 2) Pluggy as vezes retorna "Pai > Filho"
  if (norm.includes(' > ')) {
    const partes = norm.split(' > ').map((p) => p.trim());
    // Tenta primeiro a parte mais especifica (filho), depois a geral (pai)
    if (partes[1] && MAPA[partes[1]]) return MAPA[partes[1]];
    if (partes[0] && MAPA[partes[0]]) return MAPA[partes[0]];
  }
 
  // 3) Match parcial por palavra-chave
  for (const [chave, valor] of Object.entries(MAPA)) {
    if (norm.includes(chave)) return valor;
  }
 
  return null;
}
 
type TransacaoParaIA = {
  descricao: string;
  categoriaPluggy?: string | null;
};
 
/**
 * Categoriza um lote de transacoes via Claude Haiku.
 * Retorna array de categorias na MESMA ORDEM das entradas.
 */
async function categorizarComIA(transacoes: TransacaoParaIA[]): Promise<CategoriaMenta[]> {
  if (transacoes.length === 0) return [];
 
  const lista = transacoes
    .map((t, i) => {
      let linha = `${i + 1}. "${t.descricao}"`;
      if (t.categoriaPluggy) linha += ` (Pluggy: ${t.categoriaPluggy})`;
      return linha;
    })
    .join('\n');
 
  const prompt = `Voce e um assistente financeiro brasileiro. Categorize cada transacao bancaria abaixo em UMA das categorias:
 
Alimentacao, Transporte, Compras, Lazer, Saude, Educacao, Moradia, Servicos, Outros.
 
Regras:
- Alimentacao: restaurantes, mercados, delivery, padaria, bar, cafeteria, ifood
- Transporte: Uber, gasolina, estacionamento, passagens, taxi, metro, onibus
- Compras: roupas, eletronicos, shopping, presentes, pet shop
- Lazer: cinema, streaming, jogos, viagens, shows
- Saude: farmacia, medico, plano de saude, academia, dentista
- Educacao: cursos, livros, escolas, faculdade
- Moradia: aluguel, condominio, agua, luz, internet, casa
- Servicos: assinaturas, conserto, manicure, lavanderia, servicos profissionais
- Outros: PIX, TED, transferencias, salario, saque, deposito, taxas, qualquer coisa que nao se encaixa
 
Transacoes:
${lista}
 
Responda APENAS com JSON valido, sem texto antes ou depois:
{
  "categorias": ["Alimentacao", "Transporte", ...]
}
 
O array deve ter EXATAMENTE ${transacoes.length} itens, na ordem das transacoes.`;
 
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.mentaapp.com.br',
      'X-Title': 'Menta App',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
 
  if (!resp.ok) {
    const erro = await resp.text();
    throw new Error('Falha ao categorizar com IA: ' + erro);
  }
 
  const data = await resp.json();
  const conteudo = data.choices?.[0]?.message?.content || '';
 
  const inicio = conteudo.indexOf('{');
  const fim = conteudo.lastIndexOf('}');
  if (inicio === -1 || fim === -1) {
    throw new Error('IA nao retornou JSON valido');
  }
 
  let parsed;
  try {
    parsed = JSON.parse(conteudo.slice(inicio, fim + 1));
  } catch {
    throw new Error('Nao foi possivel ler JSON da IA');
  }
 
  const categoriasIA = parsed.categorias;
  if (!Array.isArray(categoriasIA)) {
    throw new Error('IA retornou formato inesperado');
  }
 
  // IA as vezes responde sem acento ("Alimentacao") - normalizamos
  const NORMALIZADAS: Record<string, CategoriaMenta> = {
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
 
  return categoriasIA.map((c: unknown) => {
    if (typeof c !== 'string') return 'Outros';
    const norm = c.toLowerCase().trim();
    return NORMALIZADAS[norm] || 'Outros';
  });
}
 
/**
 * FUNCAO PRINCIPAL: categoriza um lote de transacoes.
 *
 * Aplica regras primeiro (gratis) e usa IA so para o que sobrou.
 * Retorna array de categorias na MESMA ORDEM das transacoes de entrada.
 *
 * @param transacoes Lista de objetos com description e category (formato Pluggy)
 */
export async function categorizarLote(
  transacoes: { description?: string | null; category?: string | null }[]
): Promise<CategoriaMenta[]> {
  if (transacoes.length === 0) return [];
 
  // PASSO 1: tentativa por regra (gratis)
  const resultado: (CategoriaMenta | null)[] = transacoes.map((t) =>
    categorizarPorRegra(t.category)
  );
 
  // PASSO 2: IA so para o que sobrou
  const indicesPendentes: number[] = [];
  resultado.forEach((cat, i) => {
    if (!cat) indicesPendentes.push(i);
  });
 
  if (indicesPendentes.length === 0) {
    return resultado as CategoriaMenta[];
  }
 
  // Lotes de 50 para nao explodir o prompt
  const CHUNK_SIZE = 50;
  for (let i = 0; i < indicesPendentes.length; i += CHUNK_SIZE) {
    const chunkIndices = indicesPendentes.slice(i, i + CHUNK_SIZE);
    const txsParaIA: TransacaoParaIA[] = chunkIndices.map((idx) => ({
      descricao: transacoes[idx].description || 'Sem descricao',
      categoriaPluggy: transacoes[idx].category,
    }));
 
    try {
      const aiCats = await categorizarComIA(txsParaIA);
      chunkIndices.forEach((idx, j) => {
        if (aiCats[j]) resultado[idx] = aiCats[j];
      });
    } catch (e) {
      console.error('IA falhou neste lote, usando Outros como fallback:', e);
      chunkIndices.forEach((idx) => {
        if (!resultado[idx]) resultado[idx] = 'Outros';
      });
    }
  }
 
  return resultado.map((c) => c || 'Outros');
}