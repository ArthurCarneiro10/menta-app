'use client';
 
/**
 * /redefinir-senha
 *
 * Pagina pra onde o usuario eh redirecionado apos clicar no link
 * do email de reset. Supabase autentica automaticamente via token
 * na URL e estabelece sessao. Aqui so chamamos updateUser pra
 * trocar a senha.
 */
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
 
type Aviso = { texto: string; tipo: 'erro' | 'ok' } | null;
 
export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [loading, setLoading] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [sessaoValida, setSessaoValida] = useState<boolean | null>(null);
 
  // Ao carregar, confere se ha sessao ativa (Supabase trata o token
  // de reset automaticamente quando o redirect chega)
  useEffect(() => {
    let cancelado = false;
    async function checar() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelado) return;
      setSessaoValida(!!session);
    }
    checar();
 
    // Tambem escuta o evento PASSWORD_RECOVERY que Supabase dispara
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') {
        setSessaoValida(true);
      }
    });
 
    return () => {
      cancelado = true;
      sub.subscription.unsubscribe();
    };
  }, []);
 
  async function handleRedefinir(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
 
    if (senha.length < 6) {
      setAviso({ texto: 'A senha precisa ter ao menos 6 caracteres.', tipo: 'erro' });
      return;
    }
 
    if (senha !== senha2) {
      setAviso({ texto: 'As senhas nao coincidem.', tipo: 'erro' });
      return;
    }
 
    setLoading(true);
 
    const { error } = await supabase.auth.updateUser({ password: senha });
 
    if (error) {
      setAviso({
        texto: 'Não foi possível redefinir. Tente clicar no link do email de novo.',
        tipo: 'erro',
      });
      setLoading(false);
      return;
    }
 
    setAviso({
      texto: 'Senha redefinida! Te levando pro app...',
      tipo: 'ok',
    });
    setLoading(false);
    setTimeout(() => router.push('/dashboard'), 1500);
  }
 
  // Skeleton enquanto checa sessao
  if (sessaoValida === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18]">
        <p className="text-white/60 text-sm">Carregando...</p>
      </main>
    );
  }
 
  // Sem sessao = link invalido ou expirado
  if (!sessaoValida) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] p-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-3">
            Link inválido
          </h1>
          <p className="text-white/60 mb-8 leading-relaxed">
            O link de redefinição expirou ou já foi usado. Solicita um
            novo pra continuar.
          </p>
          <a
            href="/esqueci-senha"
            className="inline-block px-6 py-3 bg-[#7ad9b7] text-[#010302] font-bold rounded-full hover:bg-[#7cdbb9] transition-colors no-underline"
          >
            Pedir novo link
          </a>
        </div>
      </main>
    );
  }
 
  return (
    <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
            Menta <span className="text-[#7ad9b7]">App</span>
          </h1>
          <p className="text-white/60">Defina sua nova senha</p>
        </div>
 
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 space-y-4">
          <form onSubmit={handleRedefinir} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Nova senha
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#7ad9b7] focus:ring-1 focus:ring-[#7ad9b7]"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
 
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Repita a senha
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={senha2}
                onChange={(e) => setSenha2(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#7ad9b7] focus:ring-1 focus:ring-[#7ad9b7]"
                placeholder="Mesma senha"
              />
            </div>
 
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#7ad9b7] text-[#010302] font-bold rounded-lg hover:bg-[#7cdbb9] transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Redefinir senha'}
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
      </div>
    </main>
  );
}