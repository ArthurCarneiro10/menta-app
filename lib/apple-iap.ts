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
 * Env vars (Vercel):
 *   APPLE_IAP_KEY_ID       - Key ID da chave "Compras dentro do app"
 *   APPLE_IAP_ISSUER_ID    - Issuer ID (topo da pagina de Chaves)
 *   APPLE_IAP_PRIVATE_KEY  - conteudo do .p8 (com \n escapados)
 *   APPLE_BUNDLE_ID        - com.mentaapp.mentamobile
 *   APPLE_IAP_AMBIENTE     - 'sandbox' (default) ou 'production'
 */

import crypto from 'crypto';

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'com.mentaapp.mentamobile';
const EH_PRODUCAO = process.env.APPLE_IAP_AMBIENTE === 'production';

const API_BASE = EH_PRODUCAO
  ? 'https://api.storekit.itunes.apple.com'
  : 'https://api.storekit-sandbox.itunes.apple.com';

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
  environment?: string;
};

/** Resposta simplificada do status de assinatura. */
export type StatusAssinatura = {
  ativa: boolean;
  transacao: AppleTransacao;
  /** 1=ativa, 2=expirada, 3=retry de cobranca, 4=periodo de graca, 5=revogada */
  status: number;
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
// Cliente HTTP
// =========================================================================

async function appleFetch<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${gerarToken()}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`Apple API erro ${res.status} em ${endpoint}: ${texto}`);
  }

  return res.json() as Promise<T>;
}

// =========================================================================
// API publica
// =========================================================================

type RespostaStatus = {
  data?: {
    lastTransactions?: {
      status: number;
      originalTransactionId: string;
      signedTransactionInfo: string;
      signedRenewalInfo?: string;
    }[];
  }[];
};

/**
 * Consulta o status atual de uma assinatura na Apple, a partir de um
 * transactionId (ou originalTransactionId).
 *
 * Esta eh a FONTE DA VERDADE - equivalente ao getPreapproval() do MP.
 * Se a chamada falhar ou o bundleId nao bater, lanca erro.
 */
export async function getStatusAssinatura(transactionId: string): Promise<StatusAssinatura> {
  const resposta = await appleFetch<RespostaStatus>(
    `/inApps/v1/subscriptions/${transactionId}`
  );

  const ultima = resposta.data?.[0]?.lastTransactions?.[0];
  if (!ultima) {
    throw new Error('Apple nao retornou transacao para esse id');
  }

  const transacao = decodificarJWS<AppleTransacao>(ultima.signedTransactionInfo);

  // Defesa: garante que a transacao pertence AO NOSSO app.
  if (transacao.bundleId !== BUNDLE_ID) {
    throw new Error(`bundleId divergente: ${transacao.bundleId}`);
  }

  // status 1 = ativa, 4 = periodo de graca (ainda com acesso)
  const ativa = ultima.status === 1 || ultima.status === 4;

  return { ativa, transacao, status: ultima.status };
}

/** Ambiente atual (util em logs e no endpoint de debug). */
export function ambienteAtual(): 'sandbox' | 'production' {
  return EH_PRODUCAO ? 'production' : 'sandbox';
}