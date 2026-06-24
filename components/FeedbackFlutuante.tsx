/**
 * Botao flutuante de feedback do beta.
 *
 * Aparece em todas as telas logadas (basta estar no layout do grupo (app)).
 * Abre o WhatsApp com uma mensagem pronta - o tester so completa e envia.
 *
 * >>> PARA TROCAR O NUMERO: edite a constante WHATSAPP_NUMERO abaixo. <<<
 * Formato: codigo do pais + DDD + numero, so digitos. Ex Brasil: 5513999998888
 */

import { MessageCircle } from 'lucide-react';

// TODO: trocar pelo numero real de feedback (so digitos, com 55 na frente)
const WHATSAPP_NUMERO = '5513999998888';

const MENSAGEM = 'Ola! Tenho um feedback sobre a Menta (beta): ';

export default function FeedbackFlutuante() {
  const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(MENSAGEM)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Enviar feedback pelo WhatsApp"
      className="fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-full bg-[#7ad9b7] px-4 py-3 text-sm font-bold text-[#010302] shadow-lg shadow-black/30 hover:bg-[#7cdbb9] transition-colors"
    >
      <MessageCircle size={18} strokeWidth={2.5} />
      Feedback
    </a>
  );
}