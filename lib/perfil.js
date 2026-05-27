import { supabase } from '@/lib/supabase';
 
// Busca o perfil do usuario. Se nao existir ainda, cria um vazio
// e gera uma notificacao de boas-vindas.
export async function getOuCriaPerfil(userId) {
  const { data: existente } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
 
  if (existente) return existente;
 
  const { data: novo } = await supabase
    .from('profiles')
    .insert({ id: userId })
    .select()
    .single();
 
  // Boas-vindas: cria uma notificacao na primeira vez que o perfil e criado.
  if (novo) {
    await supabase.from('notificacoes').insert({
      user_id: userId,
      tipo: 'boas_vindas',
      titulo: 'Bem-vindo à Menta!',
      mensagem:
        'Que bom ter você por aqui. Envie sua primeira fatura para a IA categorizar seus gastos automaticamente.',
    });
  }
 
  return novo;
}
 
// Salva mudancas no perfil (nome, idade, foto_url)
export async function salvaPerfil(userId, dados) {
  const { data, error } = await supabase
    .from('profiles')
    .update(dados)
    .eq('id', userId)
    .select()
    .single();
 
  return { data, error };
}