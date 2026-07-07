'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TrendingUp, Sparkles, PiggyBank, Target } from 'lucide-react';

// Paleta oficial Menta
const COLORS = {
  primary: '#7ad9b7',
  primaryLight: '#7cdbb9',
  primaryMid: '#3d7d66',
  dark1: '#183e31',
  dark2: '#0c2019',
  ink: '#010302',
  muted: '#86958f',
};

// Formata numero como dinheiro
const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Formata sem centavos (pra numeros grandes)
const fmtCurto = (n: number) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

// Calcula juros compostos pra aporte mensal
// FV = aporte * [((1+i)^n - 1) / i]
function calcularFuturo(aporteMensal: number, anos: number, taxaAnual: number) {
  const i = taxaAnual / 12; // taxa mensal
  const n = anos * 12; // numero de meses
  if (i === 0) return aporteMensal * n;
  return aporteMensal * ((Math.pow(1 + i, n) - 1) / i);
}

// Carteira sugerida (divisao classica conservadora)
const CARTEIRA = [
  { nome: 'Tesouro Selic', pct: 60, cor: '#7ad9b7' },
  { nome: 'CDB', pct: 25, cor: '#3d7d66' },
  { nome: 'Fundo de Acoes', pct: 15, cor: '#183e31' },
];

const TAXA_ANUAL = 0.10; // 10% ao ano (estimativa conservadora)

// Dicas educativas por prazo da meta (sem recomendar ativo especifico)
const DICA_CURTO =
  'Como e uma meta de curto prazo, o ideal e renda fixa segura (ex: Tesouro Selic, CDB de liquidez diaria) - dinheiro que voce vai usar em breve nao combina com renda variavel, que oscila.';
const DICA_LONGO =
  'Como e uma meta de prazo mais longo, da pra pensar numa parte em renda variavel (que tem mais potencial e mais oscilacao) alem da renda fixa. Um perfil equilibrado ajuda.';

type MetaResumo = {
  id: string;
  titulo: string;
  valor_alvo: number;
  valor_atual: number;
  emoji: string;
};

