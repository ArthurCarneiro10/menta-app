/**
 * Cliente da API Pluggy.
 * Toda comunicacao com a Pluggy passa por aqui.
 *
 * Documentacao oficial: https://docs.pluggy.ai
 * SDK oficial: https://github.com/pluggyai/pluggy-node
 */
 
const PLUGGY_API_URL = 'https://api.pluggy.ai';
 
// Cache do apiKey em memoria do processo (renova a cada 2h)
let cachedApiKey: string | null = null;
let cachedApiKeyExpiresAt = 0;
 
async function getApiKey(): Promise<string> {
  const agora = Date.now();
 
  if (cachedApiKey && agora < cachedApiKeyExpiresAt - 5 * 60 * 1000) {
    return cachedApiKey;
  }
 
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
 
  if (!clientId || !clientSecret) {
    throw new Error('PLUGGY_CLIENT_ID ou PLUGGY_CLIENT_SECRET nao configurados no .env.local');
  }
 
  const resp = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
 
  if (!resp.ok) {
    const erro = await resp.text();
    throw new Error('Pluggy auth falhou: ' + erro);
  }
 
  const data = await resp.json();
  if (!data.apiKey) {
    throw new Error('Pluggy nao retornou apiKey');
  }
 
  cachedApiKey = data.apiKey;
  cachedApiKeyExpiresAt = agora + 2 * 60 * 60 * 1000;
  return cachedApiKey!;
}
 
async function pluggyFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = await getApiKey();
  const headers = {
    'Content-Type': 'application/json',
    'X-API-KEY': apiKey,
    ...(options.headers || {}),
  };
  return fetch(`${PLUGGY_API_URL}${path}`, { ...options, headers });
}
 
export async function criarConnectToken(clientUserId: string): Promise<string> {
  const resp = await pluggyFetch('/connect_token', {
    method: 'POST',
    body: JSON.stringify({ options: { clientUserId } }),
  });
 
  if (!resp.ok) {
    const erro = await resp.text();
    throw new Error('Erro ao criar connect token: ' + erro);
  }
 
  const data = await resp.json();
  if (!data.accessToken) {
    throw new Error('Pluggy nao retornou accessToken');
  }
  return data.accessToken;
}
 
// ====== Tipos ======
 
export type PluggyItem = {
  id: string;
  clientUserId?: string;
  status?: string;
  executionStatus?: string;
  updatedAt?: string;
  createdAt?: string;
  connector?: {
    id?: number;
    name?: string;
    imageUrl?: string;
  };
};
 
export type PluggyAccount = {
  id: string;
  itemId?: string;
  type?: string;
  subtype?: string;
  name?: string;
  number?: string;
  balance?: number;
  currencyCode?: string;
  creditData?: {
    creditLimit?: number;
    availableLimit?: number;
  };
};
 
export type PluggyTransaction = {
  id: string;
  accountId?: string;
  date: string;
  description?: string;
  amount: number;
  currencyCode?: string;
  category?: string;
  merchant?: { name?: string };
  type?: string;
};
 
// ====== Funcoes ======
 
export async function getItem(itemId: string): Promise<PluggyItem> {
  const resp = await pluggyFetch(`/items/${itemId}`);
  if (!resp.ok) {
    const erro = await resp.text();
    throw new Error('Erro ao buscar item: ' + erro);
  }
  return resp.json();
}
 
export async function getAccounts(itemId: string): Promise<PluggyAccount[]> {
  const resp = await pluggyFetch(`/accounts?itemId=${encodeURIComponent(itemId)}`);
  if (!resp.ok) {
    const erro = await resp.text();
    throw new Error('Erro ao buscar contas: ' + erro);
  }
  const data = await resp.json();
  return data.results || [];
}
 
/**
 * Lista TODAS as transacoes de uma conta a partir de dateFrom.
 *
 * Usa o endpoint v2 com cursor pagination:
 *   GET /v2/transactions?accountId=X&dateFrom=YYYY-MM-DD
 *   GET /v2/transactions?accountId=X&dateFrom=YYYY-MM-DD&after=<cursor>
 *
 * Resposta: { results, next }
 *   next = URL completa contendo o parametro "after" para a proxima pagina
 *          (ou null/ausente quando acabou)
 */
export async function getTransactions(
  accountId: string,
  dateFrom: string
): Promise<PluggyTransaction[]> {
  const all: PluggyTransaction[] = [];
  let after: string | null = null;
  let voltas = 0;
 
  while (true) {
    const params = new URLSearchParams({
      accountId,
      dateFrom,
    });
    if (after) params.set('after', after);
 
    const resp = await pluggyFetch(`/v2/transactions?${params.toString()}`);
    if (!resp.ok) {
      const erro = await resp.text();
      throw new Error('Erro ao buscar transacoes: ' + erro);
    }
 
    const data = await resp.json();
    const items: PluggyTransaction[] = data.results || [];
    all.push(...items);
 
    // next vem como URL completa - extraimos o parametro "after"
    const nextUrl: string | null = data.next || null;
    if (!nextUrl) break;
 
    try {
      const url = nextUrl.startsWith('http')
        ? new URL(nextUrl)
        : new URL(nextUrl, PLUGGY_API_URL);
      const novoAfter = url.searchParams.get('after');
      if (!novoAfter) break;
      after = novoAfter;
    } catch {
      break;
    }
 
    voltas++;
    if (voltas > 20) break; // trava de seguranca
  }
 
  return all;
}