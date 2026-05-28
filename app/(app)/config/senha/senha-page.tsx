'use client';
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
 
type Aviso = { texto: string; tipo: 'erro' | 'ok' } | null;
 
export default function TrocarSenhaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [email, setEmail] = useState('');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [aviso, setAviso] = useState<Aviso>(null);
 
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setEmail(user.email || '');
      setLoading(false);
    }
    init();
  }, [router]);
 
  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
 
    if (!senhaAtual) {
      setAviso({ texto: 'Informe sua senha atual.', tipo: 'erro' });
      return;
    }
    if (novaSenha.length < 6) {
      setAviso({ texto: 'A nova senha precisa ter pelo menos 6 caracteres.', tipo: 'erro' });
      return;
    }
    if (novaSenha !== confirmar) {
      setAviso({ texto: 'A confirmação não bate com a nova senha.', tipo: 'erro' });
      return;
    }
    if (novaSenha === senhaAtual) {
      setAviso({ texto: 'A nova senha precisa ser diferente da atual.', tipo: 'erro' });
      return;
    }
 
    setSalvando(true);
 
    // 1. Confirma a senha atual fazendo um sign-in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: senhaAtual,
    });
 
    if (signInError) {
      setAviso({ texto: 'Senha atual incorreta.', tipo: 'erro' });
      setSalvando(false);
      return;
    }
 
    // 2. Atualiza para a nova senha
    const { error: updateError } = await supabase.auth.updateUser({ password: novaSenha });
 
    if (updateError) {
      setAviso({ texto: 'Não foi possível trocar a senha. Tente de novo.', tipo: 'erro' });
      setSalvando(false);
      return;
    }
 
    setAviso({ texto: 'Senha trocada com sucesso!', tipo: 'ok' });
    setSalvando(false);
    setTimeout(() => router.push('/config'), 1500);
  }
 
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18]">
        <p className="text-white/60">Carregando...</p>
      </main>
    );
  }
 
  return (
    <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] pb-16">
      <div className="max-w-md mx-auto px-5">
        <header className="flex items-center justify-between pt-10 pb-6">
          <div>
            <p className="text-xs tracking-widest uppercase font-semibold text-[#7cdbb9]">
              Segurança
            </p>
            <h1 className="text-2xl font-bold text-white mt-1">
              Trocar <span className="text-[#7ad9b7]">senha</span>
            </h1>
          </div>
          <a
            href="/config"
            className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium border border-white/10 rounded-full hover:bg-white/5 transition-colors no-underline"
          >
            Voltar
          </a>
        </header>
 
        <form onSubmit={handleSalvar} className="rounded-3xl p-6 bg-white/5 border border-white/10 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-[#7cdbb9]">
              Senha atual
            </label>
            <input
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-white/10 text-white placeholder-white/30 border border-white/10 outline-none focus:border-[#7ad9b7] transition-colors"
            />
          </div>
 
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-[#7cdbb9]">
              Nova senha
            </label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Pelo menos 6 caracteres"
              className="w-full px-4 py-3 rounded-2xl bg-white/10 text-white placeholder-white/30 border border-white/10 outline-none focus:border-[#7ad9b7] transition-colors"
            />
          </div>
 
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-[#7cdbb9]">
              Confirmar nova senha
            </label>
            <input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-white/10 text-white placeholder-white/30 border border-white/10 outline-none focus:border-[#7ad9b7] transition-colors"
            />
          </div>
 
          <button
            type="submit"
            disabled={salvando}
            className="w-full px-6 py-3 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors disabled:opacity-50"
          >
            {salvando ? 'Trocando...' : 'Salvar nova senha'}
          </button>
 
          {aviso && (
            <div className={`rounded-xl px-4 py-3 text-sm text-center border ${
              aviso.tipo === 'erro'
                ? 'bg-red-500/10 border-red-400/20 text-red-200'
                : 'bg-[#7ad9b7]/10 border-[#7ad9b7]/25 text-[#7ad9b7]'
            }`}>
              {aviso.texto}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}