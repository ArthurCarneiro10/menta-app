import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  sugerirGames, criarGame, listarComProgresso, GAMES_PRONTOS,
  reportarDia, gamesParaReportar,
  type TipoGame,
} from '@/lib/games';

export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  return NextResponse.json({ status: 'games endpoint ativo' });
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any = {};
    try { body = await request.json(); } catch { /* sem body */ }
    const acao: string = body?.acao || 'listar';

    const { data: perfil } = await supabase
      .from('profiles').select('plano').eq('id', user.id).maybeSingle();
    const plano = (perfil?.plano as string) || 'free';
    const premium = plano === 'premium' || plano === 'max';

    // GATE: Free nao joga.
    if (!premium) {
      return NextResponse.json({ podeJogar: false });
    }

    let temConexao = false;
    if (plano === 'max') {
      const { count } = await supabase
        .from('connections').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
      temConexao = (count || 0) > 0;
    }

    // ===== REPORTAR (auto-report diario do Premium) =====
    if (acao === 'reportar') {
      const gameId = String(body?.gameId || '').trim();
      const manteve = body?.manteve === true;
      if (!gameId) return NextResponse.json({ erro: 'Game nao informado.' }, { status: 400 });
      const game = await reportarDia(user.id, supabase, gameId, manteve);
      return NextResponse.json({ podeJogar: true, game });
    }

    // ===== DESISTIR =====
    if (acao === 'desistir') {
      const gameId = String(body?.gameId || '').trim();
      if (!gameId) return NextResponse.json({ erro: 'Game nao informado.' }, { status: 400 });
      // So apaga se for do proprio usuario (defesa: filtra por user_id).
      await supabase.from('games').delete().eq('id', gameId).eq('user_id', user.id);
      return NextResponse.json({ podeJogar: true, ok: true });
    }

    // ===== CRIAR =====
    if (acao === 'criar') {
      const tipo = body?.tipo as TipoGame;
      const alvo = String(body?.alvo || '').trim();
      const titulo = String(body?.titulo || '').trim();
      const duracaoDias = Number(body?.duracaoDias) || 15;
      if ((tipo !== 'evitar' && tipo !== 'economizar') || !alvo || !titulo) {
        return NextResponse.json({ erro: 'Game invalido.' }, { status: 400 });
      }
      const game = await criarGame(user.id, supabase, { tipo, alvo, titulo, duracaoDias }, plano, temConexao);
      if (!game) return NextResponse.json({ erro: 'Nao foi possivel criar.' }, { status: 500 });
      return NextResponse.json({ podeJogar: true, game });
    }

    // ===== LISTAR (default) =====
    const games = await listarComProgresso(user.id, supabase, plano, temConexao);
    const ativos = games.filter((g) => g.status === 'ativo');
    const alvosOcupados = ativos.map((g) => g.alvo);
    const sugestoes = await sugerirGames(user.id, supabase, plano, temConexao, alvosOcupados);
    const prontos = GAMES_PRONTOS.filter((p) => !alvosOcupados.includes(p.alvo));
    // Premium reporta manualmente; Max preenche sozinho -> so Premium precisa reportar.
    const reportarHoje = plano === 'max' ? [] : await gamesParaReportar(user.id, supabase);

    return NextResponse.json({
      podeJogar: true,
      plano,
      games,
      sugestoes,
      prontos,
      reportarHoje,
    });
  } catch (erro) {
    console.error('[games] erro:', erro);
    return NextResponse.json(
      { erro: 'Erro: ' + (erro instanceof Error ? erro.message : 'desconhecido') },
      { status: 500 },
    );
  }
}