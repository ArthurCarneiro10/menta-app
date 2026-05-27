import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
 
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
// ===== MODELO DE IA =====
// Para trocar de modelo no futuro, mude SO esta linha.
const MODELO_IA = 'anthropic/claude-haiku-4.5';
// =========================
 
type Transacao = { descricao: string; valor: number; categoria: string };
type Categoria = { nome: string; valor: number };
 
// Converte qualquer coisa (numero, "38,90", "R$ 1.234,56") num numero seguro.
function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    let s = v.replace(/[^\d.,-]/g, '').trim();
    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
 
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
 
// ===== RECONCILIACAO =====
// A IA so identifica/classifica. A CONTA e feita aqui no codigo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reconcilia(analise: any) {
  const transacoesBrutas = Array.isArray(analise?.transacoes) ? analise.transacoes : [];
 
  const transacoes: Transacao[] = transacoesBrutas.map((t: Transacao) => ({
    descricao: String(t?.descricao ?? '').trim() || 'Sem descricao',
    valor: round2(num(t?.valor)),
    categoria: String(t?.categoria ?? '').trim() || 'Outros',
  }));
 
  let categorias: Categoria[];
 
  if (transacoes.length > 0) {
    const mapa = new Map<string, number>();
    for (const t of transacoes) {
      mapa.set(t.categoria, (mapa.get(t.categoria) || 0) + t.valor);
    }
    categorias = Array.from(mapa.entries())
      .map(([nome, valor]) => ({ nome, valor: round2(valor) }))
      .sort((a, b) => b.valor - a.valor);
  } else {
    const catBrutas = Array.isArray(analise?.categorias) ? analise.categorias : [];
    categorias = catBrutas
      .map((c: Categoria) => ({
        nome: String(c?.nome ?? 'Outros').trim() || 'Outros',
        valor: round2(num(c?.valor)),
      }))
      .sort((a: Categoria, b: Categoria) => b.valor - a.valor);
  }
 
  const total = round2(categorias.reduce((acc, c) => acc + c.valor, 0));
 
  return {
    total,
    categorias,
    transacoes,
    insight: String(analise?.insight ?? '').trim(),
  };
}
 
export async function POST(request: Request) {
  try {
    // ===== SEGURANCA: 1) confirma quem esta chamando =====
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
 
    if (!token) {
      return NextResponse.json({ erro: 'Sessao invalida ou expirada. Entre novamente.' }, { status: 401 });
    }
 
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ erro: 'Sessao invalida ou expirada. Entre novamente.' }, { status: 401 });
    }
 
    // ===== Le o corpo =====
    const body = await request.json();
    const faturaId = body.faturaId;
 
    if (!faturaId) {
      return NextResponse.json({ erro: 'Fatura nao informada.' }, { status: 400 });
    }
 
    // ===== SEGURANCA: 2) busca a fatura e confirma que e do usuario =====
    const { data: fatura, error: faturaError } = await supabase
      .from('faturas')
      .select('id, user_id, arquivo_path')
      .eq('id', faturaId)
      .single();
 
    if (faturaError || !fatura) {
      return NextResponse.json({ erro: 'Fatura nao encontrada.' }, { status: 404 });
    }
 
    if (fatura.user_id !== user.id) {
      return NextResponse.json({ erro: 'Essa fatura nao pertence a sua conta.' }, { status: 403 });
    }
 
    // ===== SEGURANCA: 3) usa o caminho do BANCO, nunca o que veio do navegador =====
    const arquivoPath = fatura.arquivo_path;
 
    if (!arquivoPath) {
      return NextResponse.json({ erro: 'Arquivo da fatura nao encontrado.' }, { status: 404 });
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
  "transacoes": [
    { "descricao": "iFood", "valor": 38.90, "categoria": "Alimentacao" },
    { "descricao": "Uber", "valor": 22.40, "categoria": "Transporte" }
  ],
  "insight": "uma frase curta e util sobre os gastos, em portugues"
}
 
Categorias possiveis: Alimentacao, Transporte, Compras, Lazer, Saude, Educacao, Moradia, Servicos, Outros.
 
REGRAS IMPORTANTES:
- Liste em "transacoes" CADA compra/gasto individual da fatura, uma por uma.
- Se o mesmo estabelecimento aparece varias vezes (ex: 5 corridas de Uber no mes), liste TODAS, uma linha para cada. NAO junte nem resuma.
- Use ponto como separador decimal (ex: 38.90), nunca virgula.
- Ignore linhas que NAO sao gastos: pagamento da fatura anterior, saldo anterior, estornos/creditos, limite, juros informativos. Liste apenas as COMPRAS.
- Nao precisa calcular totais nem somas: apenas identifique e classifique cada transacao. A soma e feita depois pelo sistema.
 
Texto da fatura:
${textoFatura.slice(0, 8000)}`;
 
    // 4. Chama o OpenRouter
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
    const conteudo = dadosIA.choices?.[0]?.message?.content || '';
 
    // 5. Extrai SO o JSON da resposta
    const inicio = conteudo.indexOf('{');
    const fim = conteudo.lastIndexOf('}');
    if (inicio === -1 || fim === -1) {
      return NextResponse.json(
        { erro: 'A IA nao retornou um JSON valido', respostaCrua: conteudo },
        { status: 500 }
      );
    }
    const jsonTexto = conteudo.slice(inicio, fim + 1);
 
    let analiseBruta;
    try {
      analiseBruta = JSON.parse(jsonTexto);
    } catch {
      return NextResponse.json(
        { erro: 'Nao foi possivel ler o JSON da IA', respostaCrua: conteudo },
        { status: 500 }
      );
    }
 
    // 5.1 RECONCILIA
    const analise = reconcilia(analiseBruta);
 
    // 6. Salva no banco
    await supabase
      .from('faturas')
      .update({
        total: analise.total,
        categorias: analise.categorias,
        transacoes: analise.transacoes,
        insight: analise.insight,
        status: 'analisada',
        analisado_em: new Date().toISOString(),
      })
      .eq('id', faturaId);
 
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