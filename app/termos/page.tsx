/**
 * Termos de Uso - app/termos/page.tsx
 *
 * IMPORTANTE: este eh um TEMPLATE funcional cobrindo pontos comuns
 * em SaaS brasileiros. Antes de operacao com usuarios pagantes reais,
 * REVISE com advogado especialista em direito digital/LGPD.
 *
 * Atualize a data "Ultima atualizacao" sempre que mudar algo aqui.
 */
 
import type { Metadata } from 'next';
 
export const metadata: Metadata = {
  title: 'Termos de Uso · Menta',
  description: 'Termos e condições de uso do Menta.',
};
 
const ULTIMA_ATUALIZACAO = '08 de junho de 2026';
 
export default function TermosPage() {
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
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
            Termos de Uso
          </h1>
          <p className="text-white/40 text-xs uppercase tracking-widest">
            Última atualização: {ULTIMA_ATUALIZACAO}
          </p>
        </header>
 
        <article className="prose-menta space-y-6 text-white/75 text-sm leading-relaxed">
 
          <Section titulo="1. Aceitação dos termos">
            <p>
              Ao criar conta e utilizar o Menta (&ldquo;Serviço&rdquo;), disponibilizado
              em <a href="https://app.mentaapp.com.br" className="text-[#7ad9b7] no-underline">app.mentaapp.com.br</a>, você concorda integralmente com
              estes Termos de Uso. Caso não concorde, não utilize o Serviço.
            </p>
          </Section>
 
          <Section titulo="2. Descrição do serviço">
            <p>
              O Menta é uma plataforma de gestão financeira pessoal que permite
              ao usuário visualizar e categorizar suas movimentações financeiras.
              O Serviço utiliza:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Open Finance regulado pelo Banco Central, via Pluggy, para conexão bancária no plano Premium</li>
              <li>Análise de PDFs de fatura via inteligência artificial no plano Free</li>
              <li>Categorização automática por IA para classificar transações</li>
            </ul>
            <p>
              O Menta <strong>não realiza pagamentos, transferências ou
              movimentações financeiras</strong> entre contas. É exclusivamente
              ferramenta de visualização e organização.
            </p>
          </Section>
 
          <Section titulo="3. Cadastro e conta">
            <p>
              Você é responsável por manter a confidencialidade de suas
              credenciais de acesso. Atividades realizadas com sua conta são
              sua responsabilidade.
            </p>
            <p>
              Para criar conta, você deve ter ao menos 18 anos e fornecer
              informações verdadeiras e atualizadas.
            </p>
          </Section>
 
          <Section titulo="4. Planos e pagamento">
            <p>
              O Menta oferece um plano gratuito e planos Premium pagos:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Mensal:</strong> R$ 39,90/mês</li>
              <li><strong>Anual:</strong> R$ 358,80/ano (equivalente a R$ 29,90/mês, com economia de 25%)</li>
            </ul>
            <p>
              Ambos os planos Premium incluem <strong>7 dias gratuitos</strong>.
              Após esse período, o valor é cobrado automaticamente no cartão
              cadastrado, com renovação automática a cada ciclo.
            </p>
            <p>
              Os pagamentos são processados pelo Mercado Pago. O Menta não
              armazena dados de cartão.
            </p>
          </Section>
 
          <Section titulo="5. Cancelamento e reembolso">
            <p>
              Você pode cancelar sua assinatura a qualquer momento pelo painel
              do app (em Configurações &gt; Plano). O cancelamento interrompe
              cobranças futuras.
            </p>
            <p>
              Conforme o Código de Defesa do Consumidor (art. 49), você tem
              direito a <strong>desistir da contratação em até 7 dias</strong> da
              assinatura, com reembolso integral, mediante solicitação ao suporte.
            </p>
            <p>
              Após o cancelamento, seus dados bancários ficam armazenados por
              <strong> 30 dias</strong> caso queira reativar a assinatura. Findo
              esse prazo, eles são apagados automaticamente.
            </p>
          </Section>
 
          <Section titulo="6. Uso aceitável">
            <p>
              Você concorda em não utilizar o Serviço para:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Atividades ilegais, fraudulentas ou que violem direitos de terceiros</li>
              <li>Tentar acessar sistemas, dados ou contas de outros usuários</li>
              <li>Realizar engenharia reversa, descompilação ou tentativa de extração de código</li>
              <li>Sobrecarregar a infraestrutura com requisições automatizadas não autorizadas</li>
            </ul>
            <p>
              Violações podem resultar em suspensão ou encerramento da conta,
              sem reembolso.
            </p>
          </Section>
 
          <Section titulo="7. Propriedade intelectual">
            <p>
              Todos os direitos sobre o Serviço — incluindo marca, código,
              design, conteúdo e documentação — pertencem ao Menta. É vedada
              a reprodução total ou parcial sem autorização expressa.
            </p>
          </Section>
 
          <Section titulo="8. Limitação de responsabilidade">
            <p>
              O Menta é oferecido &ldquo;como está&rdquo;. Embora trabalhemos
              continuamente para garantir disponibilidade e precisão, não
              garantimos que o Serviço estará livre de erros ou interrupções.
            </p>
            <p>
              <strong>Categorizações por IA são automatizadas e podem conter
              imprecisões.</strong> Decisões financeiras baseadas em informações
              do Menta são de inteira responsabilidade do usuário.
            </p>
            <p>
              Não somos responsáveis por indisponibilidades de serviços de
              terceiros (Pluggy, Mercado Pago, bancos integrados) que afetem
              a operação do Menta.
            </p>
          </Section>
 
          <Section titulo="9. Alterações dos termos">
            <p>
              Estes termos podem ser modificados a qualquer momento. Mudanças
              relevantes serão comunicadas por e-mail e/ou notificação no app
              com antecedência mínima de 7 dias.
            </p>
            <p>
              O uso continuado após a modificação implica aceitação dos novos
              termos. Caso discorde, você pode cancelar sua conta.
            </p>
          </Section>
 
          <Section titulo="10. Lei aplicável e foro">
            <p>
              Estes Termos são regidos pela legislação brasileira. Para
              dirimir controvérsias, fica eleito o foro da Comarca de
              Santos/SP, com renúncia a qualquer outro.
            </p>
          </Section>
 
          <Section titulo="11. Contato">
            <p>
              Dúvidas sobre estes Termos? Entre em contato pelo email{' '}
              <a
                href="mailto:mentaapp.contato@gmail.com"
                className="text-[#7ad9b7] no-underline"
              >
                mentaapp.contato@gmail.com
              </a>
              .
            </p>
          </Section>
 
        </article>
 
        <footer className="mt-16 pt-8 border-t border-white/10">
          <div className="flex flex-wrap gap-4 text-sm">
            <a href="/privacidade" className="text-white/50 hover:text-white/80 no-underline transition-colors">
              Política de Privacidade
            </a>
            <a href="/suporte" className="text-white/50 hover:text-white/80 no-underline transition-colors">
              Suporte
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
 
function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-3 tracking-tight">
        {titulo}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}