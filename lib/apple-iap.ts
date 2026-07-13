/**
 * Cliente da App Store Server API (validacao de assinaturas Apple).
 *
 * Espelha o papel de lib/mercadopago.ts, mas pra Apple:
 *  - assina um JWT (ES256) com a chave .p8 pra autenticar na API
 *  - consulta o status de uma assinatura pelo transactionId
 *  - decodifica os payloads JWS que a Apple envia (transacao e renovacao)
 *
 * IMPORTANTE (seguranca): a decodificacao aqui NAO verifica a assinatura
 * criptografica do JWS. Por isso, o fluxo do /api/apple/validar sempre
 * RECONSULTA a Apple pelo transactionId (mesma filosofia do webhook do MP,
 * que nunca confia no body e sempre chama getPreapproval). O dado que vale
 * eh o que veio da resposta autenticada da API da Apple, nao o que o app
 * mandou.
 *
 * ===================================================================
 * AMBIENTE (producao vs sandbox) - LEIA ISTO:
 *
 * A App Store Server API tem DOIS hosts separados:
 *   producao: https://api.storekit.itunes.apple.com
 *   sandbox:  https://api.storekit-sandbox.itunes.apple.com
 *
 * Uma transacao so existe no host do ambiente em que foi feita:
 *   - compra de cliente real  -> existe SO em producao
 *   - compra do revisor Apple  -> existe SO em sandbox (TestFlight/Review usam sandbox)
 *
 * Por isso NAO da pra fixar o ambiente por env var: qualquer valor fixo
 * quebra um dos dois publicos. A regra oficial da Apple eh:
 *   1) tenta PRODUCAO
 *   2) se a Apple responder 404 com "TransactionIdNotFoundError" (code
 *      4040010), refaz a MESMA consulta no SANDBOX
 *
 * Assim o mesmo codigo atende cliente real E revisor, sem trocar config.
 * (Equivalente ao antigo tratamento do status 21007 do verifyReceipt.)
 * ===================================================================
 *
 * Env vars (Vercel):
 *   APPLE_IAP_KEY_ID       - Key ID da chave "Compras dentro do app"
 *   APPLE_IAP_ISSUER_ID    - Issuer ID (topo da pagina de Chaves)
 *   APPLE_IAP_PRIVATE_KEY  - conteudo do .p8 (com \n escapados)
 *   APPLE_BUNDLE_ID        - com.mentaapp.mentamobile
 *
 * (APPLE_IAP_AMBIENTE nao eh mais usado pra decidir o host - o fallback
 *  cobre os dois automaticamente. Pode remover da Vercel se quiser.)
 */

import crypto from 'crypto';

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'com.mentaapp.mentamobile';

const HOST_PRODUCAO = 'https://api.storekit.itunes.apple.com';
const HOST_SANDBOX = 'https://api.storekit-sandbox.itunes.apple.com';

// =========================================================================
// Tipos
// =========================================================================

export type NivelPago = 'premium' | 'max';
export type CicloAssinatura = 'mensal' | 'anual';

/** Payload decodificado de uma transacao (JWSTransaction). */
export type AppleTransacao = {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  purchaseDate: number;          // epoch ms
  expiresDate?: number;          // epoch ms
  appAccountToken?: string;      // user_id do Supabase (amarra a compra ao usuario)
  revocationDate?: number;       // preenchido se houve reembolso
  environment?: string;          // "Production" ou "Sandbox"
};

/** Resposta simplificada do status de assinatura. */
export type StatusAssinatura = {
  ativa: boolean;
  transacao: AppleTransacao;
  /** 1=ativa, 2=expirada, 3=retry de cobranca, 4=periodo de graca, 5=revogada */
  status: number;
  /** ambiente onde a transacao foi de fato encontrada */
  ambiente: 'production' | 'sandbox';
};

// =========================================================================
// Mapa produto -> nivel/ciclo
// =========================================================================

export const PRODUTOS: Record<string, { nivel: NivelPago; ciclo: CicloAssinatura; valor: number }> = {
  'com.mentaapp.mentamobile.premium.mensal': { nivel: 'premium', ciclo: 'mensal', valor: 34.90 },
  'com.mentaapp.mentamobile.premium.anual': { nivel: 'premium', ciclo: 'anual', valor: 349.90 },
  'com.mentaapp.mentamobile.max.mensal': { nivel: 'max', ciclo: 'mensal', valor: 58.90 },
  'com.mentaapp.mentamobile.max.anual': { nivel: 'max', ciclo: 'anual', valor: 589.90 },
};

