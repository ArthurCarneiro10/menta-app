'use client';
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getOuCriaPerfil } from '@/lib/perfil';
 
type Analise = { total: number; categorias: { nome: string; valor: number }[]; insight: string };
type Aviso = { texto: string; tipo: 'erro' | 'ok' } | null;
 
function erroAmigavel(tecnico: string): string {
  const t = (tecnico || '').toLowerCase();
 
  if (t.includes('sessao') || t.includes('expirada') || t.includes('autoriz') || t.includes('login')) {
    return 'Sua sessao expirou. Saia e entre de novo para continuar.';
  }
  if (t.includes('nao pertence') || t.includes('sua conta')) {
    return 'Essa fatura nao esta disponivel na sua conta.';
  }
  if (t.includes('escaneada') || t.includes('legivel') || t.includes('imagem')) {
    return 'Esse PDF parece ser uma imagem escaneada, sem texto que a Menta consiga ler. Tente enviar o PDF original da fatura, baixado direto do app ou site do banco.';
  }
  if (
    t.includes('insufficient') || t.includes('credit') || t.includes('402') ||
    t.includes('payment') || t.includes('quota') || t.includes('billing')
  ) {
    return 'A analise esta temporariamente indisponivel. Ja estamos cuidando disso, tente de novo em alguns minutos.';
  }
  if (t.includes('rate') || t.includes('429') || t.includes('too many')) {
    return 'Muitas analises ao mesmo tempo. Espere alguns segundos e tente de novo.';
  }
  if (t.includes('baixar o arquivo') || t.includes('download') || t.includes('nao encontrad')) {
    return 'Nao encontramos o arquivo enviado. Tente enviar a fatura novamente.';
  }
  if (t.includes('json') || t.includes('valido')) {
    return 'A analise nao saiu como esperado dessa vez. E so tentar analisar de novo.';
  }
  if (t.includes('timeout') || t.includes('network') || t.includes('fetch') || t.includes('failed to')) {
    return 'A conexao falhou no meio do caminho. Verifique sua internet e tente de novo.';
  }
  return 'Nao conseguimos analisar a fatura agora. Tente novamente em instantes.';
}
 
