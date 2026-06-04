'use client';
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { getOuCriaPerfil } from '@/lib/perfil';
 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PluggyConnect = dynamic<any>(
  () => import('react-pluggy-connect').then((m) => m.PluggyConnect),
  { ssr: false }
);
 
type Aviso = { texto: string; tipo: 'erro' | 'ok' | 'info' } | null;
 
export default function ConectarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plano, setPlano] = useState<'free' | 'premium'>('free');
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [gerandoToken, setGerandoToken] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
 
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const perfil = await getOuCriaPerfil(user.id);
      if (perfil?.plano === 'premium') setPlano('premium');
      setLoading(false);
    }
    init();
  }, [router]);
 
  async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }
 
  async function abrirWidget() {
    setGerandoToken(true);
    setAviso(null);
 
    try {
      const token = await getAuthToken();
      if (!token) {
        setAviso({ texto: 'Sessão expirou. Saia e entre de novo.', tipo: 'erro' });
        setGerandoToken(false);
        return;
      }
 
      const resp = await fetch('/api/pluggy/conectar', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
      });
      const dados = await resp.json();
 
      if (!dados.sucesso || !dados.connectToken) {
        setAviso({
          texto: dados.erro || 'Não foi possível iniciar a conexão.',
          tipo: 'erro',
        });
        setGerandoToken(false);
        return;
      }
 
      setConnectToken(dados.connectToken);
    } catch {
      setAviso({ texto: 'Conexão falhou. Verifique sua internet.', tipo: 'erro' });
    }
    setGerandoToken(false);
  }
 
  async function sincronizar(itemId?: string) {
    setSincronizando(true);
    setAviso({ texto: 'Importando transações dos últimos 90 dias...', tipo: 'info' });
 
    try {
      const token = await getAuthToken();
      if (!token) {
        setAviso({ texto: 'Sessão expirou. Saia e entre de novo.', tipo: 'erro' });
        setSincronizando(false);
        return;
      }
 
      const resp = await fetch('/api/pluggy/sincronizar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify(itemId ? { itemId } : {}),
      });
      const dados = await resp.json();
 
      if (!dados.sucesso) {
        setAviso({
          texto: dados.erro || 'Erro ao sincronizar transações.',
          tipo: 'erro',
        });
        setSincronizando(false);
        return false;
      }
 
      const partes: string[] = [];
      if (dados.totalContas > 0) partes.push(`${dados.totalContas} conta(s)`);
      if (dados.totalTransacoes > 0) partes.push(`${dados.totalTransacoes} transação(ões)`);
 
      const resumo = partes.length > 0 ? partes.join(' e ') : 'nada novo';
 
      setAviso({
        texto: `Sincronização concluída! ${resumo} atualizadas.`,
        tipo: 'ok',
      });
      setSincronizando(false);
      return true;
    } catch {
      setAviso({ texto: 'Erro na sincronização. Tente de novo.', tipo: 'erro' });
      setSincronizando(false);
      return false;
    }
  }
 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function onPluggyConnectSuccess(itemData: any) {
    setConnectToken(null);
    setAviso({ texto: 'Salvando conexão...', tipo: 'info' });
 
    const itemId = itemData?.item?.id || itemData?.id;
    if (!itemId) {
      setAviso({ texto: 'Conexão retornou sem identificador. Tente de novo.', tipo: 'erro' });
      return;
    }
 
    try {
      const token = await getAuthToken();
 
      // 1) Salva a conexao no nosso banco
      const resp = await fetch('/api/pluggy/salvar-conexao', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ itemId }),
      });
      const dados = await resp.json();
 
      if (!dados.sucesso) {
        setAviso({ texto: dados.erro || 'Erro ao salvar conexão.', tipo: 'erro' });
        return;
      }
 
      // 2) Sincroniza imediatamente as transacoes dessa conexao
      const sucessoSync = await sincronizar(itemId);
 
      if (sucessoSync) {
        setTimeout(() => router.push('/dashboard'), 2000);
      }
    } catch {
      setAviso({ texto: 'Erro ao salvar conexão. Tente de novo.', tipo: 'erro' });
    }
  }
 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onPluggyConnectError(error: any) {
    console.error('Pluggy Connect erro:', error);
    setConnectToken(null);
    setAviso({ texto: 'Algo deu errado durante a conexão. Tente novamente.', tipo: 'erro' });
  }
 
  function onPluggyConnectClose() {
    setConnectToken(null);
  }
 
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18]">
        <p className="text-white/60">Carregando...</p>
      </main>
    );
  }
 
  // Gate Premium
  if (plano !== 'premium') {
    return (
      <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] p-6">
        <div className="max-w-md mx-auto pt-16">
          <header className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-white">
              Open <span className="text-[#7ad9b7]">Finance</span>
            </h1>
            <a
              href="/dashboard"
              className="text-white/70 hover:text-white text-sm font-medium border border-white/10 rounded-full px-4 py-2 no-underline"
            >
              Voltar
            </a>
          </header>
 
          <div className="rounded-3xl p-8 bg-white/5 border border-white/10 text-center">
            <div className="w-16 h-16 mx-auto rounded-full grid place-items-center bg-[#7ad9b7]/20 text-[#7ad9b7] mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Recurso Premium</h2>
            <p className="text-white/60 text-sm mb-6 leading-relaxed">
              Open Finance está disponível apenas para contas Premium. Em breve você vai poder fazer upgrade direto pelo app.
            </p>
            <a
              href="/dashboard"
              className="inline-block px-6 py-3 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors no-underline"
            >
              Entendi
            </a>
          </div>
        </div>
      </main>
    );
  }
 
  const ocupado = gerandoToken || sincronizando;
 
  return (
    <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] p-6">
      <div className="max-w-md mx-auto">
        <header className="flex items-center justify-between mb-8 pt-8">
          <div>
            <p className="text-xs tracking-widest uppercase font-semibold text-[#7cdbb9]">
              Premium
            </p>
            <h1 className="text-2xl font-bold text-white mt-1">
              Open <span className="text-[#7ad9b7]">Finance</span>
            </h1>
          </div>
          <a
            href="/dashboard"
            className="text-white/70 hover:text-white text-sm font-medium border border-white/10 rounded-full px-4 py-2 no-underline"
          >
            Voltar
          </a>
        </header>
 
        <div className="rounded-3xl p-8 bg-white/5 border border-white/10">
          <div className="w-14 h-14 rounded-full grid place-items-center bg-[#7ad9b7]/20 text-[#7ad9b7] mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7h18M3 12h18M3 17h18" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Conecte seu banco</h2>
          <p className="text-white/60 text-sm mb-6 leading-relaxed">
            A Menta puxa todas as transações da sua conta direto do seu banco, com segurança via Open Finance. Diga adeus aos PDFs.
          </p>
 
          <div className="space-y-3 mb-6">
            <Beneficio>Sincronização automática</Beneficio>
            <Beneficio>Histórico completo de transações</Beneficio>
            <Beneficio>Principais bancos do Brasil</Beneficio>
          </div>
 
          <button
            onClick={abrirWidget}
            disabled={ocupado}
            className="w-full px-6 py-3.5 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors disabled:opacity-50"
          >
            {gerandoToken ? 'Preparando...' : 'Conectar conta bancária'}
          </button>
 
          <button
            onClick={() => sincronizar()}
            disabled={ocupado}
            className="w-full mt-3 px-6 py-3 rounded-full text-sm font-semibold bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {sincronizando ? 'Sincronizando...' : 'Sincronizar transações agora'}
          </button>
 
          {aviso && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm text-center border ${
                aviso.tipo === 'erro'
                  ? 'bg-red-500/10 border-red-400/20 text-red-200'
                  : aviso.tipo === 'ok'
                  ? 'bg-[#7ad9b7]/10 border-[#7ad9b7]/25 text-[#7ad9b7]'
                  : 'bg-white/5 border-white/10 text-white/70'
              }`}
            >
              {aviso.texto}
            </div>
          )}
        </div>
 
        <div className="mt-6 rounded-2xl p-4 bg-white/5 border border-white/10">
          <p className="text-white/40 text-xs leading-relaxed">
            <strong className="text-white/60">Modo desenvolvimento:</strong> esta versão usa bancos sandbox da Pluggy. Em produção, os bancos reais aparecem.
          </p>
        </div>
      </div>
 
      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={true}
          onSuccess={onPluggyConnectSuccess}
          onError={onPluggyConnectError}
          onClose={onPluggyConnectClose}
        />
      )}
    </main>
  );
}
 
function Beneficio({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-white/80 text-sm">
      <span className="text-[#7ad9b7] shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <span>{children}</span>
    </div>
  );
}