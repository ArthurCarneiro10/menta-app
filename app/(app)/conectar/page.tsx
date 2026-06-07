'use client';
 
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { getOuCriaPerfil } from '@/lib/perfil';
import { RefreshCw, Trash2, Plus } from 'lucide-react';
import BloqueioPremium from '@/components/BloqueioPremium';
 
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PluggyConnect = dynamic<any>(
  () => import('react-pluggy-connect').then((m) => m.PluggyConnect),
  { ssr: false }
);
 
// Controla se o app esta no ambiente de producao da Pluggy
const EH_PRODUCAO = process.env.NEXT_PUBLIC_PLUGGY_AMBIENTE === 'production';
 
type Aviso = { texto: string; tipo: 'erro' | 'ok' | 'info' } | null;
 
type Conexao = {
  id: string;
  pluggy_item_id: string;
  connector_name: string | null;
  connector_image_url: string | null;
  status: string | null;
  last_updated_at: string | null;
  erro: string | null;
  criado_em: string;
};
 
type Conta = {
  id: string;
  connection_id: string;
};
 
function fmtDataHora(s: string | null): string {
  if (!s) return '';
  try {
    const d = new Date(s);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes} ${h}:${m}`;
  } catch {
    return '';
  }
}
 
function StatusBadge({ status }: { status: string | null }) {
  let label = 'Pendente';
  let classes = 'bg-white/10 text-white/60';
 
  if (status === 'UPDATED') {
    label = 'Atualizado';
    classes = 'bg-[#7ad9b7]/20 text-[#7ad9b7]';
  } else if (status === 'ERROR') {
    label = 'Erro';
    classes = 'bg-red-500/20 text-red-300';
  } else if (status === 'WAITING_INPUT') {
    label = 'Reautenticar';
    classes = 'bg-yellow-500/20 text-yellow-300';
  }
 
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${classes}`}>
      {label}
    </span>
  );
}
 
