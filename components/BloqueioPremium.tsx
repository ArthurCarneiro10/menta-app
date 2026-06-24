'use client';

/**
 * Bloqueio reutilizavel pra telas/funcionalidades pagas.
 *
 * Renderiza uma tela cheia explicando que o recurso pertence a um plano pago
 * e com CTA pra /planos. O `nivel` define qual plano sugerir (texto + rodape):
 *   - 'premium' (default): recursos sem limite (analise, IA)
 *   - 'max': Open Finance (conectar bancos)
 *
 * Uso: /conectar (nivel='max') e upsells de limite (nivel='premium').
 */

type Nivel = 'premium' | 'max';

type Props = {
  /** Titulo principal exibido (ex: "Open Finance") */
  titulo: string;
  /** Descricao do que o usuario ganha. Se omitida, usa o padrao do nivel. */
  descricao?: string;
  /** Se true, mostra botao "Voltar" */
  comVoltar?: boolean;
  /** Qual plano sugerir. Default 'premium'. */
  nivel?: Nivel;
};

const INFO_NIVEL: Record<
  Nivel,
  { nome: string; rodape: string; descricaoPadrao: string }
> = {
  premium: {
    nome: 'Premium',
    rodape: 'A partir de R$ 29,90/mês · cancele quando quiser',
    descricaoPadrao:
      'Análise de faturas e IA financeira ilimitadas são do plano Premium.',
  },
  max: {
    nome: 'Max',
    rodape: 'Plano Max · R$ 49,90/mês · cancele quando quiser',
    descricaoPadrao:
      'Conectar seus bancos com Open Finance é exclusivo do plano Max.',
  },
};

export default function BloqueioPremium({
  titulo,
  descricao,
  comVoltar = true,
  nivel = 'premium',
}: Props) {
  const info = INFO_NIVEL[nivel];
  const texto = descricao || info.descricaoPadrao;

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
          {/* Icone de raio (representa desbloqueio) */}
          <div className="w-16 h-16 mx-auto rounded-full grid place-items-center bg-[#7ad9b7]/20 text-[#7ad9b7] mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-white mb-2">Recurso {info.nome}</h2>
          <p className="text-white/60 text-sm mb-6 leading-relaxed">
            {texto}
          </p>

          <a
            href="/planos"
            className="inline-block w-full sm:w-auto px-6 py-3 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors no-underline"
          >
            Ver planos
          </a>

          <p className="text-white/40 text-xs mt-4">
            {info.rodape}
          </p>
        </div>
      </div>
    </main>
  );
}