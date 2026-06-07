'use client';
 
/**
 * Bloqueio reutilizavel pra telas/funcionalidades Premium.
 *
 * Renderiza uma tela cheia (ou pode ser usado como modal) explicando
 * que o recurso eh Premium e com CTA pra /planos.
 *
 * Uso atual: /conectar quando o user nao eh Premium.
 * Uso futuro: outras telas/acoes que viram Premium-only.
 */
 
type Props = {
  /** Titulo principal exibido (ex: "Open Finance") */
  titulo: string;
  /** Descricao do que o usuario ganha sendo Premium */
  descricao?: string;
  /** Se true, mostra botao "Voltar" alem do "Ver planos" */
  comVoltar?: boolean;
};
 
export default function BloqueioPremium({
  titulo,
  descricao = 'Open Finance, IA avançada e sincronização automática são exclusivos do Premium. 7 dias grátis pra experimentar.',
  comVoltar = true,
}: Props) {
  return (
    <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] p-6">
      <div className="max-w-md mx-auto pt-16">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">
            {titulo.includes(' ') ? (
              <>
                {titulo.split(' ').slice(0, -1).join(' ')}{' '}
                <span className="text-[#7ad9b7]">{titulo.split(' ').slice(-1)}</span>
              </>
            ) : (
              <span className="text-[#7ad9b7]">{titulo}</span>
            )}
          </h1>
          {comVoltar && (
            <a
              href="/dashboard"
              className="text-white/70 hover:text-white text-sm font-medium border border-white/10 rounded-full px-4 py-2 no-underline"
            >
              Voltar
            </a>
          )}
        </header>
 
        <div className="rounded-3xl p-8 bg-white/5 border border-white/10 text-center">
          {/* Icone de raio (representa Premium / desbloqueio) */}
          <div className="w-16 h-16 mx-auto rounded-full grid place-items-center bg-[#7ad9b7]/20 text-[#7ad9b7] mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
 
          <h2 className="text-xl font-bold text-white mb-2">Recurso Premium</h2>
          <p className="text-white/60 text-sm mb-6 leading-relaxed">
            {descricao}
          </p>
 
          <a
            href="/planos"
            className="inline-block w-full sm:w-auto px-6 py-3 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors no-underline"
          >
            Ver planos
          </a>
 
          <p className="text-white/40 text-xs mt-4">
            A partir de R$ 29,90/mês · 7 dias grátis
          </p>
        </div>
      </div>
    </main>
  );
}