export function produtoParaPlano(productId: string) {
  return PRODUTOS[productId] || null;
}

// =========================================================================
// JWT de autenticacao (ES256, assinado com a chave .p8)
// =========================================================================

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function getPrivateKey(): string {
  const raw = process.env.APPLE_IAP_PRIVATE_KEY;
  if (!raw) throw new Error('APPLE_IAP_PRIVATE_KEY nao configurada');
  // Na Vercel a chave costuma vir com \n literais.
  return raw.replace(/\\n/g, '\n');
}

/**
 * Gera o bearer token exigido pela App Store Server API.
 * Validade curta (20 min) - geramos um por requisicao, simples e seguro.
 * O MESMO token vale pra producao e sandbox (a chave .p8 nao eh por ambiente).
 */
function gerarToken(): string {
  const keyId = process.env.APPLE_IAP_KEY_ID;
  const issuerId = process.env.APPLE_IAP_ISSUER_ID;
  if (!keyId || !issuerId) {
    throw new Error('APPLE_IAP_KEY_ID ou APPLE_IAP_ISSUER_ID nao configurados');
  }

  const agora = Math.floor(Date.now() / 1000);

  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = {
    iss: issuerId,
    iat: agora,
    exp: agora + 20 * 60,
    aud: 'appstoreconnect-v1',
    bid: BUNDLE_ID,
  };

  const cabecalho = base64url(JSON.stringify(header));
  const corpo = base64url(JSON.stringify(payload));
  const assinavel = `${cabecalho}.${corpo}`;

  const assinatura = crypto.sign(
    null,
    Buffer.from(assinavel),
    { key: getPrivateKey(), dsaEncoding: 'ieee-p1363' }
  );

  return `${assinavel}.${base64url(assinatura)}`;
}

// =========================================================================
// Decodificacao de JWS (payload apenas - a verificacao vem da reconsulta)
// =========================================================================

/**
 * Le o payload (parte do meio) de um JWS sem verificar a assinatura.
 *
 * Usar SOMENTE pra extrair identificadores (transactionId, productId) e,
 * na sequencia, reconsultar a Apple. Nunca confiar direto neste retorno
 * pra liberar plano.
 */
export function decodificarJWS<T = Record<string, unknown>>(jws: string): T {
  const partes = jws.split('.');
  if (partes.length !== 3) throw new Error('JWS malformado');
  const payload = Buffer.from(partes[1], 'base64').toString('utf8');
  return JSON.parse(payload) as T;
}

// =========================================================================
// Cliente HTTP com fallback de ambiente
// =========================================================================

/** Erro tipado pra quando a transacao nao existe naquele host (404 / 4040010). */
class TransacaoNaoEncontradaNoHost extends Error {}

/**
 * Faz UMA chamada num host especifico.
 * - 200: retorna o JSON
 * - 404 com errorCode 4040010 (TransactionIdNotFoundError): lanca
 *   TransacaoNaoEncontradaNoHost pra sinalizar "tenta o outro ambiente"
 * - qualquer outro erro: lanca Error normal
 */
async function appleFetchNoHost<T>(host: string, endpoint: string): Promise<T> {
  const res = await fetch(`${host}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${gerarToken()}`,
      'Content-Type': 'application/json',
    },
  });

  if (res.ok) {
    return res.json() as Promise<T>;
  }

  const texto = await res.text();

  // A Apple retorna 404 + JSON { errorCode: 4040010, ... } quando a transacao
  // nao existe NAQUELE ambiente. Isso eh o gatilho do fallback, nao um erro real.
  if (res.status === 404) {
    let errorCode: number | undefined;
    try {
      errorCode = JSON.parse(texto)?.errorCode;
    } catch {
      // corpo nao-JSON: trata como nao-encontrado mesmo assim
    }
    if (errorCode === 4040010 || errorCode === undefined) {
      throw new TransacaoNaoEncontradaNoHost(
        `transacao nao encontrada no host ${host} (${res.status} ${errorCode ?? ''})`
      );
    }
  }

  throw new Error(`Apple API erro ${res.status} em ${endpoint} (${host}): ${texto}`);
}

