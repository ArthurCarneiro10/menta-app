import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ===== MODELO DE IA =====
// Para trocar de modelo no futuro, mude SO esta linha.
// Modelos pagos otimos: 'openai/gpt-4o-mini' ou 'anthropic/claude-3.5-haiku'
const MODELO_IA = 'openrouter/free';
// =========================

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const arquivoPath = body.arquivoPath;
    const faturaId = body.faturaId;

    if (!arquivoPath) {
      return NextResponse.json(
        { erro: 'Caminho do arquivo nao informado' },
        { status: 400 }
      );
    }

    // 1. Baixa o PDF
    const { data: arquivo, error: downloadError } = await supabase.storage
      .from('faturas')
      .download(arquivoPath);

    if (downloadError || !arquivo) {
      return NextResponse.json(
        { erro: 'Nao foi possivel baixar o arquivo: ' + (downloadError?.message || 'desconhecido') },
        { status: 500 }
      );
    }

    // 2. Extrai o texto
    const arrayBuffer = await arquivo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const dados = await pdfParse(buffer);
    const textoFatura = dados.text;

    if (!textoFatura || textoFatura.trim().length < 20) {
      return NextResponse.json(
        { erro: 'O PDF parece nao ter texto legivel (pode ser imagem escaneada).' },
        { status: 422 }
      );
    }

    // 3. Monta o prompt
    const prompt = `Voce e um assistente financeiro. Analise o texto de uma fatura de cartao de credito abaixo.

Responda APENAS com um JSON valido, sem nenhum texto antes ou depois, neste formato exato:
{
  "total": 2143.50,
  "categorias": [
    { "nome": "Alimentacao", "valor": 743.00 }
  ],
  "insight": "uma frase curta e util sobre os gastos, em portugues"
}

Categorias possiveis: Alimentacao, Transporte, Compras, Lazer, Saude, Educacao, Moradia, Servicos, Outros.
Agrupe os gastos nessas categorias. Os valores devem somar aproximadamente o total.

Texto da fatura:
${textoFatura.slice(0, 8000)}`;

    // 4. Chama o OpenRouter
    const respostaIA = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
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
    const conteudo = dadosIA.choices?.[0]?.message?.content || '';

    // 5. Extrai SO o JSON da resposta (limpa texto extra que a IA possa ter colocado)
    const inicio = conteudo.indexOf('{');
    const fim = conteudo.lastIndexOf('}');
    if (inicio === -1 || fim === -1) {
      return NextResponse.json(
        { erro: 'A IA nao retornou um JSON valido', respostaCrua: conteudo },
        { status: 500 }
      );
    }
    const jsonTexto = conteudo.slice(inicio, fim + 1);

    let analise;
    try {
      analise = JSON.parse(jsonTexto);
    } catch {
      return NextResponse.json(
        { erro: 'Nao foi possivel ler o JSON da IA', respostaCrua: conteudo },
        { status: 500 }
      );
    }

    // 6. Salva no banco (se veio o faturaId)
    if (faturaId) {
      await supabase
        .from('faturas')
        .update({
          total: analise.total,
          categorias: analise.categorias,
          insight: analise.insight,
          status: 'analisada',
          analisado_em: new Date().toISOString(),
        })
        .eq('id', faturaId);
    }

    // 7. Retorna a analise
    return NextResponse.json({
      sucesso: true,
      analise,
    });
  } catch (erro) {
    return NextResponse.json(
      { erro: 'Erro ao processar: ' + (erro instanceof Error ? erro.message : 'desconhecido') },
      { status: 500 }
    );
  }
}