import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ===== MODELO DE IA =====
const MODELO_IA = 'anthropic/claude-sonnet-4.6';
// =========================

// ===== LIMITE DO CHAT PARA FREE =====
// Premium = ilimitado. Free = ate LIMITE_CHAT_FREE perguntas a cada
// JANELA_HORAS. Janela simples: comeca na 1a pergunta e zera depois do prazo.
// Ajuste estes dois numeros pra afrouxar ou apertar.
const LIMITE_CHAT_FREE = 5;
const JANELA_HORAS = 4;
// ====================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    // ===== SEGURANCA: exige usuario logado =====
    // Antes esta rota era aberta - qualquer um com a URL podia gastar creditos
    // de IA. Agora exige Authorization: Bearer <jwt>, igual /api/analisar.
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json(
        { erro: 'Sessao invalida ou expirada. Entre novamente.' },
        { status: 401 }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { erro: 'Sessao invalida ou expirada. Entre novamente.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const pergunta = body.pergunta;
    const dados = body.dados; // resumo dos gastos que a tela manda

    if (!pergunta) {
      return NextResponse.json({ erro: 'Pergunta nao informada' }, { status: 400 });
    }

    // ===== LIMITE DO CHAT (barreira real, no servidor, antes de gastar IA) =====
    // Premium passa direto. Free entra na contagem por janela.
    const { data: perfil } = await supabase
      .from('profiles')
      .select('plano, chat_contador, chat_janela_inicio')
      .eq('id', user.id)
      .single();

    const ehPremium = perfil?.plano === 'premium' || perfil?.plano === 'max';

    if (!ehPremium) {
      const agora = Date.now();
      const janelaMs = JANELA_HORAS * 60 * 60 * 1000;
      const inicio = perfil?.chat_janela_inicio
        ? new Date(perfil.chat_janela_inicio).getTime()
        : 0;
      const dentroDaJanela = inicio > 0 && agora - inicio < janelaMs;

      if (dentroDaJanela) {
        const usadas = perfil?.chat_contador ?? 0;

        if (usadas >= LIMITE_CHAT_FREE) {
          // Bloqueia e diz quanto falta pra liberar.
          const restanteMin = Math.ceil((janelaMs - (agora - inicio)) / 60000);
          const horas = Math.floor(restanteMin / 60);
          const min = restanteMin % 60;
          const quando =
            horas > 0 ? `${horas}h${min > 0 ? ` ${min}min` : ''}` : `${min}min`;

          return NextResponse.json(
            {
              erro: `Voce usou suas ${LIMITE_CHAT_FREE} perguntas gratuitas. Tente de novo em ${quando}, ou seja Premium para perguntas ilimitadas.`,
              limite_atingido: true,
            },
            { status: 403 }
          );
        }

        // Ainda dentro da janela e com cota: soma +1.
        await supabase
          .from('profiles')
          .update({ chat_contador: usadas + 1 })
          .eq('id', user.id);
      } else {
        // Janela expirada ou primeira pergunta: abre nova janela (contador = 1).
        await supabase
          .from('profiles')
          .update({
            chat_contador: 1,
            chat_janela_inicio: new Date(agora).toISOString(),
          })
          .eq('id', user.id);
      }
    }

    // Monta o prompt com os dados reais do usuario
    const prompt = `Voce e a IA financeira do app Menta, um app brasileiro de controle de gastos. Voce conversa com o usuario sobre os gastos DELE, de forma acolhedora, humana e pratica, em portugues do Brasil.

=== DADOS REAIS DO USUARIO (ultima fatura analisada) ===
${dados}
=== FIM DOS DADOS ===

COMO RESPONDER:
1. Use SEMPRE os numeros exatos dos dados acima. Cite valores em R$ e nomes de lojas/categorias quando ajudar a resposta a ficar concreta.
2. NUNCA invente valores, lojas, datas ou comparacoes. Se o usuario pedir algo que NAO esta nos dados (ex: comparar com o mes passado, saldo da conta, renda), diga com sinceridade que voce so tem os dados desta fatura e nao tem essa informacao ainda.
3. De respostas completas e uteis: explique o numero, de contexto, e quando fizer sentido termine com UMA dica pratica e acionavel. Pode usar de 2 a 6 frases conforme a pergunta pedir. Nao seja seco nem encha linguica.
4. Quando listar gastos, mostre os valores e, se possivel, qual categoria/loja pesou mais.
5. Tom: como um amigo que manja de financas. Acolhedor, nunca julga, nunca da sermao. Pode usar no maximo 1 emoji se combinar.

EXEMPLO de boa resposta (formato, nao copie os numeros):
Pergunta: "Onde eu mais gastei?"
Resposta: "Seu maior gasto foi em Compras, R$ 762,22 — a SHEIN sozinha levou R$ 475,83. Alimentacao veio em segundo, R$ 743. Se quiser uma meta facil pro proximo mes, dar uma segurada nas compras online ja faria boa diferenca. 🌱"

Pergunta do usuario: ${pergunta}`;

    // Chama o OpenRouter
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
      return NextResponse.json({ erro: 'Erro da IA: ' + erroTexto }, { status: 500 });
    }

    const dadosIA = await respostaIA.json();
    const resposta = dadosIA.choices?.[0]?.message?.content || 'Nao consegui responder agora.';

    return NextResponse.json({ sucesso: true, resposta });
  } catch (erro) {
    return NextResponse.json(
      { erro: 'Erro ao processar: ' + (erro instanceof Error ? erro.message : 'desconhecido') },
      { status: 500 }
    );
  }
}