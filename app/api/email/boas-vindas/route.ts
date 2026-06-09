/**
 * POST /api/email/boas-vindas
 *
 * Dispara email de boas-vindas via Resend apos signup.
 *
 * Behavior fail-safe: se RESEND_API_KEY nao estiver definida,
 * retorna sucesso silencioso (sem enviar). Isso permite ambiente
 * de dev funcionar sem a integracao configurada.
 *
 * Em producao, configure:
 *   RESEND_API_KEY       - API key da conta Resend
 *   RESEND_FROM          - opcional, ex: "Menta <boas-vindas@mentaapp.com.br>"
 */
 
import { NextResponse } from 'next/server';
 
const RESEND_FROM_DEFAULT = 'Menta <boas-vindas@mentaapp.com.br>';
const RESEND_FROM_FALLBACK = 'onboarding@resend.dev'; // funciona sem dominio verificado
 
export async function POST(request: Request) {
  try {
    const { email, nome } = await request.json();
 
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ erro: 'Email obrigatorio' }, { status: 400 });
    }
 
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Fail-safe: nao bloqueia signup quando email nao esta configurado.
      console.log('[boas-vindas] RESEND_API_KEY ausente - pulando envio');
      return NextResponse.json({ sucesso: true, enviado: false });
    }
 
    const nomeAmigavel = (nome || '').toString().split(' ')[0] || 'amigo';
    const from = process.env.RESEND_FROM || RESEND_FROM_DEFAULT;
 
    const body = {
      from,
      to: email,
      subject: '🌱 Bem-vindo ao Menta!',
      html: htmlEmail(nomeAmigavel),
    };
 
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
 
    if (!resp.ok) {
      // Se from no dominio falhar (dominio nao verificado), tenta fallback
      const errBody = await resp.text();
      console.error('[boas-vindas] erro Resend:', resp.status, errBody);
 
      // Tenta de novo com remetente generico do Resend
      if (from !== RESEND_FROM_FALLBACK) {
        const retry = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...body, from: RESEND_FROM_FALLBACK }),
        });
        if (retry.ok) {
          return NextResponse.json({ sucesso: true, enviado: true, fallback: true });
        }
      }
 
      // Falhou mas nao bloqueia: signup ja ocorreu
      return NextResponse.json({ sucesso: true, enviado: false });
    }
 
    return NextResponse.json({ sucesso: true, enviado: true });
  } catch (e) {
    console.error('[boas-vindas] erro inesperado:', e);
    // Fail-safe: nao deixa erro de email derrubar fluxo de signup
    return NextResponse.json({ sucesso: true, enviado: false });
  }
}
 
function htmlEmail(nome: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bem-vindo ao Menta</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f0;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
 
          <!-- Header dark -->
          <tr>
            <td style="background:linear-gradient(135deg,#0c2019,#183e31);padding:40px 32px;text-align:center;">
              <h1 style="margin:0;font-size:32px;color:#ffffff;letter-spacing:-0.02em;">
                Menta<span style="color:#7ad9b7;">.</span>
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.6);font-size:14px;">
                Seu dinheiro, no piloto automático
              </p>
            </td>
          </tr>
 
          <!-- Conteudo -->
          <tr>
            <td style="padding:40px 32px;color:#1f2e26;line-height:1.6;">
              <h2 style="margin:0 0 16px;font-size:22px;color:#1f2e26;">
                Bem-vindo, ${escape(nome)}! 🌱
              </h2>
 
              <p style="margin:0 0 24px;color:#4a5d54;">
                Que bom ter você aqui. O Menta vai te ajudar a manter
                a vida financeira em ordem, sem aquele estresse de planilha.
              </p>
 
              <p style="margin:0 0 16px;color:#1f2e26;font-weight:600;">
                Por onde começar:
              </p>
 
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #e5e9e7;">
                    <strong style="color:#1f2e26;">1. Envie uma fatura.</strong>
                    <span style="color:#4a5d54;"> A IA categoriza automaticamente.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #e5e9e7;">
                    <strong style="color:#1f2e26;">2. Conecte um banco (Premium).</strong>
                    <span style="color:#4a5d54;"> Open Finance regulado pelo BCB.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;">
                    <strong style="color:#1f2e26;">3. Veja seu dinheiro em tempo real.</strong>
                    <span style="color:#4a5d54;"> Sem fazer mais nada.</span>
                  </td>
                </tr>
              </table>
 
              <!-- CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:32px;">
                <tr>
                  <td align="center">
                    <a href="https://app.mentaapp.com.br/dashboard"
                       style="display:inline-block;padding:14px 32px;background:#7ad9b7;color:#010302;text-decoration:none;border-radius:999px;font-weight:700;font-size:15px;">
                      Abrir o Menta
                    </a>
                  </td>
                </tr>
              </table>
 
              <!-- Suporte -->
              <p style="margin:32px 0 0;color:#4a5d54;font-size:14px;text-align:center;">
                Dúvidas? Responde esse email ou escreve em
                <a href="mailto:mentaapp.contato@gmail.com" style="color:#3d7d66;">
                  mentaapp.contato@gmail.com
                </a>
              </p>
            </td>
          </tr>
 
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background:#f9faf8;text-align:center;color:#9aa6a1;font-size:12px;">
              <p style="margin:0;">
                Você está recebendo este email porque criou conta em
                <a href="https://app.mentaapp.com.br" style="color:#3d7d66;text-decoration:none;">
                  app.mentaapp.com.br
                </a>
              </p>
              <p style="margin:8px 0 0;">
                <a href="https://app.mentaapp.com.br/termos" style="color:#9aa6a1;margin:0 8px;">Termos</a>
                <a href="https://app.mentaapp.com.br/privacidade" style="color:#9aa6a1;margin:0 8px;">Privacidade</a>
                <a href="https://app.mentaapp.com.br/suporte" style="color:#9aa6a1;margin:0 8px;">Suporte</a>
              </p>
            </td>
          </tr>
 
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
 
function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}