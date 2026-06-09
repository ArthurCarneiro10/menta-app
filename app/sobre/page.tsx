/**
 * Pagina /sobre - institucional
 *
 * Conta a historia/missao do Menta. Acessivel sem login.
 */
 
import type { Metadata } from 'next';
 
export const metadata: Metadata = {
  title: 'Sobre · Menta',
  description: 'O que é o Menta e quem está por trás.',
};
 
export default function SobrePage() {
  return (
    <main className="min-h-screen bg-linear-to-br from-[#0c2019] via-[#183e31] to-[#0c1f18]">
      <div className="max-w-2xl mx-auto px-6 py-12 pb-32">
 
        <header className="mb-10">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors no-underline mb-6"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Voltar
          </a>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#7cdbb9] mb-3">
            Sobre
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
            Finanças sem dor de cabeça.
          </h1>
        </header>
 
        <article className="space-y-8 text-white/75 text-base leading-relaxed">
 
          <section className="space-y-4">
            <p>
              O <strong className="text-white">Menta</strong> existe pra
              acabar com uma realidade absurda: quem quer organizar a
              vida financeira no Brasil precisa baixar PDFs, abrir
              planilhas, categorizar cada gasto manualmente, e perder
              horas que poderiam ser usadas em qualquer coisa mais útil.
            </p>
            <p>
              Open Finance e inteligência artificial deveriam ter
              resolvido isso há tempos. Resolvem, mas o que existe ou
              é caro demais, ou complicado demais, ou pensado pra
              empresa em vez de pra você.
            </p>
          </section>
 
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Como funciona
            </h2>
            <p>
              No <strong className="text-white">Free</strong>, você
              envia PDFs de fatura. A IA extrai cada gasto e categoriza
              automaticamente em Alimentação, Transporte, Compras,
              Lazer, Saúde, Educação, Moradia, Serviços ou Outros.
              Nada de planilha.
            </p>
            <p>
              No <strong className="text-white">Premium</strong>, você
              conecta seus bancos via Open Finance (Pluggy, autorizada
              pelo Banco Central). Tudo sincroniza automaticamente,
              em tempo real. Você vê saldo, gastos, padrões — sem
              fazer nada.
            </p>
          </section>
 
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Por que dá pra confiar
            </h2>
            <p>
              Open Finance é regulado pelo Banco Central. Pluggy é uma
              Iniciadora de Pagamentos autorizada. Pagamentos passam
              pelo Mercado Pago — o Menta não vê seu cartão.
            </p>
            <p>
              Seus dados ficam só seus. Não vendemos, não compartilhamos
              com anunciantes, não fazemos marketing direcionado em cima
              do que você gasta. Você pode desconectar, cancelar, ou
              excluir sua conta a qualquer momento, sem pergunta.
            </p>
          </section>
 
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Quem está por trás
            </h2>
            <p>
              Menta é construído por uma pessoa só:{' '}
              <strong className="text-white">Arthur Carneiro</strong>,
              dev e usuário de produtos financeiros. Tudo aqui foi feito
              porque eu mesmo queria usar — e nenhum produto existente
              fazia tudo o que eu precisava sem pedir uma fortuna ou
              uma planilha de configuração.
            </p>
            <p>
              Se você quiser conversar — feedback, dúvida, parceria —
              escreve em{' '}
              <a
                href="mailto:mentaapp.contato@gmail.com"
                className="text-[#7ad9b7] no-underline"
              >
                mentaapp.contato@gmail.com
              </a>
              . Eu leio tudo.
            </p>
          </section>
 
          <section className="pt-4">
            <a
              href="/dashboard"
              className="inline-block px-6 py-3 bg-[#7ad9b7] text-[#010302] font-bold rounded-full hover:bg-[#7cdbb9] transition-colors no-underline"
            >
              Começar agora
            </a>
          </section>
 
        </article>
 
        <footer className="mt-16 pt-8 border-t border-white/10">
          <div className="flex flex-wrap gap-4 text-sm">
            <a href="/termos" className="text-white/50 hover:text-white/80 no-underline transition-colors">
              Termos de Uso
            </a>
            <a href="/privacidade" className="text-white/50 hover:text-white/80 no-underline transition-colors">
              Política de Privacidade
            </a>
            <a href="/suporte" className="text-white/50 hover:text-white/80 no-underline transition-colors">
              Suporte
            </a>
          </div>
        </footer>
 
      </div>
    </main>
  );
}