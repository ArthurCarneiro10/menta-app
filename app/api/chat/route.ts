import { NextResponse } from 'next/server';

// ===== MODELO DE IA =====
const MODELO_IA = 'anthropic/claude-sonnet-4.6';
// =========================

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pergunta = body.pergunta;
    const dados = body.dados; // resumo dos gastos que a tela manda

    if (!pergunta) {
      return NextResponse.json({ erro: 'Pergunta nao informada' }, { status: 400 });
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