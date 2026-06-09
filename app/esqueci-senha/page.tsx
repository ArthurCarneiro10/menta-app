'use client';
 
/**
 * /esqueci-senha
 *
 * Recebe email e dispara reset via Supabase Auth.
 * Supabase envia email com link que aponta pra /redefinir-senha.
 *
 * IMPORTANTE: Em Supabase > Authentication > URL Configuration,
 * adicionar https://app.mentaapp.com.br/redefinir-senha em
 * "Redirect URLs" pra que o link do email funcione em producao.
 */
 
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
 
type Aviso = { texto: string; tipo: 'erro' | 'ok' } | null;
 
export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
 
  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setAviso(null);
 
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/redefinir-senha`
        : 'https://app.mentaapp.com.br/redefinir-senha';
 
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
 
    if (error) {
      const msg = error.message.toLowerCase();
      let amigavel = 'Não foi possível enviar o email. Tente de novo.';
      if (msg.includes('rate') || msg.includes('too many')) {
        amigavel = 'Muitas tentativas. Espere um instante e tente de novo.';
      }
      setAviso({ texto: amigavel, tipo: 'erro' });
      setLoading(false);
      return;
    }
 
    setAviso({
      texto:
        'Se este email tiver conta, você vai receber um link em instantes. Confira a caixa de entrada e spam.',
      tipo: 'ok',
    });
    setLoading(false);
  }
 
  return (
    <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/menta-logo-completa.png"
            alt="Menta"
            className="h-14 w-auto object-contain mx-auto mb-3"
          />
          <p className="text-white/60">Esqueceu sua senha?</p>
        </div>
 
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 space-y-4">
 
          <p className="text-white/70 text-sm leading-relaxed">
            Digite seu email cadastrado. Vamos enviar um link pra você
            criar uma nova senha.
          </p>
 
          <form onSubmit={handleEnviar} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#7ad9b7] focus:ring-1 focus:ring-[#7ad9b7]"
                placeholder="seu@email.com"
              />
            </div>
 
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#7ad9b7] text-[#010302] font-bold rounded-lg hover:bg-[#7cdbb9] transition-colors disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar link'}
            </button>
          </form>
 
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
 
        <p className="text-center text-white/60 text-sm mt-6">
          Lembrou?{' '}
          <a
            href="/login"
            className="text-[#7ad9b7] font-semibold hover:underline"
          >
            Voltar pro login
          </a>
        </p>
      </div>
    </main>
  );
}