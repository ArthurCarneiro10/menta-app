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
 
  // Boas-vindas: cria notificacao na primeira vez que o perfil e criado.
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
 
// Faz upload da foto de perfil e atualiza profile.foto_url.
// Limpa avatares antigos antes pra deixar so um por usuario no storage.
export async function salvaFoto(userId, file) {
  // 1. Lista o que ja tem na pasta do usuario e apaga (mantem so um avatar)
  const { data: existentes } = await supabase.storage
    .from('avatares')
    .list(userId);
 
  if (existentes && existentes.length > 0) {
    const paths = existentes.map((f) => `${userId}/${f.name}`);
    await supabase.storage.from('avatares').remove(paths);
  }
 
  // 2. Sobe o novo arquivo
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/avatar.${ext}`;
 
  const { error: uploadError } = await supabase.storage
    .from('avatares')
    .upload(path, file, { upsert: true, contentType: file.type });
 
  if (uploadError) return { url: null, error: uploadError };
 
  // 3. Pega a URL publica e adiciona um timestamp pra evitar cache antigo
  const { data: pub } = supabase.storage.from('avatares').getPublicUrl(path);
  const url = `${pub.publicUrl}?t=${Date.now()}`;
 
  // 4. Salva a URL no perfil
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ foto_url: url })
    .eq('id', userId);
 
  return { url, error: updateError };
}