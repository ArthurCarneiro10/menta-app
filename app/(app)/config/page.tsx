'use client';
 
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getOuCriaPerfil, salvaPerfil, salvaFoto } from '@/lib/perfil';
 
/* ---------- Icones (SVG inline, sem dependencia externa) ---------- */
function Icon({ name }: { name: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'lock':
      return (
        <svg {...common}>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...common}>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'theme':
      return (
        <svg {...common}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case 'doc':
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...common}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-10 5L2 7" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <path d="M21 12H9" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...common} width={18} height={18}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );
    default:
      return null;
  }
}
 
/* ---------- Linha de item (estilo lista de app) ---------- */
function Row({
  icon,
  label,
  emBreve = false,
  danger = false,
  onClick,
}: {
  icon: string;
  label: string;
  emBreve?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  const clickable = !emBreve && onClick;
  return (
    <button
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
        clickable ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'
      }`}
    >
      <span
        className={`shrink-0 ${
          danger ? 'text-[#e88]' : emBreve ? 'text-white/30' : 'text-[#7ad9b7]'
        }`}
      >
        <Icon name={icon} />
      </span>
      <span
        className={`flex-1 text-sm font-medium ${
          danger ? 'text-[#f1a3a3]' : emBreve ? 'text-white/40' : 'text-white'
        }`}
      >
        {label}
      </span>
      {emBreve ? (
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/5 text-white/40 border border-white/10">
          Em breve
        </span>
      ) : clickable ? (
        <span className="text-white/30">
          <Icon name="chevron" />
        </span>
      ) : null}
    </button>
  );
}
 
/* ---------- Bloco de secao com titulo ---------- */
function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-widest text-[#7cdbb9] mb-2 px-1">
        {titulo}
      </p>
      <div className="rounded-3xl bg-white/5 border border-white/10 overflow-hidden divide-y divide-white/5">
        {children}
      </div>
    </div>
  );
}
 
/* ============================ PAGINA ============================ */
export default function ConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [idade, setIdade] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [plano, setPlano] = useState<'free' | 'premium'>('free');
  const [assinatura, setAssinatura] = useState<{
    plano_tipo: 'mensal' | 'anual';
    proximo_pagamento: string | null;
  } | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [avisoFoto, setAvisoFoto] = useState<{ texto: string; tipo: 'erro' | 'ok' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
 
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);
      setEmail(user.email || '');
 
      const perfil = await getOuCriaPerfil(user.id);
      if (perfil) {
        setNome(perfil.nome || '');
        setIdade(perfil.idade ? String(perfil.idade) : '');
        setFotoUrl(perfil.foto_url || null);
        if (perfil.plano === 'premium') setPlano('premium');
      }
 
      // Se Premium, busca a assinatura ativa pra mostrar detalhes
      if (perfil?.plano === 'premium') {
        const { data: ass } = await supabase
          .from('assinaturas')
          .select('plano_tipo, proximo_pagamento')
          .eq('user_id', user.id)
          .eq('status', 'authorized')
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ass) {
          setAssinatura({
            plano_tipo: ass.plano_tipo,
            proximo_pagamento: ass.proximo_pagamento,
          });
        }
      }
 
      setLoading(false);
    }
    init();
  }, [router]);
 
  async function handleSalvar() {
    setSalvando(true);
    setMensagem('');
 
    const idadeNum = idade ? parseInt(idade, 10) : null;
 
    const { error } = await salvaPerfil(userId, {
      nome: nome.trim() || null,
      idade: idadeNum,
    });
 
    setSalvando(false);
    setMensagem(error ? 'Não foi possível salvar. Tente de novo.' : 'Tudo certo! Seus dados foram salvos.');
  }
 
  function abrirSeletorFoto() {
    fileInputRef.current?.click();
  }
 
  async function handleFotoSelecionada(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
 
    if (!file.type.startsWith('image/')) {
      setAvisoFoto({ texto: 'Selecione um arquivo de imagem (JPG, PNG, etc).', tipo: 'erro' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvisoFoto({ texto: 'Imagem muito grande. Use uma imagem menor que 2 MB.', tipo: 'erro' });
      return;
    }
 
    setEnviandoFoto(true);
    setAvisoFoto(null);
 
    const { url, error } = await salvaFoto(userId, file);
 
    setEnviandoFoto(false);
 
    if (error || !url) {
      setAvisoFoto({ texto: 'Não foi possível salvar a foto. Tente de novo.', tipo: 'erro' });
      return;
    }
 
    setFotoUrl(url);
    setAvisoFoto({ texto: 'Foto atualizada!', tipo: 'ok' });
    e.target.value = '';
  }
 
  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }
 
  async function handleCancelarPremium() {
    const ok = confirm(
      'Tem certeza que deseja cancelar o Premium? Suas conexões bancárias e transações ficam armazenadas por 30 dias caso queira reativar.'
    );
    if (!ok) return;
 
    setCancelando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
 
      const r = await fetch('/api/cancelar-premium', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token },
      });
      const data = await r.json();
 
      if (data.sucesso) {
        // Recarrega pra refletir estado Free
        window.location.reload();
      } else {
        alert('Erro: ' + (data.erro || 'desconhecido'));
        setCancelando(false);
      }
    } catch {
      alert('Erro de conexao ao cancelar');
      setCancelando(false);
    }
  }
 
  const inicial = (nome || email || '?').trim().charAt(0).toUpperCase();
 
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18]">
        <p className="text-white/60">Carregando...</p>
      </main>
    );
  }
 
  return (
    <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] pb-20">
      <div className="max-w-2xl mx-auto px-5">
 
        {/* Cabecalho */}
        <header className="flex items-center justify-between pt-10 pb-6">
          <div>
            <p className="text-xs tracking-widest uppercase font-semibold text-[#7cdbb9]">
              Configurações
            </p>
            <h1 className="text-2xl font-bold text-white mt-1">
              Seu <span className="text-[#7ad9b7]">perfil</span>
            </h1>
          </div>
          <a
            href="/dashboard"
            className="px-4 py-2 text-white/70 hover:text-white text-sm font-medium border border-white/10 rounded-full hover:bg-white/5 transition-colors no-underline"
          >
            Voltar
          </a>
        </header>
 
        {/* Avatar clicavel + foto */}
        <div className="flex flex-col items-center mb-8">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFotoSelecionada}
            className="hidden"
          />
          <button
            type="button"
            onClick={abrirSeletorFoto}
            disabled={enviandoFoto}
            aria-label="Trocar foto de perfil"
            className="relative cursor-pointer disabled:opacity-50"
          >
            <div className="w-24 h-24 rounded-full grid place-items-center text-4xl font-bold text-[#0c2019] bg-[#7ad9b7] overflow-hidden">
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
              ) : (
                <span>{inicial}</span>
              )}
            </div>
            <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full grid place-items-center bg-white/15 border border-white/20 text-white/80">
              <Icon name="camera" />
            </span>
          </button>
          <p className="text-white/40 text-xs mt-3">
            {enviandoFoto ? 'Enviando foto...' : 'Toque para trocar a foto'}
          </p>
          {avisoFoto && (
            <div
              className={`mt-2 rounded-xl px-3 py-2 text-xs text-center border ${
                avisoFoto.tipo === 'erro'
                  ? 'bg-red-500/10 border-red-400/20 text-red-200'
                  : 'bg-[#7ad9b7]/10 border-[#7ad9b7]/25 text-[#7ad9b7]'
              }`}
            >
              {avisoFoto.texto}
            </div>
          )}
        </div>
 
        {/* PERFIL */}
        <Secao titulo="Perfil">
          <div className="px-4 py-4 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-white/50">
                Nome
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Como você quer ser chamado"
                className="w-full px-4 py-3 rounded-2xl bg-white/10 text-white placeholder-white/30 border border-white/10 outline-none focus:border-[#7ad9b7] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-white/50">
                Idade
              </label>
              <input
                type="number"
                value={idade}
                onChange={(e) => setIdade(e.target.value)}
                placeholder="Sua idade"
                className="w-full px-4 py-3 rounded-2xl bg-white/10 text-white placeholder-white/30 border border-white/10 outline-none focus:border-[#7ad9b7] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2 text-white/50">
                Email
              </label>
              <div className="w-full px-4 py-3 rounded-2xl bg-white/5 text-white/50 border border-white/5">
                {email}
              </div>
            </div>
            <button
              onClick={handleSalvar}
              disabled={salvando}
              className="w-full px-6 py-3 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
            {mensagem && (
              <p className="text-center text-sm text-[#7ad9b7]">{mensagem}</p>
            )}
          </div>
        </Secao>
 
        {/* PLANO */}
        <Secao titulo="Plano">
          {plano === 'premium' ? (
            <div className="px-4 py-4 space-y-3">
              <div className="rounded-2xl p-4 bg-[#7ad9b7]/10 border border-[#7ad9b7]/30">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#7cdbb9]">
                      Plano atual
                    </p>
                    <p className="text-lg font-bold text-white mt-1">
                      Menta Premium
                      {assinatura && (
                        <span className="text-white/60 font-normal text-sm ml-2">
                          · {assinatura.plano_tipo === 'anual' ? 'Anual' : 'Mensal'}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-[#7ad9b7]/20 text-[#7ad9b7] border border-[#7ad9b7]/30">
                    Ativo
                  </span>
                </div>
                {assinatura?.proximo_pagamento && (
                  <p className="text-white/60 text-xs">
                    Próxima cobrança:{' '}
                    {new Date(assinatura.proximo_pagamento).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
              <button
                onClick={handleCancelarPremium}
                disabled={cancelando}
                className="w-full px-6 py-3 rounded-full text-sm font-medium border border-white/15 text-white/70 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
              >
                {cancelando ? 'Cancelando...' : 'Cancelar Premium'}
              </button>
              <p className="text-white/40 text-[11px] text-center leading-relaxed">
                Ao cancelar, suas conexões bancárias e transações ficam armazenadas por 30 dias caso queira reativar.
              </p>
            </div>
          ) : (
            <div className="px-4 py-4">
              <div className="rounded-2xl p-5 bg-[#7ad9b7]/10 border border-[#7ad9b7]/30">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full grid place-items-center bg-[#7ad9b7]/20 text-[#7ad9b7] flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white">Faça upgrade pra Premium</h3>
                    <p className="text-white/60 text-sm mt-1 leading-relaxed">
                      Conecte seus bancos com Open Finance, sincronização automática e IA avançada.
                    </p>
                  </div>
                </div>
                <a
                  href="/planos"
                  className="block w-full px-6 py-3 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors no-underline text-center"
                >
                  Ver planos
                </a>
                <p className="text-white/50 text-xs text-center mt-3">
                  A partir de R$ 29,90/mês · 7 dias grátis
                </p>
              </div>
            </div>
          )}
        </Secao>
 
        {/* CONTA E SEGURANCA */}
        <Secao titulo="Conta e segurança">
          <Row icon="lock" label="Trocar senha" onClick={() => router.push('/config/senha')} />
          <Row icon="camera" label="Foto de perfil" onClick={abrirSeletorFoto} />
        </Secao>
 
        {/* PREFERENCIAS */}
        <Secao titulo="Preferências">
          <Row icon="theme" label="Tema (claro / escuro)" emBreve />
        </Secao>
 
        {/* SOBRE */}
        <Secao titulo="Sobre">
          <Row icon="info" label="Versão 1.0.0" />
          <Row icon="doc" label="Termos de uso" onClick={() => router.push('/termos')} />
          <Row icon="shield" label="Política de privacidade" onClick={() => router.push('/privacidade')} />
          <Row icon="mail" label="Suporte e contato" onClick={() => router.push('/suporte')} />
        </Secao>
 
        {/* ZONA DE PERIGO */}
        <Secao titulo="Zona de perigo">
          <Row icon="trash" label="Excluir minha conta" danger onClick={() => router.push('/config/excluir')} />
        </Secao>
 
        {/* Sair */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-sm font-bold text-white/80 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
        >
          <Icon name="logout" />
          Sair da conta
        </button>
 
      </div>
    </main>
  );
}