export default function UploadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [plano, setPlano] = useState<'free' | 'premium'>('free');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
 
  const [faturaId, setFaturaId] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState<Analise | null>(null);
 
  function mostraErro(texto: string) { setAviso({ texto, tipo: 'erro' }); }
  function mostraOk(texto: string) { setAviso({ texto, tipo: 'ok' }); }
 
  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);
 
      const perfil = await getOuCriaPerfil(user.id);
      if (perfil?.plano === 'premium') {
        setPlano('premium');
      }
      setLoading(false);
    }
    checkUser();
  }, [router]);
 
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.type !== 'application/pdf') {
      mostraErro('Por enquanto a Menta so le arquivos PDF. Selecione o arquivo .pdf da sua fatura.');
      setFile(null);
      return;
    }
    setFile(selected);
    setAviso(null);
    setAnalise(null);
    setFaturaId('');
  }
 
  async function handleUpload() {
    if (!file) {
      mostraErro('Escolha o PDF da fatura antes de enviar.');
      return;
    }
    setUploading(true);
    setAviso(null);
    setAnalise(null);
 
    const timestamp = Date.now();
    const path = `${userId}/${timestamp}-${file.name}`;
 
    const { error: uploadError } = await supabase.storage
      .from('faturas')
      .upload(path, file);
 
    if (uploadError) {
      mostraErro('Nao foi possivel enviar a fatura. Verifique sua internet e tente de novo.');
      setUploading(false);
      return;
    }
 
    const { data: inserida, error: dbError } = await supabase
      .from('faturas')
      .insert({ user_id: userId, arquivo_path: path, nome_original: file.name })
      .select()
      .single();
 
    if (dbError) {
      mostraErro('Algo deu errado ao registrar a fatura. Tente enviar de novo.');
      setUploading(false);
      return;
    }
 
    setFaturaId(inserida.id);
    mostraOk('Fatura enviada! Agora e so clicar em Analisar com IA.');
    setFile(null);
    setUploading(false);
  }
 
  async function handleAnalisar() {
    setAnalisando(true);
    setAviso(null);
 
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
 
      if (!token) {
        mostraErro('Sua sessao expirou. Saia e entre de novo para continuar.');
        setAnalisando(false);
        return;
      }
 
      const resp = await fetch('/api/analisar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ faturaId }),
      });
      const dados = await resp.json();
 
      if (!dados.sucesso) {
        mostraErro(erroAmigavel(dados.erro || ''));
        setAnalisando(false);
        return;
      }
 
      setAnalise(dados.analise);
      setAviso(null);
    } catch {
      mostraErro('A conexao falhou no meio do caminho. Verifique sua internet e tente de novo.');
    }
    setAnalisando(false);
  }
 
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18]">
        <p className="text-white/60">Carregando...</p>
      </main>
    );
  }
 
  return (
    <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] p-6">
      <div className="max-w-2xl mx-auto">
        <header className="flex items-center justify-between mb-8 pt-8">
          <h1 className="text-2xl font-bold text-white">
            Menta <span className="text-[#7ad9b7]">App</span>
          </h1>
          <a href="/dashboard" className="text-white/80 hover:text-white text-sm font-medium">
            Voltar
          </a>
        </header>
 
        {/* Banner para usuarios Free - upsell */}
        {plano === 'free' && (
          <div className="rounded-2xl p-4 mb-6 bg-[#7ad9b7]/10 border border-[#7ad9b7]/25 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full grid place-items-center shrink-0 bg-[#7ad9b7]/20 text-[#7ad9b7]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="text-white font-bold text-sm">Cansado de enviar PDF?</p>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#7ad9b7]/20 text-[#7ad9b7] border border-[#7ad9b7]/30">
                  Premium
                </span>
              </div>
              <p className="text-white/60 text-xs leading-relaxed">
                Conecte sua conta bancaria direto e a Menta atualiza tudo sozinha, sem voce precisar mandar nada.{' '}
                <span className="text-white/40">Em breve.</span>
              </p>
            </div>
          </div>
        )}
 
        {/* Banner para usuarios Premium - CTA para conectar */}
        {plano === 'premium' && (
          <div className="rounded-2xl p-4 mb-6 bg-[#7ad9b7]/10 border border-[#7ad9b7]/25 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full grid place-items-center shrink-0 bg-[#7ad9b7]/20 text-[#7ad9b7]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="text-white font-bold text-sm">Pule o PDF</p>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#7ad9b7]/20 text-[#7ad9b7] border border-[#7ad9b7]/30">
                  Premium
                </span>
              </div>
              <p className="text-white/60 text-xs leading-relaxed mb-2">
                Conecte sua conta bancaria direto e a Menta atualiza tudo sozinha.
              </p>
              <button
                onClick={() => router.push('/conectar')}
                className="text-[#7ad9b7] font-semibold text-xs hover:underline"
              >
                Conectar agora →
              </button>
            </div>
          </div>
        )}
 
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
          <h2 className="text-3xl font-bold text-white mb-2">Enviar fatura</h2>
          <p className="text-white/60 mb-8">
            Envie o PDF da fatura do seu cartao para a Menta analisar.
          </p>
 
          <label className="block border-2 border-dashed border-white/20 rounded-xl p-10 text-center cursor-pointer hover:border-[#7ad9b7]/50 transition-colors">
            <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
            <div className="text-white/60">
              {file ? (
                <p className="text-[#7ad9b7] font-semibold">{file.name}</p>
              ) : (
                <div>
                  <p className="text-lg font-medium text-white/80 mb-1">Clique para selecionar</p>
                  <p className="text-sm">apenas arquivos PDF</p>
                </div>
              )}
            </div>
          </label>
 
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full mt-6 py-3 bg-[#7ad9b7] text-[#010302] font-bold rounded-lg hover:bg-[#7cdbb9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? 'Enviando...' : 'Enviar fatura'}
          </button>
 
          {faturaId && !analise && (
            <button
              onClick={handleAnalisar}
              disabled={analisando}
              className="w-full mt-3 py-3 bg-white text-[#010302] font-bold rounded-lg hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {analisando ? 'Analisando com IA... (pode demorar)' : 'Analisar com IA'}
            </button>
          )}
 
          {aviso && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm text-center border ${
                aviso.tipo === 'erro'
                  ? 'bg-red-500/10 border-red-400/20 text-red-200'
                  : 'bg-[#7ad9b7]/10 border-[#7ad9b7]/25 text-[#7ad9b7]'
              }`}
            >
              {aviso.texto}
            </div>
          )}
 
          {analise && (
            <div className="mt-6 rounded-xl bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-[#3d7d66] mb-3">
                Analise da IA
              </p>
              <p className="text-2xl font-bold text-[#010302] mb-1">
                Total: R$ {analise.total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <div className="mt-4 space-y-2">
                {analise.categorias?.map((cat, i) => (
                  <div key={i} className="flex justify-between text-sm text-[#010302]">
                    <span>{cat.nome}</span>
                    <span className="font-semibold">
                      R$ {cat.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-[#3d7d66] italic">{analise.insight}</p>
              <a href="/dashboard" className="block text-center mt-4 text-[#7ad9b7] font-semibold text-sm">
                Ver no dashboard
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}