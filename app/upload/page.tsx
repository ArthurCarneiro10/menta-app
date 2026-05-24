'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Analise = { total: number; categorias: { nome: string; valor: number }[]; insight: string };

export default function UploadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  // Guarda dados da fatura enviada (pra poder analisar)
  const [faturaId, setFaturaId] = useState('');
  const [arquivoPath, setArquivoPath] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState<Analise | null>(null);

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);
      setLoading(false);
    }
    checkUser();
  }, [router]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.type !== 'application/pdf') {
      setMessage('Erro: por favor envie um arquivo PDF.');
      setFile(null);
      return;
    }
    setFile(selected);
    setMessage('');
    setAnalise(null);
    setFaturaId('');
  }

  async function handleUpload() {
    if (!file) {
      setMessage('Erro: selecione um arquivo primeiro.');
      return;
    }
    setUploading(true);
    setMessage('');
    setAnalise(null);

    const timestamp = Date.now();
    const path = `${userId}/${timestamp}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('faturas')
      .upload(path, file);

    if (uploadError) {
      setMessage('Erro ao enviar: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: inserida, error: dbError } = await supabase
      .from('faturas')
      .insert({ user_id: userId, arquivo_path: path, nome_original: file.name })
      .select()
      .single();

    if (dbError) {
      setMessage('Erro ao registrar: ' + dbError.message);
      setUploading(false);
      return;
    }

    setFaturaId(inserida.id);
    setArquivoPath(path);
    setMessage('Fatura enviada! Agora clique em Analisar com IA.');
    setFile(null);
    setUploading(false);
  }

  async function handleAnalisar() {
    setAnalisando(true);
    setMessage('');

    try {
      const resp = await fetch('/api/analisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivoPath, faturaId }),
      });
      const dados = await resp.json();

      if (!dados.sucesso) {
        setMessage('Erro ao analisar: ' + (dados.erro || 'desconhecido'));
        setAnalisando(false);
        return;
      }

      setAnalise(dados.analise);
      setMessage('');
    } catch {
      setMessage('Erro ao analisar a fatura.');
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
        <header className="flex items-center justify-between mb-12 pt-8">
          <h1 className="text-2xl font-bold text-white">
            Menta <span className="text-[#7ad9b7]">App</span>
          </h1>
          <a href="/dashboard" className="text-white/80 hover:text-white text-sm font-medium">
            Voltar
          </a>
        </header>

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

          {/* Botao de analisar (so aparece depois do upload) */}
          {faturaId && !analise && (
            <button
              onClick={handleAnalisar}
              disabled={analisando}
              className="w-full mt-3 py-3 bg-white text-[#010302] font-bold rounded-lg hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {analisando ? 'Analisando com IA... (pode demorar)' : 'Analisar com IA'}
            </button>
          )}

          {message && (
            <p className={`text-sm text-center mt-4 ${message.startsWith('Erro') ? 'text-red-400' : 'text-[#7ad9b7]'}`}>
              {message}
            </p>
          )}

          {/* Resultado da analise */}
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