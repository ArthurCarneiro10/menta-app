/**
 * API Consultora de Compras (app/api/consultora/route.ts) - BLOCO 2.
 *
 * Recebe os numeros JA CALCULADOS pelo app (o codigo mobile fez a matematica)
 * + contexto do usuario (gastos, metas), e a IA (Haiku via OpenRouter) devolve
 * um conselho em linguagem simples. A IA NUNCA calcula - so interpreta.
 *
 * Respeita o limite Free (a consulta conta como uso, igual analise).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { LIMITE_ANALISES_FREE, contarAnalisesFeitas } from '@/lib/limites';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  try {
    // 1) auth
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ erro: 'sessao', mensagem: 'Sessao invalida.' }, { status: 401 });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ erro: 'sessao', mensagem: 'Sessao invalida.' }, { status: 401 });
    }

    const body = await request.json();
    const { valor, temDinheiro, resumoNumeros, melhorForma } = body || {};
    if (!valor || !resumoNumeros) {
      return NextResponse.json({ erro: 'dados', mensagem: 'Dados incompletos.' }, { status: 400 });
    }

    // 2) plano + limite Free (a consulta conta como uso)
    const { data: perfil } = await supabase
      .from('profiles').select('plano').eq('id', user.id).single();
    const ehFree = perfil?.plano !== 'premium' && perfil?.plano !== 'max';

    if (ehFree) {
      const usadas = await contarAnalisesFeitas(user.id, supabase);
      if (usadas >= LIMITE_ANALISES_FREE) {
        return NextResponse.json(
          { erro: 'limite', mensagem: `Voce usou suas ${LIMITE_ANALISES_FREE} consultas gratuitas.` },
          { status: 403 }
        );
      }
    }

    // 3) contexto do usuario: media de gastos + metas ativas
    let contexto = '';
    try {
      // metas ativas
      const { data: metas } = await supabase
        .from('metas')
        .select('nome, valor_alvo, valor_atual')
        .eq('user_id', user.id)
        .limit(5);
      if (metas && metas.length) {
        const linhas = metas.map((m: { nome: string; valor_alvo: number; valor_atual: number }) =>
          `- ${m.nome}: alvo R$ ${m.valor_alvo}, tem R$ ${m.valor_atual || 0}`);
        contexto += `Metas ativas do usuario:\n${linhas.join('\n')}\n`;
      }

      // media de gastos (das ultimas faturas analisadas)
      const { data: faturas } = await supabase
        .from('faturas')
        .select('total')
        .eq('user_id', user.id)
        .eq('status', 'analisada')
        .order('analisado_em', { ascending: false })
        .limit(3);
      if (faturas && faturas.length) {
        const media = faturas.reduce((s: number, f: { total: number }) => s + (f.total || 0), 0) / faturas.length;
        contexto += `Media de gastos por fatura: aproximadamente R$ ${media.toFixed(0)}.\n`;
      }
    } catch {
      // contexto e opcional - segue sem se falhar
    }

    // 4) monta o prompt e chama a IA (Haiku via OpenRouter)
    const prompt = `Voce e um consultor financeiro pessoal do app Menta, direto e amigavel, em portugues do Brasil.

O usuario quer comprar algo de R$ ${valor}. ${temDinheiro ? 'Ele TEM o valor a vista agora.' : 'Ele NAO tem o valor a vista agora.'}

Os custos de cada forma de pagamento JA FORAM CALCULADOS (nao recalcule, use estes numeros):
${resumoNumeros}

A opcao matematicamente mais barata e: ${melhorForma}.

${contexto ? `Contexto financeiro do usuario:\n${contexto}` : ''}

Escreva um conselho CURTO (3-4 frases), pratico e pessoal. Diga qual forma vale mais a pena e por que, considerando o contexto do usuario (se ele tem metas, se a parcela pesa no orcamento dele). Seja honesto: se parcelar com juros e ruim, diga. Se ele nao tem o dinheiro, oriente com cuidado. Nao invente numeros alem dos fornecidos. Nao use listas, escreva em texto corrido.`;

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
      }),
    });

    if (!resp.ok) {
      return NextResponse.json(
        { erro: 'ia', mensagem: 'Nao foi possivel gerar o conselho agora.' },
        { status: 502 }
      );
    }

    const json = await resp.json();
    const conselho = json?.choices?.[0]?.message?.content?.trim() || '';

    // 5) registra o uso (conta no limite Free) - incrementa o mesmo contador
    //    das analises, via a RPC que ja existe.
    try {
      if (ehFree) {
        await supabase.rpc('incrementar_analises', { uid: user.id });
      }
    } catch {
      // se falhar, nao quebra o conselho
    }

    return NextResponse.json({ conselho });
  } catch (e) {
    console.error('[consultora] erro:', e);
    return NextResponse.json({ erro: 'servidor', mensagem: 'Erro inesperado.' }, { status: 500 });
  }
}