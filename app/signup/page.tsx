'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import BotoesLoginSocial from '@/components/BotoesLoginSocial';

type Aviso = { texto: string; tipo: 'erro' | 'ok' } | null;

// Mascara de telefone BR: (99) 99999-9999 ou (99) 9999-9999
function maskTelefone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function SignupPage() {
  const router = useRouter();
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [password, setPassword] = useState('');
  const [consentimento, setConsentimento] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  function setAvisoMsg(texto: string, tipo: 'erro' | 'ok') {
    setAviso({ texto, tipo });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    // ===== Validacoes dos campos novos (antes de criar a conta) =====
    const nome = nomeCompleto.trim();
    if (nome.length < 3) {
      setAvisoMsg('Informe seu nome completo.', 'erro');
      return;
    }

    const telDigits = telefone.replace(/\D/g, '');
    if (telDigits.length < 10 || telDigits.length > 11) {
      setAvisoMsg('Telefone invalido. Use DDD + numero, ex: (13) 99999-8888.', 'erro');
      return;
    }

    if (!consentimento) {
      setAvisoMsg('Voce precisa aceitar receber comunicacoes para criar a conta.', 'erro');
      return;
    }

    setLoading(true);
    setAviso(null);

    // Os dados extras vao no user_metadata. Um trigger no banco copia
    // pra tabela profiles automaticamente quando a conta e criada.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome_completo: nome,
          telefone: telDigits,
          consentimento_msg: consentimento,
        },
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      let amigavel = 'Não foi possível criar a conta. Tente de novo.';
      if (msg.includes('already') || msg.includes('registered')) {
        amigavel = 'Este email já está cadastrado. Tente entrar.';
      } else if (msg.includes('password') && (msg.includes('6') || msg.includes('short'))) {
        amigavel = 'A senha precisa ter pelo menos 6 caracteres.';
      } else if (msg.includes('email') && msg.includes('invalid')) {
        amigavel = 'Email inválido. Confira e tente de novo.';
      } else if (msg.includes('rate') || msg.includes('too many')) {
        amigavel = 'Muitas tentativas. Espere um instante e tente de novo.';
      }
      setAvisoMsg(amigavel, 'erro');
      setLoading(false);
      return;
    }

    // Dispara email de boas-vindas em background (nao bloqueia o usuario).
    // Usa o primeiro nome do nome completo informado.
    const primeiroNome = nome.split(/\s+/)[0];
    fetch('/api/email/boas-vindas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nome: primeiroNome }),
    }).catch((err) => console.warn('[signup] falha ao enviar boas-vindas:', err));

    setAvisoMsg('Conta criada! Verifique seu email para confirmar.', 'ok');
    setLoading(false);
    setTimeout(() => router.push('/login'), 2000);
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
          <p className="text-white/60">Crie sua conta grátis</p>
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

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Nome completo
              </label>
              <input
                type="text"
                required
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#7ad9b7] focus:ring-1 focus:ring-[#7ad9b7]"
                placeholder="Seu nome completo"
              />
            </div>

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
                Telefone (WhatsApp)
              </label>
              <input
                type="tel"
                required
                value={telefone}
                onChange={(e) => setTelefone(maskTelefone(e.target.value))}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#7ad9b7] focus:ring-1 focus:ring-[#7ad9b7]"
                placeholder="(13) 99999-8888"
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

            {/* Consentimento (obrigatorio) */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentimento}
                onChange={(e) => setConsentimento(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-[#7ad9b7]"
              />
              <span className="text-xs text-white/70 leading-relaxed">
                Aceito receber comunicações da Menta no meu WhatsApp, como novidades e
                avisos sobre minha conta.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#7ad9b7] text-[#010302] font-bold rounded-lg hover:bg-[#7cdbb9] transition-colors disabled:opacity-50"
            >
              {loading ? 'Criando...' : 'Criar conta'}
            </button>
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
          Já tem conta?{' '}
          <a href="/login" className="text-[#7ad9b7] font-semibold hover:underline">
            Entrar
          </a>
        </p>
      </div>
    </main>
  );
}