'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function UploadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

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
  }

  async function handleUpload() {
    if (!file) {
      setMessage('Erro: selecione um arquivo primeiro.');
      return;
    }
    setUploading(true);
    setMessage('');

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

    const { error: dbError } = await supabase.from('faturas').insert({
      user_id: userId,
      arquivo_path: path,
      nome_original: file.name,
    });

    if (dbError) {
      setMessage('Erro ao registrar: ' + dbError.message);
      setUploading(false);
      return;
    }

    setMessage('Fatura enviada com sucesso!');
    setFile(null);
    setUploading(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18]">
        <p className="text-white/60">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] p-6">
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
          <h2 className="text-3xl font-bold text-white mb-2">
            Enviar fatura
          </h2>
          <p className="text-white/60 mb-8">
            Envie o PDF da fatura do seu cartao para a Menta analisar.
          </p>

          <label className="block border-2 border-dashed border-white/20 rounded-xl p-10 text-center cursor-pointer hover:border-[#7ad9b7]/50 transition-colors">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="text-white/60">
              {file ? (
                <p className="text-[#7ad9b7] font-semibold">{file.name}</p>
              ) : (
                <div>
                  <p className="text-lg font-medium text-white/80 mb-1">
                    Clique para selecionar
                  </p>
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

          {message && (
            <p className={`text-sm text-center mt-4 ${message.startsWith('Erro') ? 'text-red-400' : 'text-[#7ad9b7]'}`}>
              {message}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}