import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { criarConnectToken } from '@/lib/pluggy';
 
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
/**
 * Gera um Connect Token da Pluggy para o usuario logado.
 * O frontend usa esse token no widget Pluggy Connect.
 *
 * Requer:
 *   - Header Authorization: Bearer <jwt>
 *   - Usuario com plano = 'premium'
 */
export async function POST(request: Request) {
  try {
    // 1) Confirma identidade
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
 
    // 2) Confirma plano premium
    const { data: perfil, error: perfilError } = await supabase
      .from('profiles')
      .select('plano')
      .eq('id', user.id)
      .single();
 
    if (perfilError || !perfil) {
      return NextResponse.json(
        { erro: 'Nao foi possivel verificar seu plano.' },
        { status: 500 }
      );
    }
 
    if (perfil.plano !== 'premium') {
      return NextResponse.json(
        { erro: 'Open Finance esta disponivel apenas para contas Premium.' },
        { status: 403 }
      );
    }
 
    // 3) Gera o connect token
    const connectToken = await criarConnectToken(user.id);
 
    return NextResponse.json({
      sucesso: true,
      connectToken,
    });
  } catch (erro) {
    return NextResponse.json(
      { erro: 'Erro ao conectar com a Pluggy: ' + (erro instanceof Error ? erro.message : 'desconhecido') },
      { status: 500 }
    );
  }
}