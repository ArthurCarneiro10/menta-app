import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  return NextResponse.json({ status: 'ranking endpoint ativo' });
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ erro: 'Sessao invalida.' }, { status: 401 });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ erro: 'Sessao invalida.' }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any = {};
    try { body = await request.json(); } catch { /* sem body */ }
    const acao: string = body?.acao || 'ver';

    // Acoes de opt-in da comunidade
    if (acao === 'entrar') {
      const apelido = String(body?.apelido || '').trim().slice(0, 20) || 'Anonimo';
      await supabase.from('profiles').update({ comunidade_optin: true, apelido }).eq('id', user.id);
    } else if (acao === 'sair') {
      await supabase.from('profiles').update({ comunidade_optin: false }).eq('id', user.id);
    }

    // Perfil (apos possivel acao)
    const { data: p } = await supabase
      .from('profiles').select('pontuacao, apelido, comunidade_optin').eq('id', user.id).maybeSingle();
    const pontuacao = Number(p?.pontuacao || 0);
    const optin = !!p?.comunidade_optin;

    // Stats pessoais (todos)
    const { count: gamesCompletos } = await supabase
      .from('games').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'completo');
    const { data: medRows } = await supabase.from('medalhas').select('codigo').eq('user_id', user.id);
    const medalhas = (medRows || []).map((m: { codigo: string }) => m.codigo);
    const { data: notaRow } = await supabase
      .from('nota_diaria').select('streak').eq('user_id', user.id)
      .order('dia', { ascending: false }).limit(1).maybeSingle();
    const streak = Number(notaRow?.streak || 0);

    const pessoal = {
      pontuacao,
      gamesCompletos: gamesCompletos || 0,
      medalhasCount: medalhas.length,
      medalhas,
      streak,
    };

    // Social: so pra quem deu opt-in. Ranqueia por pontuacao (constancia).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let social: any = null;
    if (optin) {
      const { data: top } = await supabase
        .from('profiles').select('apelido, pontuacao')
        .eq('comunidade_optin', true)
        .order('pontuacao', { ascending: false })
        .limit(20);
      const { count: acima } = await supabase
        .from('profiles').select('id', { count: 'exact', head: true })
        .eq('comunidade_optin', true).gt('pontuacao', pontuacao);
      social = {
        top: (top || []).map((t: { apelido: string | null; pontuacao: number | null }) => ({
          apelido: t.apelido || 'Anonimo',
          pontuacao: Number(t.pontuacao || 0),
        })),
        posicao: (acima || 0) + 1,
      };
    }

    return NextResponse.json({ optin, apelido: p?.apelido || null, pessoal, social });
  } catch (erro) {
    console.error('[ranking] erro:', erro);
    return NextResponse.json(
      { erro: 'Erro: ' + (erro instanceof Error ? erro.message : 'desconhecido') },
      { status: 500 },
    );
  }
}