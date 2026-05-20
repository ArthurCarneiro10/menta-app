export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18] p-6">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white tracking-tight mb-4">
          Menta <span className="text-[#7ad9b7]">App</span>
        </h1>
        <p className="text-white/70 text-lg">
          Seu dinheiro, no piloto automático.
        </p>
        <p className="mt-8 text-[#7ad9b7] text-sm font-semibold uppercase tracking-widest">
          Em construção · v0.1
        </p>
      </div>
    </main>
  );
}