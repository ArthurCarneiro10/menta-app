/**
 * GET /api/apple/debug
 *
 * Rota TEMPORARIA de diagnostico da chave privada da Apple.
 * NAO expoe a chave - so diz se ela esta no formato correto.
 *
 * APAGUE esta rota depois que o IAP estiver funcionando.
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
  const raw = process.env.APPLE_IAP_PRIVATE_KEY;

  if (!raw) {
    return NextResponse.json({
      erro: 'APPLE_IAP_PRIVATE_KEY nao existe nas variaveis de ambiente',
      dica: 'Adicione a variavel na Vercel e faca redeploy.',
    });
  }

  // Diagnostico do formato (sem revelar o conteudo)
  const temBegin = raw.includes('-----BEGIN PRIVATE KEY-----');
  const temEnd = raw.includes('-----END PRIVATE KEY-----');
  const temBarraN = raw.includes('\\n');       // literal \n
  const temQuebraReal = raw.includes('\n');    // quebra de verdade
  const temAspas = raw.trim().startsWith('"') || raw.trim().startsWith("'");
  const temEspacoNoMiolo = /-----BEGIN PRIVATE KEY----- /.test(raw);

  // Tenta usar a chave, do jeito que o codigo real faz
  const reconstruida = raw.replace(/\\n/g, '\n');
  let assinaFunciona = false;
  let erroAssinatura = '';

  try {
    crypto.sign(null, Buffer.from('teste'), {
      key: reconstruida,
      dsaEncoding: 'ieee-p1363',
    });
    assinaFunciona = true;
  } catch (e) {
    erroAssinatura = (e as { code?: string; message?: string }).code
      || (e as { message?: string }).message
      || 'desconhecido';
  }

  // Diagnostico legivel
  let diagnostico = '';
  if (assinaFunciona) {
    diagnostico = 'CHAVE OK - formato aceito pelo Node. O erro esta em outro lugar.';
  } else if (temAspas) {
    diagnostico = 'PROBLEMA: a chave tem ASPAS em volta. Remova as aspas.';
  } else if (!temBegin || !temEnd) {
    diagnostico = 'PROBLEMA: falta o -----BEGIN PRIVATE KEY----- ou o -----END-----. Cole o arquivo inteiro.';
  } else if (temEspacoNoMiolo) {
    diagnostico = 'PROBLEMA: as quebras de linha viraram ESPACOS. Troque cada espaco (fora do BEGIN/END) por \\n.';
  } else if (!temBarraN && !temQuebraReal) {
    diagnostico = 'PROBLEMA: a chave esta em uma linha so, SEM separador. Coloque \\n entre as linhas.';
  } else {
    diagnostico = 'PROBLEMA: formato nao reconhecido. Gere uma chave nova e cole com \\n entre as linhas.';
  }

  return NextResponse.json({
    diagnostico,
    assinaFunciona,
    erroAssinatura,
    formato: {
      tamanho: raw.length,
      temBegin,
      temEnd,
      temBarraNLiteral: temBarraN,
      temQuebraDeLinhaReal: temQuebraReal,
      temAspas,
      temEspacoNoMiolo,
      primeiros40: raw.slice(0, 40),
      ultimos30: raw.slice(-30),
    },
    formatoCorreto: '-----BEGIN PRIVATE KEY-----\\nLINHA1\\nLINHA2\\n-----END PRIVATE KEY-----',
  });
}