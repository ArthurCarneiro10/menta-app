'use client';
 
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
 
type Props = {
  onAviso?: (texto: string, tipo: 'erro' | 'ok') => void;
};
 
export default function BotoesLoginSocial({ onAviso }: Props) {
  const [conectando, setConectando] = useState(false);
 
  async function entrarComGoogle() {
    setConectando(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) {
        onAviso?.('Não foi possível iniciar o login com Google. Tente de novo.', 'erro');
        setConectando(false);
      }
      // Em caso de sucesso, o navegador ja esta redirecionando pro Google
    } catch {
      onAviso?.('A conexão falhou. Verifique sua internet e tente de novo.', 'erro');
      setConectando(false);
    }
  }
 
  function avisoEmBreve(provedor: string) {
    onAviso?.(
      `Login com ${provedor} está chegando em breve. Por enquanto, use o Google ou seu email.`,
      'erro'
    );
  }
 
  return (
    <div className="space-y-2">
      {/* Google - ATIVO */}
      <button
        type="button"
        onClick={entrarComGoogle}
        disabled={conectando}
        className="w-full flex items-center justify-center gap-3 py-3 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
      >
        <IconGoogle />
        {conectando ? 'Conectando...' : 'Continuar com Google'}
      </button>
 
      {/* Facebook - EM BREVE */}
      <button
        type="button"
        onClick={() => avisoEmBreve('Facebook')}
        className="w-full flex items-center justify-center gap-3 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/50 font-medium transition-colors relative"
      >
        <IconFacebook />
        Continuar com Facebook
        <span className="absolute right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">
          Em breve
        </span>
      </button>
 
      {/* Apple - EM BREVE */}
      <button
        type="button"
        onClick={() => avisoEmBreve('Apple')}
        className="w-full flex items-center justify-center gap-3 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/50 font-medium transition-colors relative"
      >
        <IconApple />
        Continuar com Apple
        <span className="absolute right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">
          Em breve
        </span>
      </button>
    </div>
  );
}
 
function IconGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
 
function IconFacebook() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.12 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/>
    </svg>
  );
}
 
function IconApple() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}