export default function InvestirPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [totalGasto, setTotalGasto] = useState(0);
  const [aporte, setAporte] = useState(100);
  const [metas, setMetas] = useState<MetaResumo[]>([]);

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Ultima fatura (pra sugerir o aporte inicial)
      const { data } = await supabase
        .from('faturas')
        .select('total')
        .eq('status', 'analisada')
        .order('analisado_em', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.total) {
        setTotalGasto(data.total);
        const sugestao = Math.min(3000, Math.max(50, Math.round((data.total * 0.1) / 10) * 10));
        setAporte(sugestao);
      }

      // Metas do usuario (pra ponte). So as que ainda faltam dinheiro.
      const { data: metasData } = await supabase
        .from('metas')
        .select('id, titulo, valor_alvo, valor_atual, emoji')
        .order('criado_em', { ascending: false });

      if (metasData) {
        const emAndamento = (metasData as MetaResumo[]).filter(
          (m) => Number(m.valor_atual) < Number(m.valor_alvo)
        );
        setMetas(emAndamento);
      }

      setCarregando(false);
    }
    carregar();
  }, [router]);

  // calcula o futuro pra 5, 10 e 20 anos
  const futuro5 = calcularFuturo(aporte, 5, TAXA_ANUAL);
  const futuro10 = calcularFuturo(aporte, 10, TAXA_ANUAL);
  const futuro20 = calcularFuturo(aporte, 20, TAXA_ANUAL);
  const totalInvestido20 = aporte * 12 * 20;
  const lucro20 = futuro20 - totalInvestido20;

  if (carregando) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: COLORS.muted }}>
        Carregando...
      </div>
    );
  }

  return (
    <div>
      {/* Cabecalho */}
      <div style={{ background: COLORS.dark1, padding: '48px 24px 24px', borderRadius: '0 0 28px 28px' }}>
        <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 700, margin: 0 }}>Investir</h1>
        <p style={{ color: COLORS.primaryLight, fontSize: '14px', marginTop: '4px' }}>
          Veja seu dinheiro crescer no tempo
        </p>
      </div>

      {/* Card sugestao da IA */}
      <div style={{ padding: '16px' }}>
        <div style={{ background: COLORS.primary, borderRadius: '20px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Sparkles size={18} color={COLORS.ink} />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.ink }}>
              Sugestao da IA
            </span>
          </div>
          {totalGasto > 0 ? (
            <p style={{ color: COLORS.ink, fontSize: '15px', lineHeight: 1.5, margin: 0 }}>
              Voce gastou <strong>R$ {fmt(totalGasto)}</strong> na ultima fatura. Que tal comecar guardando{' '}
              <strong>R$ {fmtCurto(aporte)}</strong> por mes? Olha no que isso pode virar 👇
            </p>
          ) : (
            <p style={{ color: COLORS.ink, fontSize: '15px', lineHeight: 1.5, margin: 0 }}>
              Comece a investir um pouquinho por mes e veja a magica dos juros compostos. Ajuste o valor abaixo 👇
            </p>
          )}
        </div>
      </div>

      {/* Simulador */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '20px', border: '1px solid #eef2ef' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <PiggyBank size={20} color={COLORS.primaryMid} />
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>
              Simulador de riqueza
            </h2>
          </div>

          {/* Valor do aporte */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '12px', color: COLORS.muted, margin: 0 }}>Guardando por mes</p>
            <p style={{ fontSize: '32px', fontWeight: 700, color: COLORS.primaryMid, margin: '4px 0' }}>
              R$ {fmtCurto(aporte)}
            </p>
          </div>

          {/* Slider */}
          <input
            type="range"
            min={50}
            max={3000}
            step={10}
            value={aporte}
            onChange={(e) => setAporte(Number(e.target.value))}
            style={{ width: '100%', accentColor: COLORS.primary, cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: COLORS.muted, marginBottom: '20px' }}>
            <span>R$ 50</span>
            <span>R$ 3.000</span>
          </div>

          {/* Destaque: 20 anos */}
          <div style={{ background: COLORS.dark1, borderRadius: '16px', padding: '20px', textAlign: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: COLORS.primaryLight, margin: 0 }}>
              Em 20 anos voce teria
            </p>
            <p style={{ fontSize: '36px', fontWeight: 700, color: 'white', margin: '8px 0 4px' }}>
              R$ {fmtCurto(futuro20)}
            </p>
            <p style={{ fontSize: '12px', color: COLORS.primaryLight, margin: 0 }}>
              Voce investiu R$ {fmtCurto(totalInvestido20)} e ganhou R$ {fmtCurto(lucro20)} em juros
            </p>
          </div>

          {/* 5 e 10 anos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: '#f4f7f5', borderRadius: '16px', padding: '14px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: COLORS.primaryMid, margin: 0 }}>
                Em 5 anos
              </p>
              <p style={{ fontSize: '18px', fontWeight: 700, color: COLORS.ink, margin: '4px 0 0' }}>
                R$ {fmtCurto(futuro5)}
              </p>
            </div>
            <div style={{ background: '#f4f7f5', borderRadius: '16px', padding: '14px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: COLORS.primaryMid, margin: 0 }}>
                Em 10 anos
              </p>
              <p style={{ fontSize: '18px', fontWeight: 700, color: COLORS.ink, margin: '4px 0 0' }}>
                R$ {fmtCurto(futuro10)}
              </p>
            </div>
          </div>

          <p style={{ fontSize: '10px', color: COLORS.muted, textAlign: 'center', marginTop: '12px', marginBottom: 0 }}>
            Simulacao com rendimento de 10% ao ano. Investimentos reais podem render mais ou menos.
          </p>
        </div>
      </div>

      {/* PONTE COM AS METAS */}
      <div style={{ padding: '16px' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '20px', border: '1px solid #eef2ef' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Target size={20} color={COLORS.primaryMid} />
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>
              Realize suas metas
            </h2>
          </div>

          {metas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <p style={{ fontSize: '13px', color: COLORS.muted, lineHeight: 1.5, margin: '0 0 14px' }}>
                Voce ainda nao tem metas. Crie uma e a Menta te mostra quanto guardar por mes pra chegar la.
              </p>
              <button
                onClick={() => router.push('/metas')}
                style={{ background: COLORS.primary, color: COLORS.ink, border: 'none', borderRadius: '999px', padding: '10px 20px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                Criar uma meta
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {metas.map((meta) => {
                const falta = Math.max(0, Number(meta.valor_alvo) - Number(meta.valor_atual));
                const por1ano = falta / 12;
                const por2anos = falta / 24;
                const por3anos = falta / 36;
                const ehCurta = por2anos <= 1000;

                return (
                  <div key={meta.id} style={{ background: '#f4f7f5', borderRadius: '16px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '26px' }}>{meta.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '15px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>{meta.titulo}</p>
                        <p style={{ fontSize: '12px', color: COLORS.muted, margin: '2px 0 0' }}>faltam R$ {fmt(falta)}</p>
                      </div>
                    </div>

                    <p style={{ fontSize: '11px', color: COLORS.muted, fontWeight: 600, margin: '0 0 8px' }}>
                      Guardando por mes pra chegar la:
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      {[
                        { anos: '1 ano', valor: por1ano },
                        { anos: '2 anos', valor: por2anos },
                        { anos: '3 anos', valor: por3anos },
                      ].map((p) => (
                        <div key={p.anos} style={{ background: 'white', borderRadius: '12px', padding: '10px', textAlign: 'center', border: '1px solid #eef2ef' }}>
                          <p style={{ fontSize: '10px', color: COLORS.muted, fontWeight: 600, margin: 0 }}>{p.anos}</p>
                          <p style={{ fontSize: '14px', fontWeight: 700, color: COLORS.primaryMid, margin: '2px 0 0' }}>
                            R$ {fmtCurto(p.valor)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: 'rgba(122,217,183,0.12)', borderRadius: '12px', padding: '12px' }}>
                      <p style={{ fontSize: '12px', color: COLORS.primaryMid, lineHeight: 1.5, margin: 0 }}>
                        💡 {ehCurta ? DICA_CURTO : DICA_LONGO}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p style={{ fontSize: '10px', color: COLORS.muted, textAlign: 'center', marginTop: '16px', marginBottom: 0 }}>
            Conteudo educativo, nao e recomendacao de investimento.
          </p>
        </div>
      </div>

      {/* Carteira sugerida */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '20px', border: '1px solid #eef2ef' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <TrendingUp size={20} color={COLORS.primaryMid} />
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>
              Carteira sugerida
            </h2>
          </div>

          {/* Barra de proporcao */}
          <div style={{ display: 'flex', height: '12px', borderRadius: '999px', overflow: 'hidden', marginBottom: '16px' }}>
            {CARTEIRA.map((item) => (
              <div key={item.nome} style={{ width: `${item.pct}%`, background: item.cor }} />
            ))}
          </div>

          {/* Lista */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {CARTEIRA.map((item) => (
              <div key={item.nome} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: item.cor, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: COLORS.ink }}>{item.nome}</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: COLORS.primaryMid }}>{item.pct}%</span>
                <span style={{ fontSize: '13px', color: COLORS.muted, minWidth: '70px', textAlign: 'right' }}>
                  R$ {fmtCurto((aporte * item.pct) / 100)}/mes
                </span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: '10px', color: COLORS.muted, textAlign: 'center', marginTop: '16px', marginBottom: 0 }}>
            Sugestao educativa, nao e recomendacao de investimento.
          </p>
        </div>
      </div>
    </div>
  );
}