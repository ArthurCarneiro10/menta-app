/**
 * Pagina de Suporte - app/suporte/page.tsx
 *
 * FAQ minimo + email de contato. Pode evoluir pra ter chat,
 * formulario de ticket, etc no futuro.
 */
 
'use client';
 
import { useState } from 'react';
import type { Metadata } from 'next';
 
const FAQS = [
  {
    pergunta: 'Como o Menta funciona?',
    resposta:
      'No plano Free você envia PDFs de fatura de cartão e a IA categoriza. No Premium, você conecta seus bancos via Open Finance e tudo sincroniza automaticamente. Em qualquer plano, você vê pra onde foi seu dinheiro.',
  },
  {
    pergunta: 'A conexão com meu banco é segura?',
    resposta:
      'Sim. Usamos Pluggy, autorizada pelo Banco Central do Brasil. Open Finance é regulado e usa criptografia de ponta a ponta. Você autoriza explicitamente cada conexão, e pode desconectar quando quiser.',
  },
  {
    pergunta: 'Quanto custa o Premium?',
    resposta:
      'R$ 39,90 por mês ou R$ 358,80 por ano (~R$ 29,90/mês, economia de 25%). Ambos com 7 dias grátis pra experimentar.',
  },
  {
    pergunta: 'Como cancelo o Premium?',
    resposta:
      'Em Configurações > Plano, clica em "Cancelar Premium". O cancelamento é imediato e suas conexões bancárias ficam guardadas por 30 dias caso queira reativar. Após esse prazo, são apagadas.',
  },
  {
    pergunta: 'Vocês têm direito a reembolso?',
    resposta:
      'Conforme o Código de Defesa do Consumidor, você tem 7 dias após a contratação pra desistir e receber reembolso integral. Solicite por email se for o caso.',
  },
  {
    pergunta: 'O que acontece se eu cancelar minha conta?',
    resposta:
      'Em Configurações > Excluir conta, sua conta é apagada permanentemente. Dados pessoais são removidos em até 30 dias. Logs fiscais ficam pelo prazo legal (5 anos).',
  },
  {
    pergunta: 'A IA do Menta tem acesso aos meus dados?',
    resposta:
      'A IA recebe apenas as descrições de transações pra categorizar (ex: "IFOOD ABC LTDA"). Não enviamos seu nome, email ou identificadores pessoais. As respostas voltam como categorias (Alimentação, Transporte, etc).',
  },
  {
    pergunta: 'Posso usar o Menta sem conectar banco?',
    resposta:
      'Sim! O plano Free trabalha com upload de PDFs de fatura. A IA extrai e categoriza as transações. Sem necessidade de Open Finance.',
  },
];
 
export default function SuportePage() {
  const [abertoIdx, setAbertoIdx] = useState<number | null>(null);
 
  return (
    <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18]">
      <div className="max-w-2xl mx-auto px-6 py-12 pb-32">
 
        <header className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors no-underline"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Voltar
            </a>
            <img
              src="/menta-logo.png"
              alt="Menta"
              className="h-8 w-auto object-contain opacity-60"
            />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#7cdbb9] mb-3">
            Suporte
          </p>
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
            Como podemos ajudar?
          </h1>
          <p className="text-white/60 text-sm leading-relaxed">
            Confere as perguntas frequentes abaixo. Se não encontrar resposta, escreve direto pra gente.
          </p>
        </header>
 
        {/* CTA email destacado */}
        <div className="rounded-3xl p-6 bg-[#7ad9b7]/10 border border-[#7ad9b7]/30 mb-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full grid place-items-center bg-[#7ad9b7]/20 text-[#7ad9b7] flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-white font-bold mb-1">Fale com a gente</h2>
              <p className="text-white/60 text-sm mb-3 leading-relaxed">
                Respondemos em até 24 horas em dias úteis.
              </p>
              <a
                href="mailto:mentaapp.contato@gmail.com?subject=Suporte%20Menta"
                className="inline-block px-5 py-2.5 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors no-underline"
              >
                mentaapp.contato@gmail.com
              </a>
            </div>
          </div>
        </div>
 
        {/* FAQ */}
        <section>
          <h2 className="text-lg font-bold text-white mb-4 tracking-tight">
            Perguntas frequentes
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
              >
                <button
                  onClick={() => setAbertoIdx(abertoIdx === i ? null : i)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <span className="text-white font-medium text-sm pr-4">
                    {faq.pergunta}
                  </span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-white/40 flex-shrink-0 transition-transform ${
                      abertoIdx === i ? 'rotate-180' : ''
                    }`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {abertoIdx === i && (
                  <div className="px-5 pb-5 text-white/70 text-sm leading-relaxed border-t border-white/5 pt-3">
                    {faq.resposta}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
 
        {/* Links pra docs legais */}
        <footer className="mt-16 pt-8 border-t border-white/10">
          <div className="flex flex-wrap gap-4 text-sm">
            <a href="/termos" className="text-white/50 hover:text-white/80 no-underline transition-colors">
              Termos de Uso
            </a>
            <a href="/privacidade" className="text-white/50 hover:text-white/80 no-underline transition-colors">
              Política de Privacidade
            </a>
            <a href="/dashboard" className="text-white/50 hover:text-white/80 no-underline transition-colors ml-auto">
              Voltar ao app →
            </a>
          </div>
        </footer>
 
      </div>
    </main>
  );
}