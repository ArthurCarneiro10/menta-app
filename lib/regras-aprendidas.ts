/**
 * lib/regras-aprendidas.ts (menta-app / web)
 *
 * Aplica as regras que o usuario ensinou ao corrigir a IA:
 *   - regras_categoria: descricao -> categoria certa
 *   - regras_fixo:      descricao -> e um gasto fixo
 *
 * A IA continua categorizando, MAS a regra do usuario tem prioridade.
 * Se ele ja corrigiu "IFOOD" pra Alimentacao, toda transacao que contenha
 * "ifood" sai como Alimentacao sem depender da IA.
 *
 * CASAMENTO "POR TRECHO" (palavra-chave):
 *   - guardamos a regra por uma CHAVE (o merchant principal da descricao)
 *   - ex: "IFOOD *ABC LTDA 01/02" -> chave "ifood"
 *   - na hora de aplicar, se a descricao nova contem a chave, a regra vale
 *
 * IMPORTANTE: a MESMA funcao extrairChave() precisa ser usada no app mobile
 * (gastos.tsx) na hora de SALVAR a regra, senao a chave salva nao casa com a
 * chave buscada. Ver o gastos.tsx atualizado que acompanha esta entrega.
 */

// 9 categorias canonicas (defesa: so aceita regra com categoria valida)
const CATEGORIAS_VALIDAS = new Set([
  'Alimentação', 'Transporte', 'Compras', 'Lazer', 'Saúde',
  'Educação', 'Moradia', 'Serviços', 'Outros',
]);

// Palavras que nao servem como chave (ruido comum em descricao de fatura)
const STOPWORDS = new Set([
  'compra', 'pagamento', 'pag', 'cartao', 'debito', 'credito', 'parcela',
  'ltda', 'me', 'sa', 'eireli', 'br', 'brasil', 'com', 'www',
  'app', 'online', 'pix', 'ted', 'doc', 'tarifa', 'mensalidade',
]);

/** normaliza: minuscula, sem acento, sem simbolo, espaco unico */
export function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')   // tira *, /, numeros de parcela etc viram espaco
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai a CHAVE (merchant principal) de uma descricao, pro casamento por trecho.
 *
 * Estrategia: normaliza, quebra em palavras, descarta stopwords e numeros,
 * e pega a primeira palavra "significativa" (>= 3 letras). Se nada sobrar,
 * cai pra descricao normalizada inteira.
 *
 * Exemplos:
 *  "IFOOD *ABC LTDA"        -> "ifood"
 *  "UBER   *TRIP SAO PAULO" -> "uber"
 *  "PAG*Enel Distribuicao"  -> "enel"
 *  "NETFLIX.COM"            -> "netflix"
 */
export function extrairChave(descricao: string): string {
  const norm = normalizar(descricao);
  if (!norm) return '';
  const palavras = norm.split(' ').filter((p) =>
    p.length >= 3 && !STOPWORDS.has(p) && !/^\d+$/.test(p)
  );
  return palavras[0] || norm;
}

export type RegraCategoria = { chave: string; categoria: string };
export type RegraFixo = { chave: string; e_fixo: boolean };

/**
 * Aplica as regras do usuario sobre as transacoes que a IA devolveu.
 * Retorna: transacoes ajustadas + quantas foram sobrescritas (pra log).
 *
 * Cada transacao vira { descricao, valor, categoria, e_fixo }.
 * (e_fixo so aparece se houver regra de fixo pra ela.)
 */
export function aplicarRegras(
  transacoes: { descricao?: string; valor?: number; categoria?: string }[],
  regrasCategoria: RegraCategoria[],
  regrasFixo: RegraFixo[]
): { transacoes: any[]; sobrescritasCategoria: number; marcadasFixo: number } {
  // indexa as regras por chave
  const mapaCat = new Map<string, string>();
  for (const r of regrasCategoria) {
    if (r.chave && CATEGORIAS_VALIDAS.has(r.categoria)) mapaCat.set(r.chave, r.categoria);
  }
  const mapaFixo = new Map<string, boolean>();
  for (const r of regrasFixo) {
    if (r.chave) mapaFixo.set(r.chave, r.e_fixo);
  }

  let sobrescritasCategoria = 0;
  let marcadasFixo = 0;

  const ajustadas = (transacoes || []).map((t) => {
    const chave = extrairChave(t.descricao || '');

    // categoria: regra vence a IA
    let categoria = t.categoria || 'Outros';
    if (chave && mapaCat.has(chave)) {
      const nova = mapaCat.get(chave)!;
      if (nova !== categoria) sobrescritasCategoria++;
      categoria = nova;
    }

    // fixo: so marca se houver regra dizendo true
    let e_fixo = false;
    if (chave && mapaFixo.get(chave) === true) {
      e_fixo = true;
      marcadasFixo++;
    }

    return { ...t, categoria, e_fixo };
  });

  return { transacoes: ajustadas, sobrescritasCategoria, marcadasFixo };
}