export default function ConectarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plano, setPlano] = useState<'free' | 'premium'>('free');
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [gerandoToken, setGerandoToken] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [acaoConexaoId, setAcaoConexaoId] = useState<string>('');
  const [confirmandoDelete, setConfirmandoDelete] = useState<string>('');
  const [aviso, setAviso] = useState<Aviso>(null);
 
  const carregarConexoes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
 
    const { data: conns } = await supabase
      .from('connections')
      .select('id, pluggy_item_id, connector_name, connector_image_url, status, last_updated_at, erro, criado_em')
      .eq('user_id', user.id)
      .order('criado_em', { ascending: false });
 
    setConexoes((conns || []) as Conexao[]);
 
    const { data: contasData } = await supabase
      .from('contas_bancarias')
      .select('id, connection_id')
      .eq('user_id', user.id);
 
    setContas((contasData || []) as Conta[]);
  }, []);
 
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const perfil = await getOuCriaPerfil(user.id);
      if (perfil?.plano === 'premium') {
        setPlano('premium');
        await carregarConexoes();
      }
      setLoading(false);
    }
    init();
  }, [router, carregarConexoes]);
 
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
    setAviso({ texto: 'Importando suas transações...', tipo: 'info' });
 
    try {
      const token = await getAuthToken();
      if (!token) {
        setAviso({ texto: 'Sessão expirou. Saia e entre de novo.', tipo: 'erro' });
        setSincronizando(false);
        return false;
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
      await carregarConexoes();
      setSincronizando(false);
      return true;
    } catch {
      setAviso({ texto: 'Erro na sincronização. Tente de novo.', tipo: 'erro' });
      setSincronizando(false);
      return false;
    }
  }
 
  async function sincronizarUma(c: Conexao) {
    setAcaoConexaoId(`sync_${c.id}`);
    setAviso({ texto: `Sincronizando ${c.connector_name || 'banco'}...`, tipo: 'info' });
 
    try {
      const token = await getAuthToken();
      if (!token) {
        setAviso({ texto: 'Sessão expirou. Saia e entre de novo.', tipo: 'erro' });
        setAcaoConexaoId('');
        return;
      }
 
      const resp = await fetch('/api/pluggy/sincronizar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ itemId: c.pluggy_item_id }),
      });
      const dados = await resp.json();
 
      if (!dados.sucesso) {
        setAviso({ texto: dados.erro || 'Erro ao sincronizar.', tipo: 'erro' });
      } else {
        const totalTx = dados.totalTransacoes || 0;
        setAviso({
          texto: totalTx > 0
            ? `${c.connector_name || 'Banco'}: ${totalTx} transação(ões) atualizadas.`
            : `${c.connector_name || 'Banco'}: sem novidades.`,
          tipo: 'ok',
        });
        await carregarConexoes();
      }
    } catch {
      setAviso({ texto: 'Erro na sincronização.', tipo: 'erro' });
    }
    setAcaoConexaoId('');
  }
 
  async function desconectar(c: Conexao) {
    setAcaoConexaoId(`del_${c.id}`);
    setAviso(null);
 
    try {
      const token = await getAuthToken();
      if (!token) {
        setAviso({ texto: 'Sessão expirou. Saia e entre de novo.', tipo: 'erro' });
        setAcaoConexaoId('');
        return;
      }
 
      const resp = await fetch('/api/pluggy/desconectar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ connectionId: c.id }),
      });
      const dados = await resp.json();
 
      if (!dados.sucesso) {
        setAviso({ texto: dados.erro || 'Erro ao desconectar.', tipo: 'erro' });
        setAcaoConexaoId('');
        return;
      }
 
      setAviso({
        texto: dados.pluggyOk
          ? `${dados.conector || 'Conta'} desconectada.`
          : `${dados.conector || 'Conta'} removida (atenção: Pluggy reportou erro mas seus dados aqui foram apagados).`,
        tipo: 'ok',
      });
      setConfirmandoDelete('');
      await carregarConexoes();
    } catch {
      setAviso({ texto: 'Erro ao desconectar. Tente de novo.', tipo: 'erro' });
    }
    setAcaoConexaoId('');
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
    // Skeleton: replica o layout (header + botao conectar + lista de conexoes)
    return (
      <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] p-6">
        <div className="max-w-md mx-auto pt-16">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="h-7 w-40 rounded bg-[#183e31]/60 animate-pulse" />
            <div className="h-10 w-10 rounded-full bg-[#183e31]/60 animate-pulse" />
          </div>
 
          {/* Botao "Conectar nova" */}
          <div className="h-14 rounded-2xl bg-[#183e31]/60 animate-pulse mb-8" />
 
          {/* Titulo "Conexoes ativas" */}
          <div className="h-5 w-44 rounded bg-[#183e31]/60 animate-pulse mb-4" />
 
          {/* Cards de conexao */}
          <div className="space-y-3">
            <div className="h-28 rounded-2xl bg-[#183e31]/60 animate-pulse" />
            <div className="h-28 rounded-2xl bg-[#183e31]/60 animate-pulse" />
          </div>
        </div>
      </main>
    );
  }
 
  // ===== Gate Premium =====
  if (plano !== 'premium') {
    return (
      <BloqueioPremium
        titulo="Open Finance"
        descricao="Conecte seus bancos e veja todas as transações automaticamente, com categorização inteligente por IA."
      />
    );
  }
 
  const ocupado = gerandoToken || sincronizando;
  const temConexoes = conexoes.length > 0;
 
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
 
        {/* ===== Lista de conexoes (so se tem) ===== */}
        {temConexoes && (
          <div className="mb-6">
            <h2 className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-3">
              Suas conexões
            </h2>
            <div className="space-y-2">
              {conexoes.map((c) => {
                const numContas = contas.filter((a) => a.connection_id === c.id).length;
                const sincronizandoEssa = acaoConexaoId === `sync_${c.id}`;
                const deletandoEssa = acaoConexaoId === `del_${c.id}`;
                const ocupadaEssa = sincronizandoEssa || deletandoEssa;
 
                if (confirmandoDelete === c.id) {
                  return (
                    <div key={c.id} className="rounded-2xl p-4 bg-red-500/10 border border-red-400/20">
                      <p className="text-white font-bold text-sm mb-1">
                        Desconectar {c.connector_name || 'banco'}?
                      </p>
                      <p className="text-white/60 text-xs mb-3 leading-relaxed">
                        Vai apagar {numContas} conta(s) e todas as transações vinculadas. Não dá pra desfazer.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => desconectar(c)}
                          disabled={deletandoEssa}
                          className="flex-1 px-4 py-2 rounded-full text-xs font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          {deletandoEssa ? 'Removendo...' : 'Sim, desconectar'}
                        </button>
                        <button
                          onClick={() => setConfirmandoDelete('')}
                          disabled={deletandoEssa}
                          className="flex-1 px-4 py-2 rounded-full text-xs font-bold bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  );
                }
 
                return (
                  <div key={c.id} className="rounded-2xl p-4 bg-white/5 border border-white/10">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm truncate">
                          {c.connector_name || 'Banco'}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => sincronizarUma(c)}
                          disabled={ocupadaEssa || ocupado}
                          aria-label="Sincronizar esta conexão"
                          className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <RefreshCw size={14} className={sincronizandoEssa ? 'animate-spin' : ''} />
                        </button>
                        <button
                          onClick={() => { setConfirmandoDelete(c.id); setAviso(null); }}
                          disabled={ocupadaEssa || ocupado}
                          aria-label="Desconectar"
                          className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
 
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <StatusBadge status={c.status} />
                      <span className="text-white/40 text-xs">
                        {numContas} conta(s)
                        {c.last_updated_at && ` · ${fmtDataHora(c.last_updated_at)}`}
                      </span>
                    </div>
 
                    {c.erro && (
                      <p className="text-red-300 text-xs mt-2 leading-snug break-words">
                        {c.erro}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
 
        {/* ===== Card principal: conteudo varia se tem conexoes ===== */}
        <div className={`rounded-3xl bg-white/5 border border-white/10 ${temConexoes ? 'p-5' : 'p-8'}`}>
          {!temConexoes ? (
            <>
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
            </>
          ) : (
            <div className="space-y-2">
              <button
                onClick={abrirWidget}
                disabled={ocupado}
                className="w-full px-6 py-3 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Plus size={16} strokeWidth={3} />
                {gerandoToken ? 'Preparando...' : 'Conectar outro banco'}
              </button>
 
              <button
                onClick={() => sincronizar()}
                disabled={ocupado}
                className="w-full px-6 py-3 rounded-full text-sm font-semibold bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} />
                {sincronizando ? 'Sincronizando...' : 'Sincronizar tudo'}
              </button>
            </div>
          )}
        </div>
 
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
 
        {/* Aviso de modo dev SO aparece em ambientes nao-producao */}
        {!EH_PRODUCAO && (
          <div className="mt-6 rounded-2xl p-4 bg-white/5 border border-white/10">
            <p className="text-white/40 text-xs leading-relaxed">
              <strong className="text-white/60">Modo desenvolvimento:</strong> esta versão usa bancos sandbox da Pluggy. Em produção, os bancos reais aparecem.
            </p>
          </div>
        )}
      </div>
 
      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={!EH_PRODUCAO}
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