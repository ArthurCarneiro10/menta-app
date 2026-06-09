'use client';
 
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import BotoesLoginSocial from '@/components/BotoesLoginSocial';
 
type Aviso = { texto: string; tipo: 'erro' | 'ok' } | null;
 
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
 
  function setAvisoMsg(texto: string, tipo: 'erro' | 'ok') {
    setAviso({ texto, tipo });
  }
 
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setAviso(null);
 
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
 
    if (error) {
      const msg = error.message.toLowerCase();
      let amigavel = 'Não foi possível entrar. Tente de novo.';
      if (msg.includes('invalid login') || msg.includes('credentials')) {
        amigavel = 'Email ou senha incorretos.';
      } else if (msg.includes('email not confirmed')) {
        amigavel = 'Confirme seu email antes de entrar (a Menta enviou um link).';
      } else if (msg.includes('rate') || msg.includes('too many')) {
        amigavel = 'Muitas tentativas. Espere um instante e tente de novo.';
      }
      setAvisoMsg(amigavel, 'erro');
      setLoading(false);
      return;
    }
 
    router.push('/dashboard');
  }
 
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/menta-logo-completa.png"
            alt="Menta"
            className="h-14 w-auto object-contain mx-auto mb-3"
          />
          <p className="text-white/60">Entre na sua conta</p>
        </div>
 
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 space-y-4">
 
          {/* Botoes sociais */}
          <BotoesLoginSocial onAviso={setAvisoMsg} />
 
          {/* Divisor */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/40 text-xs">ou</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
 
          {/* Formulario email/senha */}
          <form onSubmit={handleLogin} className="space-y-4">
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
 
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Senha
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#7ad9b7] focus:ring-1 focus:ring-[#7ad9b7]"
                placeholder="Sua senha"
              />
            </div>
 
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#7ad9b7] text-[#010302] font-bold rounded-lg hover:bg-[#7cdbb9] transition-colors disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
 
            <div className="text-center">
              <a
                href="/esqueci-senha"
                className="text-sm text-white/50 hover:text-white/80 transition-colors no-underline"
              >
                Esqueci minha senha
              </a>
            </div>
          </form>
 
          {/* Aviso amigavel */}
          {aviso && (
            <div className={`rounded-xl px-4 py-3 text-sm text-center border ${
              aviso.tipo === 'erro'
                ? 'bg-red-500/10 border-red-400/20 text-red-200'
                : 'bg-[#7ad9b7]/10 border-[#7ad9b7]/25 text-[#7ad9b7]'
            }`}>
              {aviso.texto}
            </div>
          )}
        </div>
 
        <p className="text-center text-white/60 text-sm mt-6">
          Ainda não tem conta?{' '}
          <a href="/signup" className="text-[#7ad9b7] font-semibold hover:underline">
            Cadastre-se
          </a>
        </p>
      </div>
    </main>
  );
}