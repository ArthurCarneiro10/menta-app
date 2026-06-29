/**
 * Email de "limite atingido" (conversao).
 *
 * Disparado quando um usuario Free bate o limite (chat ou analise). E o motor
 * de conversao no iOS: como nao ha venda dentro do app, o email (que e FORA do
 * app) pode levar o usuario ao site pra assinar com Pix, sem problema com a Apple.
 *
 * DE-DUP: so envia se nunca enviou, ou se o ultimo envio foi ha mais de
 * DIAS_REENVIO dias. Usa profiles.email_limite_enviado_em. Sem isso, o chat
 * (que reseta a cada 4h) mandaria email o tempo todo.
 *   Rode antes no Supabase (SQL Editor):
 *   alter table profiles add column if not exists email_limite_enviado_em timestamptz;
 *
 * FAIL-SAFE: qualquer erro aqui NUNCA derruba o fluxo que chamou (so loga).
 *
 * Mesmo padrao do /api/email/boas-vindas: Resend via fetch, remetente do dominio
 * com fallback pro remetente generico do Resend.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const RESEND_FROM_DEFAULT = 'Menta <boas-vindas@mentaapp.com.br>';
const RESEND_FROM_FALLBACK = 'onboarding@resend.dev';
const DIAS_REENVIO = 7;
const LINK_PLANOS = 'https://app.mentaapp.com.br/planos';

export async function enviarEmailLimiteSeNecessario(
  supabase: SupabaseClient,
  userId: string,
  email: string | undefined | null,
): Promise<void> {
  try {
    if (!email) return;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log('[email-limite] RESEND_API_KEY ausente - pulando envio');
      return;
    }

    // De-dup: pega nome + ultimo envio
    const { data: perfil } = await supabase
      .from('profiles')
      .select('nome, email_limite_enviado_em')
      .eq('id', userId)
      .maybeSingle();

    const ultimo = perfil?.email_limite_enviado_em
      ? new Date(perfil.email_limite_enviado_em).getTime()
      : 0;
    const diasDesde = (Date.now() - ultimo) / (1000 * 60 * 60 * 24);
    if (ultimo && diasDesde < DIAS_REENVIO) {
      return; // ja enviou recentemente, nao spamma
    }

    const nome = (perfil?.nome || '').toString().split(' ')[0] || 'amigo';
    const from = process.env.RESEND_FROM || RESEND_FROM_DEFAULT;

    const body = {
      from,
      to: email,
      subject: 'Voce chegou no limite do Menta Free',
      html: htmlEmail(nome),
    };

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    let enviado = resp.ok;

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('[email-limite] erro Resend:', resp.status, errBody);
      // Tenta com remetente generico do Resend (dominio nao verificado)
      if (from !== RESEND_FROM_FALLBACK) {
        const retry = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, from: RESEND_FROM_FALLBACK }),
        });
        enviado = retry.ok;
      }
    }

    // Marca o envio pra respeitar o de-dup (so se realmente enviou)
    if (enviado) {
      await supabase
        .from('profiles')
        .update({ email_limite_enviado_em: new Date().toISOString() })
        .eq('id', userId);
    }
  } catch (e) {
    console.error('[email-limite] erro inesperado:', e);
    // Fail-safe: nunca derruba o fluxo que chamou
  }
}

function htmlEmail(nome: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Voce chegou no limite do Menta Free</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f0;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header dark -->
          <tr>
            <td style="background:linear-gradient(135deg,#0c2019,#183e31);padding:40px 32px;text-align:center;">
              <img src="https://app.mentaapp.com.br/menta-logo-completa.png"
                   alt="Menta"
                   width="220"
                   style="display:inline-block;max-width:220px;height:auto;border:0;outline:none;">
              <p style="margin:12px 0 0;color:rgba(255,255,255,0.6);font-size:14px;">
                Seu dinheiro, no piloto automático
              </p>
            </td>
          </tr>

          <!-- Conteudo -->
          <tr>
            <td style="padding:40px 32px;color:#1f2e26;line-height:1.6;">
              <h2 style="margin:0 0 16px;font-size:22px;color:#1f2e26;">
                Você está tirando bom proveito do Menta, ${escape(nome)} 👏
              </h2>

              <p style="margin:0 0 24px;color:#4a5d54;">
                Você chegou no limite do plano gratuito. Pra continuar sem
                interrupção — análises e perguntas pra IA à vontade — é só
                fazer o upgrade. Dá pra pagar no <strong>Pix</strong>.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #e5e9e7;">
                    <strong style="color:#1f2e26;">Premium</strong>
                    <span style="color:#4a5d54;"> — análises de fatura e IA ilimitadas.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;">
                    <strong style="color:#1f2e26;">Max</strong>
                    <span style="color:#4a5d54;"> — tudo do Premium e ainda conecta seus bancos (Open Finance), com saldo e transações automáticos.</span>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:32px;">
                <tr>
                  <td align="center">
                    <a href="${LINK_PLANOS}"
                       style="display:inline-block;padding:14px 32px;background:#7ad9b7;color:#010302;text-decoration:none;border-radius:999px;font-weight:700;font-size:15px;">
                      Ver planos
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;color:#9aa6a1;font-size:13px;text-align:center;">
                Sem fidelidade. Cancele quando quiser.
              </p>

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
                Você está recebendo este email porque tem conta em
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