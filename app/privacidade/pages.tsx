/**
 * Politica de Privacidade - app/privacidade/page.tsx
 *
 * IMPORTANTE: este eh um TEMPLATE funcional cobrindo pontos comuns
 * de LGPD pra SaaS brasileiros que lidam com dados financeiros.
 * Antes de operacao com usuarios pagantes reais, REVISE com advogado
 * especialista em LGPD.
 *
 * Atualize a data "Ultima atualizacao" sempre que mudar algo aqui.
 */
 
import type { Metadata } from 'next';
 
export const metadata: Metadata = {
  title: 'Política de Privacidade · Menta',
  description: 'Como o Menta coleta, usa e protege seus dados.',
};
 
const ULTIMA_ATUALIZACAO = '08 de junho de 2026';
 
export default function PrivacidadePage() {
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
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
            Política de Privacidade
          </h1>
          <p className="text-white/40 text-xs uppercase tracking-widest">
            Última atualização: {ULTIMA_ATUALIZACAO}
          </p>
        </header>
 
        <article className="space-y-6 text-white/75 text-sm leading-relaxed">
 
          <Section titulo="Resumo rápido">
            <p>
              Para você entender em 30 segundos:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Coletamos só o necessário pra fazer o Menta funcionar pra você</li>
              <li>Seus dados bancários nunca são vendidos ou compartilhados pra publicidade</li>
              <li>Você pode pedir exclusão da sua conta e dados a qualquer momento</li>
              <li>Conexão bancária é via Pluggy, autorizada pelo Banco Central</li>
              <li>Pagamentos vão direto pro Mercado Pago — não armazenamos dados de cartão</li>
            </ul>
          </Section>
 
          <Section titulo="1. Quem é o controlador">
            <p>
              Para fins da Lei Geral de Proteção de Dados (LGPD - Lei
              13.709/2018), o controlador dos dados pessoais tratados pelo
              Menta é Arthur Carneiro, responsável pela operação do app em{' '}
              <a href="https://app.mentaapp.com.br" className="text-[#7ad9b7] no-underline">
                app.mentaapp.com.br
              </a>.
            </p>
            <p>
              Encarregado pelo Tratamento de Dados (DPO):
              <br />
              <a
                href="mailto:mentaapp.contato@gmail.com"
                className="text-[#7ad9b7] no-underline"
              >
                mentaapp.contato@gmail.com
              </a>
            </p>
          </Section>
 
          <Section titulo="2. Quais dados coletamos">
            <p><strong>Dados de cadastro</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Nome</li>
              <li>Email</li>
              <li>Idade (opcional)</li>
              <li>Foto de perfil (opcional)</li>
              <li>Senha (armazenada criptografada via Supabase Auth)</li>
            </ul>
 
            <p className="pt-2"><strong>Dados financeiros (plano Premium)</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Conexões com bancos via Open Finance (Pluggy)</li>
              <li>Contas bancárias e cartões vinculados (nome do banco, saldo, número parcial)</li>
              <li>Histórico de transações: data, descrição, valor, categoria</li>
            </ul>
 
            <p className="pt-2"><strong>Dados financeiros (plano Free)</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>PDFs de faturas de cartão que você opcionalmente envia</li>
              <li>Transações extraídas dos PDFs pela IA</li>
            </ul>
 
            <p className="pt-2"><strong>Dados de assinatura</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Plano contratado, status de pagamento, datas de cobrança</li>
              <li><strong>Não armazenamos dados de cartão</strong> — toda operação financeira passa direto pelo Mercado Pago</li>
            </ul>
 
            <p className="pt-2"><strong>Dados técnicos</strong></p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Logs de acesso e uso (IP, navegador, sistema operacional)</li>
              <li>Métricas anônimas de uso do app (visitas, ações)</li>
            </ul>
          </Section>
 
          <Section titulo="3. Para que usamos seus dados">
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Operar o serviço:</strong> exibir suas finanças, categorizar transações, oferecer funcionalidades</li>
              <li><strong>Categorização por IA:</strong> processamos descrições de transações via modelos de IA para classificá-las automaticamente em categorias (Alimentação, Transporte, etc)</li>
              <li><strong>Atendimento:</strong> responder dúvidas e resolver problemas</li>
              <li><strong>Segurança:</strong> detectar fraudes, prevenir abusos, manter o sistema seguro</li>
              <li><strong>Comunicação:</strong> avisos importantes sobre sua conta, atualizações relevantes do serviço</li>
              <li><strong>Cobrança:</strong> processar assinaturas e renovações</li>
              <li><strong>Cumprimento legal:</strong> obrigações fiscais, regulatórias e judiciais</li>
            </ul>
          </Section>
 
          <Section titulo="4. Base legal (LGPD)">
            <p>
              O tratamento dos seus dados se baseia em:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Execução de contrato</strong> (art. 7º, V): pra entregar o serviço que você contratou</li>
              <li><strong>Consentimento</strong> (art. 7º, I): pra conectar suas contas bancárias via Open Finance — você dá permissão explícita no ato da conexão</li>
              <li><strong>Legítimo interesse</strong> (art. 7º, IX): pra segurança, prevenção a fraudes e melhoria do serviço</li>
              <li><strong>Cumprimento de obrigação legal</strong> (art. 7º, II): pra atender exigências fiscais e regulatórias</li>
            </ul>
          </Section>
 
          <Section titulo="5. Compartilhamento com terceiros">
            <p>
              Compartilhamos dados estritamente com operadores necessários
              pra entregar o serviço:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Pluggy</strong> (Open Finance): conecta suas contas bancárias com sua autorização explícita. Regulada pelo Banco Central (CNPJ 37.943.755/0001-30).</li>
              <li><strong>Supabase</strong>: armazena seus dados (banco de dados gerenciado, com criptografia)</li>
              <li><strong>Mercado Pago</strong>: processa pagamentos e gerencia assinaturas. Dados de cartão ficam exclusivamente lá.</li>
              <li><strong>Anthropic (Claude)</strong>: processa descrições de transações para categorização. Não recebem seu nome, email, ou identificadores pessoais — apenas a descrição da transação.</li>
              <li><strong>Vercel</strong>: hospedagem do aplicativo, com logs técnicos básicos</li>
            </ul>
            <p>
              <strong>Não vendemos seus dados.</strong> Não compartilhamos com
              anunciantes, brokers ou empresas de marketing.
            </p>
          </Section>
 
          <Section titulo="6. Seus direitos">
            <p>
              Conforme a LGPD, você tem direito a:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Acesso</strong>: saber quais dados temos sobre você</li>
              <li><strong>Correção</strong>: atualizar dados imprecisos</li>
              <li><strong>Anonimização ou exclusão</strong>: pedir que apaguemos seus dados</li>
              <li><strong>Portabilidade</strong>: receber seus dados em formato estruturado</li>
              <li><strong>Revogação de consentimento</strong>: especialmente para conexões Open Finance</li>
              <li><strong>Informação sobre compartilhamento</strong>: saber com quem seus dados são compartilhados</li>
              <li><strong>Oposição</strong>: contestar tratamento baseado em legítimo interesse</li>
            </ul>
            <p>
              Pra exercer qualquer direito, escreva pra{' '}
              <a
                href="mailto:mentaapp.contato@gmail.com"
                className="text-[#7ad9b7] no-underline"
              >
                mentaapp.contato@gmail.com
              </a>
              . Respondemos em até 15 dias úteis.
            </p>
            <p>
              Você também pode excluir sua conta diretamente em{' '}
              <strong>Configurações &gt; Excluir conta</strong>.
            </p>
          </Section>
 
          <Section titulo="7. Segurança dos dados">
            <p>
              Adotamos medidas razoáveis pra proteger seus dados:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Conexões em HTTPS (criptografia em trânsito)</li>
              <li>Dados armazenados criptografados pelo Supabase</li>
              <li>Senhas armazenadas com hashing seguro (nunca em texto puro)</li>
              <li>Controle de acesso via autenticação obrigatória</li>
              <li>Row Level Security (RLS) no banco — cada usuário só acessa próprios dados</li>
              <li>Logs de acesso pra detecção de anomalias</li>
            </ul>
            <p>
              Apesar disso, nenhum sistema é 100% imune. Em caso de incidente
              de segurança que afete seus dados, comunicaremos você e a ANPD
              conforme exige a LGPD.
            </p>
          </Section>
 
          <Section titulo="8. Retenção dos dados">
            <p>
              Mantemos seus dados enquanto sua conta estiver ativa:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Após cancelamento Premium</strong>: dados bancários ficam por 30 dias (período de reativação)</li>
              <li><strong>Após exclusão de conta</strong>: dados pessoais são removidos em até 30 dias</li>
              <li><strong>Logs de pagamento e nota fiscal</strong>: mantidos por 5 anos por obrigação legal/fiscal</li>
              <li><strong>Logs de segurança</strong>: mantidos por 6 meses</li>
            </ul>
          </Section>
 
          <Section titulo="9. Cookies e tecnologias similares">
            <p>
              Usamos cookies essenciais pra manter sua sessão logada e cookies
              técnicos pra funcionamento do app. Não usamos cookies de
              terceiros pra publicidade ou rastreamento entre sites.
            </p>
            <p>
              Métricas anônimas de uso (visitas, ações no app) são coletadas
              via Vercel Analytics em formato agregado, sem identificação
              individual.
            </p>
          </Section>
 
          <Section titulo="10. Crianças e adolescentes">
            <p>
              O Menta não é destinado a menores de 18 anos. Não coletamos
              dados de crianças e adolescentes intencionalmente.
            </p>
          </Section>
 
          <Section titulo="11. Alterações nesta política">
            <p>
              Esta política pode ser atualizada periodicamente. Mudanças
              substanciais serão comunicadas por email e notificação no app
              com 7 dias de antecedência.
            </p>
          </Section>
 
          <Section titulo="12. Contato">
            <p>
              Dúvidas, solicitações ou reclamações sobre privacidade:
              <br />
              <a
                href="mailto:mentaapp.contato@gmail.com"
                className="text-[#7ad9b7] no-underline"
              >
                mentaapp.contato@gmail.com
              </a>
            </p>
            <p>
              Você também pode contatar a Autoridade Nacional de Proteção
              de Dados (ANPD) em{' '}
              <a
                href="https://www.gov.br/anpd/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#7ad9b7] no-underline"
              >
                gov.br/anpd
              </a>
              .
            </p>
          </Section>
 
        </article>
 
        <footer className="mt-16 pt-8 border-t border-white/10">
          <div className="flex flex-wrap gap-4 text-sm">
            <a href="/termos" className="text-white/50 hover:text-white/80 no-underline transition-colors">
              Termos de Uso
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