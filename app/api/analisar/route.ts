import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { LIMITE_ANALISES_FREE, contarAnalisesFeitas } from '@/lib/limites';
import { analisarTextoFatura, analisarFaturaVisao } from '@/lib/analise-fatura';
import { enviarEmailLimiteSeNecessario } from '@/lib/email-limite';

// Permite ate 60s de execucao (plano Hobby). A rota faz download + pdf-parse
// + chamada de IA em sequencia, que pode passar do limite padrao.
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Teto de tamanho do PDF (defesa em profundidade; o cliente ja valida antes).
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

type Categoria = { nome: string; valor: number };

// Formata numero como R$ 1.234,56 (usado na deteccao de gasto fora do padrao)
function reais(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

    const body = await request.json();
    const faturaId = body.faturaId;

    if (!faturaId) {
      return NextResponse.json({ erro: 'Fatura nao informada.' }, { status: 400 });
    }

    // ===== SEGURANCA: 2) busca a fatura e confirma que e do usuario =====
    const { data: fatura, error: faturaError } = await supabase
      .from('faturas')
      .select('id, user_id, arquivo_path, nome_original, analisado_em')
      .eq('id', faturaId)
      .single();

    if (faturaError || !fatura) {
      return NextResponse.json({ erro: 'Fatura nao encontrada.' }, { status: 404 });
    }

    if (fatura.user_id !== user.id) {
      return NextResponse.json({ erro: 'Essa fatura nao pertence a sua conta.' }, { status: 403 });
    }

    // Primeira analise dessa fatura? (analisado_em vazio = sim)
    const ehReanalise = !!fatura.analisado_em;

    // ===== LIMITE DO TIER FREE (barreira real, antes de gastar IA) =====
    const { data: perfil } = await supabase
      .from('profiles')
      .select('plano')
      .eq('id', user.id)
      .single();

    if (perfil?.plano !== 'premium' && perfil?.plano !== 'max' && !ehReanalise) {
      const jaAnalisadas = await contarAnalisesFeitas(user.id, supabase);
      if (jaAnalisadas >= LIMITE_ANALISES_FREE) {
        await enviarEmailLimiteSeNecessario(supabase, user.id, user.email);
        return NextResponse.json(
          {
            erro: `Voce usou suas ${LIMITE_ANALISES_FREE} analises gratuitas.`,
            limite_atingido: true,
          },
          { status: 403 }
        );
      }
    }

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

    // 1b. Defesa em profundidade: rejeita arquivo grande demais antes de processar
    if (arquivo.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { erro: 'O arquivo e muito grande. O limite e de 10 MB.' },
        { status: 413 }
      );
    }

    // 2. Extrai o texto
    const arrayBuffer = await arquivo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const dados = await pdfParse(buffer);
    const textoFatura = dados.text;

    // PDF tem texto selecionavel? Se nao (fatura escaneada/foto), a gente
    // NAO rejeita mais - cai pro caminho de visao do Claude.
    const temTextoLegivel = !!textoFatura && textoFatura.trim().length >= 20;

    // 3. Analisa.
    //    - Com texto: caminho padrao (rapido/barato).
    //    - Sem texto (escaneada): visao do Claude le a imagem do PDF.
    let analise;
    try {
      if (temTextoLegivel) {
        analise = await analisarTextoFatura(textoFatura);
      } else {
        const base64Pdf = buffer.toString('base64');
        analise = await analisarFaturaVisao(base64Pdf);
      }
    } catch (e) {
      return NextResponse.json(
        { erro: e instanceof Error ? e.message : 'Falha na analise da IA' },
        { status: 500 }
      );
    }

    // 4. Salva no banco
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

    // 4b. CONTADOR VITALICIO: incrementa +1 SO se foi a primeira analise dessa fatura.
    if (!ehReanalise) {
      try {
        const { error: incError } = await supabase.rpc('incrementar_analises', {
          uid: user.id,
        });
        if (incError) {
          console.error('[analisar] erro incrementando analises_vitalicias:', incError);
        }
      } catch (e) {
        console.error('[analisar] excecao incrementando contador:', e);
      }
    }

    // 5. Notificacao de fatura analisada (com o insight como mensagem)
    await supabase.from('notificacoes').insert({
      user_id: user.id,
      tipo: 'fatura_analisada',
      titulo: 'Fatura analisada com sucesso',
      mensagem: analise.insight || 'Sua fatura foi processada e categorizada pela IA.',
    });

    // 6. GASTO FORA DO PADRAO
    try {
      const { data: anterioresArray } = await supabase
        .from('faturas')
        .select('categorias, criado_em')
        .eq('user_id', user.id)
        .not('analisado_em', 'is', null)
        .neq('id', faturaId)
        .order('criado_em', { ascending: false })
        .limit(1);

      const anterior = anterioresArray?.[0];
      const categoriasAnteriores = Array.isArray(anterior?.categorias) ? anterior.categorias : null;

      if (categoriasAnteriores) {
        const mapaAnterior = new Map<string, number>();
        for (const c of categoriasAnteriores as Categoria[]) {
          if (c?.nome && typeof c.valor === 'number') {
            mapaAnterior.set(c.nome, c.valor);
          }
        }

        type Spike = { categoria: string; pct: number; novoValor: number; anteriorValor: number; diff: number };
        const spikes: Spike[] = [];

        for (const c of analise.categorias) {
          const ant = mapaAnterior.get(c.nome) || 0;
          const diff = c.valor - ant;

          const subiuMuito = ant > 0 ? (diff / ant) >= 0.5 : c.valor >= 50;
          const aumentoRelevante = diff >= 50;

          if (subiuMuito && aumentoRelevante) {
            const pct = ant > 0 ? Math.round((diff / ant) * 100) : 0;
            spikes.push({ categoria: c.nome, pct, novoValor: c.valor, anteriorValor: ant, diff });
          }
        }

        spikes.sort((a, b) => b.diff - a.diff);
        const topSpikes = spikes.slice(0, 3);

        if (topSpikes.length > 0) {
          const partes = topSpikes.map((s) => {
            if (s.anteriorValor === 0) {
              return `${s.categoria}: novo gasto de R$ ${reais(s.novoValor)}`;
            }
            return `${s.categoria}: subiu ${s.pct}% (R$ ${reais(s.novoValor)})`;
          });

          const titulo = topSpikes.length === 1
            ? 'Um gasto subiu bastante este mes'
            : 'Alguns gastos dispararam este mes';

          await supabase.from('notificacoes').insert({
            user_id: user.id,
            tipo: 'gasto_disparou',
            titulo,
            mensagem: partes.join(' \u00b7 '),
          });
        }
      }
    } catch (e) {
      console.error('Falha ao detectar gasto fora do padrao:', e);
    }

    // 7. Retorna a analise (truncado avisa a UI se a fatura foi cortada)
    return NextResponse.json({
      sucesso: true,
      analise,
      truncado: analise.truncado,
    });
  } catch (erro) {
    return NextResponse.json(
      { erro: 'Erro ao processar: ' + (erro instanceof Error ? erro.message : 'desconhecido') },
      { status: 500 }
    );
  }
}