/**
 * Consulta um endpoint tentando PRODUCAO primeiro e, se a transacao nao
 * existir la, SANDBOX. Retorna tambem em qual ambiente achou.
 *
 * Essa eh a regra oficial da Apple pra suportar compras reais e de revisao
 * com o mesmo codigo.
 */
async function appleFetch<T>(endpoint: string): Promise<{ dados: T; ambiente: 'production' | 'sandbox' }> {
  try {
    const dados = await appleFetchNoHost<T>(HOST_PRODUCAO, endpoint);
    return { dados, ambiente: 'production' };
  } catch (e) {
    if (e instanceof TransacaoNaoEncontradaNoHost) {
      // Nao existe em producao -> provavelmente eh sandbox (revisor/TestFlight).
      const dados = await appleFetchNoHost<T>(HOST_SANDBOX, endpoint);
      return { dados, ambiente: 'sandbox' };
    }
    throw e;
  }
}

// =========================================================================
// API publica
// =========================================================================

type UltimaTransacao = {
  status: number;
  originalTransactionId: string;
  signedTransactionInfo: string;
  signedRenewalInfo?: string;
};

type RespostaStatus = {
  data?: {
    subscriptionGroupIdentifier?: string;
    lastTransactions?: UltimaTransacao[];
  }[];
};

/**
 * Consulta o status atual de uma assinatura na Apple, a partir de um
 * transactionId (ou originalTransactionId).
 *
 * Esta eh a FONTE DA VERDADE - equivalente ao getPreapproval() do MP.
 *
 * Tenta producao e cai pra sandbox automaticamente (ver appleFetch).
 *
 * ATENCAO (bug corrigido): o endpoint /inApps/v1/subscriptions/{id} devolve
 * TODAS as transacoes do GRUPO de assinaturas, nao so a que foi comprada.
 * Como Premium e Max estao no mesmo grupo, pegar `lastTransactions[0]` as
 * cegas podia retornar o produto errado (compramos Premium e vinha Max).
 *
 * Agora procuramos a transacao cujo transactionId (ou originalTransactionId)
 * bate com o que o app informou. So caimos no fallback se nao acharmos.
 */
export async function getStatusAssinatura(transactionId: string): Promise<StatusAssinatura> {
  const { dados: resposta, ambiente } = await appleFetch<RespostaStatus>(
    `/inApps/v1/subscriptions/${transactionId}`
  );

  // Junta as transacoes de todos os grupos retornados.
  const todas: UltimaTransacao[] = [];
  for (const grupo of resposta.data || []) {
    for (const tx of grupo.lastTransactions || []) {
      todas.push(tx);
    }
  }

  if (todas.length === 0) {
    throw new Error('Apple nao retornou transacao para esse id');
  }

  // Decodifica todas e acha a que corresponde ao transactionId pedido.
  const decodificadas = todas.map((tx) => ({
    bruta: tx,
    payload: decodificarJWS<AppleTransacao>(tx.signedTransactionInfo),
  }));

  let escolhida = decodificadas.find(
    (d) =>
      d.payload.transactionId === transactionId ||
      d.payload.originalTransactionId === transactionId ||
      d.bruta.originalTransactionId === transactionId
  );

  if (!escolhida) {
    // Fallback: nenhuma bateu. Prefere uma ATIVA (status 1) a uma qualquer.
    console.warn(
      `[apple-iap] transacao ${transactionId} nao encontrada entre ${todas.length} do grupo; usando fallback`
    );
    escolhida = decodificadas.find((d) => d.bruta.status === 1) || decodificadas[0];
  }

  const transacao = escolhida.payload;

  // Defesa: garante que a transacao pertence AO NOSSO app.
  if (transacao.bundleId !== BUNDLE_ID) {
    throw new Error(`bundleId divergente: ${transacao.bundleId}`);
  }

  // status 1 = ativa, 4 = periodo de graca (ainda com acesso)
  const ativa = escolhida.bruta.status === 1 || escolhida.bruta.status === 4;

  console.log(
    `[apple-iap] status: produto=${transacao.productId} status=${escolhida.bruta.status} ambiente=${ambiente} (de ${todas.length} no grupo)`
  );

  return { ativa, transacao, status: escolhida.bruta.status, ambiente };
}

/**
 * Ambiente eh decidido por transacao agora (nao ha mais ambiente "global").
 * Mantido pra compatibilidade com quem importa ambienteAtual() em logs/debug.
 */
export function ambienteAtual(): 'auto (producao->sandbox)' {
  return 'auto (producao->sandbox)';
}