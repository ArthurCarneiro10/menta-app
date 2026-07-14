/**
 * Termos de Uso - app/termos/page.tsx
 *
 * IMPORTANTE: este eh um TEMPLATE funcional cobrindo pontos comuns
 * em SaaS brasileiros. Antes de operacao com usuarios pagantes reais,
 * REVISE com advogado especialista em direito digital/LGPD.
 *
 * Atualize a data "Ultima atualizacao" sempre que mudar algo aqui.
 *
 * ===================================================================
 * ATENCAO - CONFORMIDADE APPLE (3.1.2c):
 *
 * Esta pagina eh o EULA declarado no App Store Connect e o link de
 * "Termos de Uso" da tela de Planos do app iOS. O revisor da Apple ABRE
 * este link. Por isso o texto PRECISA:
 *   - listar os precos REAIS de cada plano, por plataforma
 *   - dizer que no iOS a cobranca eh feita pela APPLE (nao por gateway
 *     externo) e que o cancelamento eh nos Ajustes do iPhone
 *   - nao prometer periodo de teste onde ele nao existe (o IAP iOS foi
 *     criado sem trial)
 *
 * Divergencia entre o que este texto diz e o que o app cobra = rejeicao.
 * Se mudar preco/plano no app, ATUALIZE AQUI TAMBEM.
 * ===================================================================
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Termos de Uso · Menta',
  description: 'Termos e condições de uso do Menta.',
};

const ULTIMA_ATUALIZACAO = '14 de julho de 2026';

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
              em <a href="https://app.mentaapp.com.br" className="text-[#7ad9b7] no-underline">app.mentaapp.com.br</a> e
              em nossos aplicativos para iOS e Android, você concorda integralmente com
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
              <li>Análise de PDFs de fatura via inteligência artificial (disponível em todos os planos)</li>
              <li>Categorização automática por IA para classificar transações</li>
              <li>Open Finance regulado pelo Banco Central, via Pluggy, para conexão bancária — disponível <strong>exclusivamente no plano Max</strong></li>
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
              O Menta oferece um plano gratuito (<strong>Free</strong>) e dois planos
              pagos: <strong>Premium</strong> e <strong>Max</strong>. Todas as assinaturas
              pagas são de <strong>renovação automática</strong>: elas se renovam ao fim de
              cada ciclo até que você cancele.
            </p>
            <p>
              O local onde você contrata determina quem processa o pagamento e qual o
              valor cobrado:
            </p>

            <h3 className="text-white font-bold text-sm mt-5 mb-2">
              4.1. Assinaturas no aplicativo para iPhone e iPad (iOS)
            </h3>
            <p>
              As assinaturas contratadas pelo aplicativo iOS são vendidas e cobradas
              pela <strong>Apple</strong>, por meio de Compra dentro do App (In-App Purchase):
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Premium Mensal:</strong> R$ 34,90 por mês</li>
              <li><strong>Premium Anual:</strong> R$ 349,90 por ano</li>
              <li><strong>Max Mensal:</strong> R$ 58,90 por mês</li>
              <li><strong>Max Anual:</strong> R$ 589,90 por ano</li>
            </ul>
            <p>
              As assinaturas contratadas pelo iOS <strong>não incluem período de teste
              gratuito</strong>. O pagamento é debitado da sua conta Apple na confirmação
              da compra, e a assinatura é renovada automaticamente pela Apple, pelo mesmo
              valor, ao fim de cada ciclo, salvo se cancelada com pelo menos 24 horas de
              antecedência do fim do período vigente.
            </p>
            <p>
              Nessa modalidade, a relação de pagamento é entre você e a Apple. O Menta
              não tem acesso aos seus dados de pagamento.
            </p>

            <h3 className="text-white font-bold text-sm mt-5 mb-2">
              4.2. Assinaturas no site e no aplicativo Android
            </h3>
            <p>
              As assinaturas contratadas pelo site ou pelo aplicativo Android são
              processadas pelo <strong>Mercado Pago</strong>:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Premium Mensal:</strong> R$ 29,90 por mês</li>
              <li><strong>Premium Anual:</strong> R$ 299,00 por ano</li>
              <li><strong>Max Mensal:</strong> R$ 49,90 por mês</li>
              <li><strong>Max Anual:</strong> R$ 499,00 por ano</li>
            </ul>
            <p>
              Assinaturas no <strong>cartão de crédito</strong> incluem{' '}
              <strong>7 dias gratuitos</strong>. Após esse período, o valor é cobrado
              automaticamente no cartão cadastrado, com renovação automática a cada ciclo.
            </p>
            <p>
              Os <strong>planos anuais</strong> também podem ser pagos via <strong>Pix</strong>,
              em parcela única. O pagamento por Pix não é renovado automaticamente: ao fim
              do período contratado, o acesso retorna ao plano Free até que você contrate
              novamente.
            </p>
            <p>
              O Menta <strong>não armazena dados de cartão</strong> em nenhuma modalidade.
            </p>

            <h3 className="text-white font-bold text-sm mt-5 mb-2">
              4.3. Acesso entre plataformas
            </h3>
            <p>
              Sua assinatura está vinculada à sua conta Menta, e não ao aparelho. Um plano
              contratado em qualquer plataforma libera o acesso nas demais, com o mesmo login.
            </p>
          </Section>

          <Section titulo="5. Cancelamento e reembolso">
            <h3 className="text-white font-bold text-sm mb-2">
              5.1. Assinaturas contratadas pelo iOS (Apple)
            </h3>
            <p>
              O gerenciamento e o cancelamento são feitos diretamente pela Apple:
              acesse os <strong>Ajustes do iPhone ou iPad</strong> &gt; toque no seu nome
              &gt; <strong>Assinaturas</strong>, e selecione o Menta. O cancelamento
              interrompe a renovação automática e você mantém o acesso até o fim do
              período já pago.
            </p>
            <p>
              Solicitações de reembolso de compras realizadas pela Apple são tratadas
              exclusivamente pela Apple, em{' '}
              <a
                href="https://reportaproblem.apple.com"
                className="text-[#7ad9b7] no-underline"
              >
                reportaproblem.apple.com
              </a>
              , conforme as políticas dela.
            </p>

            <h3 className="text-white font-bold text-sm mt-5 mb-2">
              5.2. Assinaturas contratadas pelo site ou Android (Mercado Pago)
            </h3>
            <p>
              Você pode cancelar a qualquer momento pelo painel do app, em{' '}
              <strong>Configurações &gt; Plano</strong>. O cancelamento interrompe
              cobranças futuras e você mantém o acesso até o fim do período já pago.
            </p>
            <p>
              Conforme o Código de Defesa do Consumidor (art. 49), você tem
              direito a <strong>desistir da contratação em até 7 dias</strong> da
              assinatura, com reembolso integral, mediante solicitação ao suporte.
            </p>

            <h3 className="text-white font-bold text-sm mt-5 mb-2">
              5.3. Dados após o cancelamento
            </h3>
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
              terceiros (Pluggy, Mercado Pago, Apple, bancos integrados) que
              afetem a operação do Menta.
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