import { supabase } from '@/lib/supabase';

// Busca o perfil do usuario. Se nao existir ainda, cria um vazio.
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