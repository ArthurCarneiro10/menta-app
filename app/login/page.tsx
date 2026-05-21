'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage('Erro: ' + error.message);
      setLoading(false);
      return;
    }

    // Login OK → vai pro dashboard
    router.push('/dashboard');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
            Menta <span className="text-[#7ad9b7]">App</span>
          </h1>
          <p className="text-white/60">Entre na sua conta</p>
        </div>

        <form
          onSubmit={handleLogin}
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

          {message && (
            <p className="text-sm text-center text-red-400">
              {message}
            </p>
          )}
        </form>

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