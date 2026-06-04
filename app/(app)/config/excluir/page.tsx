'use client';
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
 
type Aviso = { texto: string; tipo: 'erro' | 'ok' } | null;
 
export default function ExcluirContaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [excluindo, setExcluindo] = useState(false);
  const [email, setEmail] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
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
 
  const podeExcluir = confirmacao.trim().toUpperCase() === 'EXCLUIR';
 
  async function handleExcluir() {
    if (!podeExcluir) return;
 
    setExcluindo(true);
    setAviso(null);
 
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setAviso({ texto: 'Sua sessão expirou. Saia e entre novamente.', tipo: 'erro' });
        setExcluindo(false);
        return;
      }
 
      const resp = await fetch('/api/excluir-conta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      const dados = await resp.json();
 
      if (!dados.sucesso) {
        setAviso({
          texto: 'Não foi possível excluir a conta agora. Tente de novo em alguns instantes.',
          tipo: 'erro',
        });
        setExcluindo(false);
        return;
      }
 
      // Sucesso: faz signOut local e manda pra login
      await supabase.auth.signOut();
      router.push('/login');
    } catch {
      setAviso({
        texto: 'A conexão falhou. Verifique sua internet e tente de novo.',
        tipo: 'erro',
      });
      setExcluindo(false);
    }
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
            <p className="text-xs tracking-widest uppercase font-semibold text-[#f1a3a3]">
              Zona de perigo
            </p>
            <h1 className="text-2xl font-bold text-white mt-1">
              Excluir <span className="text-[#f1a3a3]">conta</span>
            </h1>
          </div>
          <a
            href="/config"
            className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium border border-white/10 rounded-full hover:bg-white/5 transition-colors no-underline"
          >
            Voltar
          </a>
        </header>
 
        <div className="rounded-3xl p-6 bg-white/5 border border-white/10 space-y-5">
 
          {/* Aviso forte */}
          <div className="rounded-2xl p-4 bg-red-500/10 border border-red-400/20 text-red-200">
            <p className="text-sm font-bold mb-2">Esta ação é permanente e não pode ser desfeita.</p>
            <p className="text-sm leading-relaxed">
              Ao excluir sua conta da Menta, vamos apagar para sempre:
            </p>
            <ul className="text-sm leading-relaxed mt-2 space-y-1 list-disc list-inside">
              <li>Seu perfil (nome, idade, foto)</li>
              <li>Todas as suas faturas e PDFs enviados</li>
              <li>Todas as análises da IA e categorizações</li>
              <li>Suas notificações</li>
              <li>Seu acesso (você não poderá entrar com este email de novo)</li>
            </ul>
          </div>
 
          <div>
            <p className="text-sm text-white/70 mb-3">
              Conta que será excluída:
            </p>
            <div className="w-full px-4 py-3 rounded-2xl bg-white/5 text-white border border-white/5">
              {email}
            </div>
          </div>
 
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-white/70">
              Para confirmar, digite <span className="text-[#f1a3a3]">EXCLUIR</span> no campo abaixo
            </label>
            <input
              type="text"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder="Digite EXCLUIR"
              autoComplete="off"
              className="w-full px-4 py-3 rounded-2xl bg-white/10 text-white placeholder-white/30 border border-white/10 outline-none focus:border-[#f1a3a3] transition-colors"
            />
          </div>
 
          <button
            onClick={handleExcluir}
            disabled={!podeExcluir || excluindo}
            className="w-full px-6 py-3 rounded-full text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {excluindo ? 'Excluindo...' : 'Excluir minha conta para sempre'}
          </button>
 
          {aviso && (
            <div
              className={`rounded-xl px-4 py-3 text-sm text-center border ${
                aviso.tipo === 'erro'
                  ? 'bg-red-500/10 border-red-400/20 text-red-200'
                  : 'bg-[#7ad9b7]/10 border-[#7ad9b7]/25 text-[#7ad9b7]'
              }`}
            >
              {aviso.texto}
            </div>
          )}
 
        </div>
 
        <a
          href="/config"
          className="block text-center mt-6 text-white/60 hover:text-white text-sm font-medium no-underline"
        >
          Mudei de ideia, voltar
        </a>
      </div>
    </main>
  );
}