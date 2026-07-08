'use client';

/**
 * Cartoes educativos (WEB) - "Entenda os investimentos".
 *
 * Uso na investir/page.tsx:
 *   import CartoesEducativos from '@/components/CartoesEducativos';
 *   ...
 *   <div style={{ padding: '0 16px 16px' }}><CartoesEducativos /></div>
 */

import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const COLORS = {
  primary: '#7ad9b7',
  primaryMid: '#3d7d66',
  ink: '#010302',
  muted: '#86958f',
};

type Risco = 'Baixo' | 'Medio' | 'Alto';

const CORES_RISCO: Record<Risco, { bg: string; texto: string }> = {
  Baixo: { bg: 'rgba(122,217,183,0.18)', texto: '#2f6b56' },
  Medio: { bg: 'rgba(234,179,8,0.15)', texto: '#8a6d1a' },
  Alto: { bg: 'rgba(239,68,68,0.12)', texto: '#b4463f' },
};

type Cartao = { titulo: string; risco: Risco; texto: string };

const CARTOES: Cartao[] = [
  {
    titulo: 'Renda fixa vs renda variavel',
    risco: 'Baixo',
    texto:
      'Renda fixa e quando voce sabe mais ou menos quanto vai render (ex: Tesouro, CDB) - mais previsivel e seguro. Renda variavel (ex: acoes, fundos imobiliarios) oscila: pode render mais, mas tambem pode cair. Quanto mais longe o objetivo, mais da pra aceitar variacao.',
  },
  {
    titulo: 'Tesouro Selic',
    risco: 'Baixo',
    texto:
      'Um titulo do governo que acompanha a taxa Selic. E um dos investimentos mais seguros do Brasil e tem liquidez (da pra resgatar rapido). Bom pra reserva de emergencia e metas de curto prazo.',
  },
  {
    titulo: 'CDB',
    risco: 'Baixo',
    texto:
      'Voce empresta dinheiro pro banco e recebe juros. Tem protecao do FGC ate certo limite por instituicao, o que traz seguranca. Alguns tem liquidez diaria, outros so no vencimento - vale conferir antes.',
  },
  {
    titulo: 'Fundos Imobiliarios (FII)',
    risco: 'Medio',
    texto:
      'Voce compra cotas de um fundo que investe em imoveis (shoppings, galpoes, etc.) e pode receber rendimentos periodicos. E renda variavel: o valor da cota oscila na bolsa. Costuma ser usado pra renda no medio/longo prazo.',
  },
  {
    titulo: 'Acoes',
    risco: 'Alto',
    texto:
      'Uma acao e um pedacinho de uma empresa. Se a empresa vai bem, tende a valorizar; se vai mal, pode cair. E o investimento com maior potencial e maior risco - faz mais sentido com dinheiro de longo prazo e com estudo antes.',
  },
];

export default function CartoesEducativos() {
  const [aberto, setAberto] = useState<number | null>(null);

  return (
    <div style={{ background: 'white', borderRadius: '20px', padding: '20px', border: '1px solid #eef2ef' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <BookOpen size={20} color={COLORS.primaryMid} />
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>
          Entenda os investimentos
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {CARTOES.map((c, i) => {
          const ativo = aberto === i;
          const cor = CORES_RISCO[c.risco];
          return (
            <div key={c.titulo} style={{ background: '#f4f7f5', borderRadius: '14px', padding: '14px' }}>
              <button
                onClick={() => setAberto(ativo ? null : i)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', padding: 0 }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>{c.titulo}</p>
                  <span style={{ display: 'inline-block', marginTop: '6px', background: cor.bg, color: cor.texto, borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}>
                    Risco {c.risco.toLowerCase()}
                  </span>
                </div>
                {ativo
                  ? <ChevronUp size={18} color={COLORS.muted} />
                  : <ChevronDown size={18} color={COLORS.muted} />}
              </button>
              {ativo && (
                <p style={{ fontSize: '13px', color: COLORS.muted, lineHeight: 1.5, marginTop: '10px', marginBottom: 0 }}>
                  {c.texto}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: '10px', color: COLORS.muted, textAlign: 'center', marginTop: '16px', marginBottom: 0 }}>
        Conteudo educativo, nao e recomendacao de investimento.
      </p>
    </div>
  );
}