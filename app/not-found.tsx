/**
 * Pagina 404 customizada - app/not-found.tsx
 *
 * Next.js renderiza essa pagina automaticamente quando uma rota
 * nao existe. Tom amigavel, com CTAs claros pra voltar pro app.
 */
 
export default function NotFound() {
  return (
    <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] flex items-center justify-center px-6">
      <div className="max-w-md w-full mx-auto text-center">
 
        {/* Numero grande */}
        <p
          className="text-7xl sm:text-8xl font-bold text-[#7ad9b7] mb-2 tracking-tight"
          style={{ letterSpacing: '-0.05em' }}
        >
          404
        </p>
 
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-6">
          Pagina nao encontrada
        </p>
 
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
          Essa página sumiu do mapa.
        </h1>
 
        <p className="text-white/60 text-base leading-relaxed mb-10">
          Você pode ter clicado num link antigo, digitado algo errado, ou
          essa página foi removida. Sem stress, vamos te levar de volta.
        </p>
 
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/dashboard"
            className="px-6 py-3 rounded-full text-sm font-bold bg-[#7ad9b7] text-[#010302] hover:bg-[#7cdbb9] transition-colors no-underline"
          >
            Ir pro dashboard
          </a>
          <a
            href="/suporte"
            className="px-6 py-3 rounded-full text-sm font-medium border border-white/15 text-white hover:bg-white/5 transition-colors no-underline"
          >
            Falar com suporte
          </a>
        </div>
 
      </div>
    </main>
  );
}