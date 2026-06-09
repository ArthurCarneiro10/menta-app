'use client';
 
/**
 * OnboardingModal - aparece no primeiro acesso ao dashboard.
 *
 * Detecta usuario novo via profiles.onboarded === false.
 * Mostra 4 slides sequenciais. Ao concluir ou pular, atualiza
 * onboarded = true no profile pra nao aparecer mais.
 *
 * Como usar no dashboard:
 *   <OnboardingModal />
 *
 * O componente se autogerencia: checa o perfil, decide se mostra
 * e atualiza o banco quando o usuario interage.
 */
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
 
type Slide = {
  emoji: string;
  titulo: string;
  texto: string;
};
 
const SLIDES: Slide[] = [
  {
    emoji: '🌱',
    titulo: 'Bem-vindo ao Menta',
    texto:
      'Em 30 segundos, te conto como o app vai te ajudar a manter a vida financeira em ordem — sem planilha, sem dor de cabeça.',
  },
  {
    emoji: '📄',
    titulo: 'Começa pelo Free',
    texto:
      'Envia o PDF da sua fatura de cartão. A IA extrai cada compra e categoriza automaticamente: alimentação, transporte, compras, e por aí.',
  },
  {
    emoji: '🏦',
    titulo: 'Open Finance no Premium',
    texto:
      'Quer mais? Conecta seus bancos via Open Finance (regulado pelo Banco Central). Saldo, gastos e categorias em tempo real, sem mover um dedo.',
  },
  {
    emoji: '✨',
    titulo: 'Tudo pronto pra começar',
    texto:
      'Você pode acessar suas configurações, conectar bancos, ou enviar uma fatura a qualquer momento. Boas-vindas!',
  },
];
 
export default function OnboardingModal() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [idx, setIdx] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
 
  // Decide se mostra modal: so se profile.onboarded === false
  useEffect(() => {
    let cancelado = false;
    async function verificar() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
 
      if (!user || cancelado) return;
      setUserId(user.id);
 
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarded')
        .eq('id', user.id)
        .maybeSingle();
 
      if (cancelado) return;
 
      // Sem profile ou profile.onboarded === false: mostra modal
      if (!profile || profile.onboarded === false) {
        setAberto(true);
      }
    }
    verificar();
    return () => {
      cancelado = true;
    };
  }, []);
 
  async function marcarConcluido() {
    if (!userId || salvando) return;
    setSalvando(true);
 
    await supabase
      .from('profiles')
      .update({ onboarded: true })
      .eq('id', userId);
 
    setAberto(false);
    setSalvando(false);
  }
 
  function proximo() {
    if (idx < SLIDES.length - 1) {
      setIdx(idx + 1);
    } else {
      marcarConcluido();
    }
  }
 
  function pular() {
    marcarConcluido();
  }
 
  function verPlanos() {
    marcarConcluido().then(() => router.push('/planos'));
  }
 
  if (!aberto) return null;
 
  const slide = SLIDES[idx];
  const ultimo = idx === SLIDES.length - 1;
 
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md bg-linear-to-br from-[#183e31] to-[#0c1f18] border border-white/10 rounded-3xl p-8 shadow-2xl">
 
        {/* Indicadores de slide */}
        <div className="flex gap-1.5 justify-center mb-8">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === idx
                  ? 'w-8 bg-[#7ad9b7]'
                  : i < idx
                  ? 'w-4 bg-[#7ad9b7]/50'
                  : 'w-4 bg-white/15'
              }`}
            />
          ))}
        </div>
 
        {/* Slide */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-6">{slide.emoji}</div>
          <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">
            {slide.titulo}
          </h2>
          <p className="text-white/70 leading-relaxed">
            {slide.texto}
          </p>
        </div>
 
        {/* Acoes */}
        <div className="space-y-3">
          {ultimo ? (
            <>
              <button
                onClick={verPlanos}
                disabled={salvando}
                className="w-full py-3.5 bg-[#7ad9b7] text-[#010302] font-bold rounded-full hover:bg-[#7cdbb9] transition-colors disabled:opacity-50"
              >
                Ver planos Premium
              </button>
              <button
                onClick={marcarConcluido}
                disabled={salvando}
                className="w-full py-3.5 border border-white/15 text-white font-medium rounded-full hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Começar de graça
              </button>
            </>
          ) : (
            <>
              <button
                onClick={proximo}
                className="w-full py-3.5 bg-[#7ad9b7] text-[#010302] font-bold rounded-full hover:bg-[#7cdbb9] transition-colors"
              >
                Próximo
              </button>
              <button
                onClick={pular}
                disabled={salvando}
                className="w-full text-sm text-white/40 hover:text-white/70 transition-colors py-2"
              >
                Pular
              </button>
            </>
          )}
        </div>
 
      </div>
    </div>
  );
}