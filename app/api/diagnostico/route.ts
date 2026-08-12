import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { gerarDiagnostico } from '@/lib/diagnostico';

// Gera diagnostico com IA quando precisa -> pode passar do timeout padrao.
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    // ===== quem esta chamando =====
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ erro: 'Sessao invalida.' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ erro: 'Sessao invalida.' }, { status: 401 });
    }

    // O app pode pedir regeneracao manual (botao "Atualizar", so Premium/Max).
    let atualizar = false;
    try {
      const body = await request.json();
      atualizar = body?.atualizar === true;
    } catch {
      // sem body = tudo bem
    }

    // ===== estado atual (plano + cache) =====
    const { data: perfil } = await supabase
      .from('profiles')
      .select('plano, diagnostico_json, diagnostico_gerado_em')
      .eq('id', user.id)
      .maybeSingle();

    const plano = (perfil?.plano as string) || 'free';
    const premium = plano === 'premium' || plano === 'max';

    // Fonte que o usuario DEVERIA ver agora: Max com banco conectado usa banco;
    // qualquer outro caso usa a fatura PDF.
    let temConexao = false;
    if (plano === 'max') {
      const { count } = await supabase
        .from('connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      temConexao = (count || 0) > 0;
    }
    const fonteEsperada = plano === 'max' && temConexao ? 'banco' : 'fatura';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let diag: any = perfil?.diagnostico_json || null;
    const geradoEm = perfil?.diagnostico_gerado_em as string | null;

    // ===== o cache esta velho? (fatura nova depois do cache) =====
    let faturaNova = false;
    if (geradoEm) {
      const { data: ult } = await supabase
        .from('faturas')
        .select('analisado_em')
        .eq('user_id', user.id)
        .eq('status', 'analisada')
        .order('analisado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ult?.analisado_em && new Date(ult.analisado_em) > new Date(geradoEm)) {
        faturaNova = true;
      }
    }

    // ===== decide se regenera =====
    const precisaGerar =
      (atualizar && premium) ||                 // botao Atualizar
      !diag ||                                  // nunca gerado
      faturaNova ||                             // gasto mudou desde o ultimo
      (diag && diag.fonte !== fonteEsperada);   // fonte mudou (ex: conectou banco)

    if (precisaGerar) {
      try {
        const novo = await gerarDiagnostico(user.id, supabase);
        diag = novo; // pode vir null se nao ha gasto
      } catch (e) {
        console.error('[diagnostico] falha gerando:', e);
        // se ja tinha cache, segue com ele; senao, cai no sem_dados abaixo
      }
    }

    // ===== sem gasto nenhum ainda =====
    if (!diag || !diag.resumo) {
      return NextResponse.json({ sem_dados: true });
    }

    // ===== gate free/premium NO SERVIDOR =====
    if (premium) {
      return NextResponse.json({
        sem_dados: false,
        bloqueado: false,
        resumo: diag.resumo,
        insights: Array.isArray(diag.insights) ? diag.insights : [],
        recomendacao: diag.recomendacao || '',
        gerado_em: geradoEm,
      });
    }

    // FREE: recebe SO a frase-ancora. Nunca os insights/recomendacao.
    return NextResponse.json({
      sem_dados: false,
      bloqueado: true,
      resumo: diag.resumo,
    });
  } catch (erro) {
    return NextResponse.json(
      { erro: 'Erro: ' + (erro instanceof Error ? erro.message : 'desconhecido') },
      { status: 500 }
    );
  }
}