import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { registrarNota, historicoNota } from '@/lib/nota';

export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Teste rapido no navegador: GET https://app.mentaapp.com.br/api/nota
export async function GET() {
  return NextResponse.json({ status: 'nota endpoint ativo' });
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ erro: 'Sessao invalida.' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ erro: 'Sessao invalida.' }, { status: 401 });
    }

    // Qual acao o app esta reportando: 'abrir' (dashboard) ou 'gastos' (aba Gastos)
    let acao: 'abrir' | 'gastos' = 'abrir';
    let comHistorico = false;
    try {
      const body = await request.json();
      if (body?.acao === 'gastos') acao = 'gastos';
      if (body?.historico === true) comHistorico = true;
    } catch {
      // sem body = 'abrir'
    }

    const { data: perfil } = await supabase
      .from('profiles')
      .select('plano')
      .eq('id', user.id)
      .maybeSingle();
    const plano = (perfil?.plano as string) || 'free';

    let temConexao = false;
    if (plano === 'max') {
      const { count } = await supabase
        .from('connections')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      temConexao = (count || 0) > 0;
    }

    const r = await registrarNota(user.id, supabase, acao, plano, temConexao);

    const premium = plano === 'premium' || plano === 'max';

    // GATE no servidor:
    // Premium/Max -> nota + frase + streak + componentes (o detalhe).
    // Free -> SO o numero + a frase. Sem streak, sem detalhe (o cadeado).
    if (premium) {
      const historico = comHistorico ? await historicoNota(user.id, supabase, 14) : undefined;
      return NextResponse.json({
        bloqueado: false,
        nota: r.nota,
        frase: r.frase,
        streak: r.streak,
        componentes: r.componentes,
        primeiraVezHoje: r.primeiraVezHoje,
        ...(historico ? { historico } : {}),
      });
    }

    return NextResponse.json({
      bloqueado: true,
      nota: r.nota,
      frase: r.frase,
      primeiraVezHoje: r.primeiraVezHoje,
    });
  } catch (erro) {
    console.error('[nota] erro:', erro);
    return NextResponse.json(
      { erro: 'Erro: ' + (erro instanceof Error ? erro.message : 'desconhecido') },
      { status: 500 },
    );
  }
}