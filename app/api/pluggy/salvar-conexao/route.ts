import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getItem } from '@/lib/pluggy';
 
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
/**
 * Salva uma conexao Pluggy no nosso banco apos o widget Connect ser concluido.
 *
 * Recebe { itemId } e:
 *   1. Confirma identidade do chamador
 *   2. Confirma plano premium
 *   3. Busca o Item na Pluggy (validacao server-side)
 *   4. Verifica que o Item realmente pertence ao usuario (via clientUserId)
 *   5. Faz upsert em connections
 */
export async function POST(request: Request) {
  try {
    // 1) Auth
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ erro: 'Sessao invalida ou expirada.' }, { status: 401 });
    }
 
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ erro: 'Sessao invalida ou expirada.' }, { status: 401 });
    }
 
    // 2) Premium
    const { data: perfil } = await supabase
      .from('profiles')
      .select('plano')
      .eq('id', user.id)
      .single();
 
    if (perfil?.plano !== 'premium') {
      return NextResponse.json(
        { erro: 'Open Finance esta disponivel apenas para contas Premium.' },
        { status: 403 }
      );
    }
 
    // 3) Recebe itemId
    const body = await request.json();
    const itemId = body?.itemId;
    if (!itemId || typeof itemId !== 'string') {
      return NextResponse.json({ erro: 'itemId nao informado.' }, { status: 400 });
    }
 
    // 4) Busca o Item na Pluggy (validacao server-side)
    const item = await getItem(itemId);
 
    // 5) Verifica que o Item realmente pertence ao usuario
    //    A Pluggy associou o Item ao nosso user.id via clientUserId quando geramos o connect token
    if (item.clientUserId && item.clientUserId !== user.id) {
      return NextResponse.json(
        { erro: 'Essa conexao nao pertence a sua conta.' },
        { status: 403 }
      );
    }
 
    // 6) Upsert no banco
    const { error: upsertError } = await supabase
      .from('connections')
      .upsert({
        user_id: user.id,
        pluggy_item_id: item.id,
        connector_id: item.connector?.id ?? null,
        connector_name: item.connector?.name ?? 'Banco',
        connector_image_url: item.connector?.imageUrl ?? null,
        status: item.status ?? 'UPDATED',
        last_updated_at: item.updatedAt ?? new Date().toISOString(),
        erro: null,
      }, { onConflict: 'user_id,pluggy_item_id' });
 
    if (upsertError) {
      return NextResponse.json(
        { erro: 'Erro ao salvar conexao: ' + upsertError.message },
        { status: 500 }
      );
    }
 
    return NextResponse.json({
      sucesso: true,
      conexao: {
        pluggyItemId: item.id,
        bancoNome: item.connector?.name,
        status: item.status,
      },
    });
  } catch (erro) {
    return NextResponse.json(
      { erro: 'Erro: ' + (erro instanceof Error ? erro.message : 'desconhecido') },
      { status: 500 }
    );
  }
}