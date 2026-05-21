'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage('Erro: ' + error.message);
      setLoading(false);
      return;
    }

    setMessage('Conta criada! Verifique seu email para confirmar.');
    setLoading(false);
    // Depois de 2 segundos, vai pra página de login
    setTimeout(() => router.push('/login'), 2000);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
            Menta <span className="text-[#7ad9b7]">App</span>
          </h1>
          <p className="text-white/60">Crie sua conta grátis</p>
        </div>

        <form
          onSubmit={handleSignup}
          className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 space-y-4"
        >
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#7ad9b7] focus:ring-1 focus:ring-[#7ad9b7]"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#7ad9b7] text-[#010302] font-bold rounded-lg hover:bg-[#7cdbb9] transition-colors disabled:opacity-50"
          >
            {loading ? 'Criando...' : 'Criar conta'}
          </button>

          {message && (
            <p
              className={`text-sm text-center ${
                message.startsWith('Erro') ? 'text-red-400' : 'text-[#7ad9b7]'
              }`}
            >
              {message}
            </p>
          )}
        </form>

        <p className="text-center text-white/60 text-sm mt-6">
          Já tem conta?{' '}
          <a href="/login" className="text-[#7ad9b7] font-semibold hover:underline">
            Entrar
          </a>
        </p>
      </div>
    </main>
  );
}