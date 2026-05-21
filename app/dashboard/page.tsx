'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    // Verifica se usuário está logado
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Não está logado → manda pra login
        router.push('/login');
        return;
      }

      setUserEmail(user.email || '');
      setLoading(false);
    }

    checkUser();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-12 pt-8">
          <h1 className="text-2xl font-bold text-white">
            Menta <span className="text-[#7ad9b7]">App</span>
          </h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-white/80 hover:text-white text-sm font-medium border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
          >
            Sair
          </button>
        </header>

        {/* Conteúdo */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Bem-vindo de volta!
          </h2>
          <p className="text-white/70 mb-8">
            Conectado como <span className="text-[#7ad9b7] font-semibold">{userEmail}</span>
          </p>

          <div className="bg-[#7ad9b7]/10 border border-[#7ad9b7]/20 rounded-xl p-6">
            <p className="text-[#7ad9b7] font-semibold text-sm uppercase tracking-widest mb-2">
              🎉 Em construção
            </p>
            <p className="text-white/80">
              Seu dashboard está sendo preparado. Em breve você vai poder fazer upload de faturas, ver insights da IA, e muito mais.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}