'use client';
 
/**
 * Porta de entrada do app (app.mentaapp.com.br/).
 *
 * - Se ja esta logado: redireciona pra /dashboard
 * - Se nao: mostra tela leve com botoes Entrar e Criar conta,
 *   alem de link discreto pra landing publica em mentaapp.com.br
 *
 * Substitui a antiga "Em construcao V0.1" que aparecia aqui.
 */
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
 
const LANDING_URL = 'https://mentaapp.com.br';
 
export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
 
  useEffect(() => {
    let cancelado = false;
    async function decidir() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
 
      if (cancelado) return;
 
      if (session) {
        // Logado: vai direto pro app
        router.replace('/dashboard');
      } else {
        // Anonimo: mostra a tela de entrada
        setLoading(false);
      }
    }
    decidir();
    return () => {
      cancelado = true;
    };
  }, [router]);
 
  // Skeleton enquanto verifica sessao
  if (loading) {
    return (
      <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] flex items-center justify-center">
        <img
          src="/menta-logo-completa.png"
          alt="Menta"
          className="h-12 w-auto object-contain opacity-80"
        />
      </main>
    );
  }
 
  return (
    <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] flex flex-col">
      {/* Conteudo central */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full mx-auto">
 
          {/* Logo */}
          <div className="text-center mb-10">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#7cdbb9] mb-6"
            >
              Bem-vindo
            </p>
            <img
              src="/menta-logo-completa.png"
              alt="Menta"
              className="h-20 sm:h-24 w-auto object-contain mx-auto"
            />
            <p className="text-white/60 text-base mt-6 leading-relaxed">
              Seu dinheiro, no piloto automático.
            </p>
          </div>
 
          {/* Botoes */}
          <div className="space-y-3">
            <a
              href="/login"
              className="block w-full px-6 py-4 rounded-full text-base font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors no-underline text-center"
            >
              Entrar
            </a>
            <a
              href="/signup"
              className="block w-full px-6 py-4 rounded-full text-base font-medium border border-white/15 text-white hover:bg-white/5 transition-colors no-underline text-center"
            >
              Criar conta gratis
            </a>
          </div>
 
          {/* Link pra landing publica */}
          <div className="mt-8 text-center">
            <a
              href={LANDING_URL}
              className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors no-underline"
            >
              <span>Conhecer o Menta</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
          </div>
 
        </div>
      </div>
 
      {/* Footer minimo */}
      <footer className="px-6 pb-6 text-center">
        <p className="text-white/30 text-[10px] uppercase tracking-widest">
          v0.1 · 2026
        </p>
      </footer>
    </main>
  );
}