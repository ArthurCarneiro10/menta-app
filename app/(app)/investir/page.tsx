'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { TrendingUp, Sparkles, PiggyBank, Target, ShieldCheck, RotateCcw } from 'lucide-react';
import CartoesEducativos from '@/components/CartoesEducativos';

const COLORS = {
  primary: '#7ad9b7',
  primaryLight: '#7cdbb9',
  primaryMid: '#3d7d66',
  dark1: '#183e31',
  dark2: '#0c2019',
  ink: '#010302',
  muted: '#86958f',
};

type Perfil = 'conservador' | 'moderado' | 'arrojado';

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCurto = (n: number) =>
  n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });

function calcularFuturo(aporteMensal: number, anos: number, taxaAnual: number) {
  const i = taxaAnual / 12;
  const n = anos * 12;
  if (i === 0) return aporteMensal * n;
  return aporteMensal * ((Math.pow(1 + i, n) - 1) / i);
}

const TAXA_ANUAL = 0.10;

// ===== QUIZ =====
type Opcao = { texto: string; pontos: 1 | 2 | 3 };
type Pergunta = { pergunta: string; opcoes: Opcao[] };

const PERGUNTAS: Pergunta[] = [
  {
    pergunta: 'Se seus investimentos caissem 20% num mes, voce...',
    opcoes: [
      { texto: 'Resgataria tudo, com medo de perder mais', pontos: 1 },
      { texto: 'Esperaria pra ver, sem mexer', pontos: 2 },
      { texto: 'Aproveitaria pra investir mais', pontos: 3 },
    ],
  },
  {
    pergunta: 'Quando voce pensa em investir, o que pesa mais?',
    opcoes: [
      { texto: 'Seguranca: prefiro nao correr risco', pontos: 1 },
      { texto: 'Equilibrio entre seguranca e retorno', pontos: 2 },
      { texto: 'Crescer rapido, mesmo com risco', pontos: 3 },
    ],
  },
  {
    pergunta: 'Por quanto tempo deixaria esse dinheiro rendendo?',
    opcoes: [
      { texto: 'Menos de 1 ano', pontos: 1 },
      { texto: 'De 1 a 5 anos', pontos: 2 },
      { texto: 'Mais de 5 anos', pontos: 3 },
    ],
  },
];

function perfilPorPontos(total: number): Perfil {
  if (total <= 4) return 'conservador';
  if (total <= 7) return 'moderado';
  return 'arrojado';
}

const CARTEIRAS: Record<Perfil, { nome: string; pct: number; cor: string }[]> = {
  conservador: [
    { nome: 'Tesouro Selic', pct: 80, cor: '#7ad9b7' },
    { nome: 'CDB', pct: 15, cor: '#3d7d66' },
    { nome: 'Fundo de Acoes', pct: 5, cor: '#183e31' },
  ],
  moderado: [
    { nome: 'Tesouro Selic', pct: 60, cor: '#7ad9b7' },
    { nome: 'CDB', pct: 25, cor: '#3d7d66' },
    { nome: 'Fundo de Acoes', pct: 15, cor: '#183e31' },
  ],
  arrojado: [
    { nome: 'Tesouro Selic', pct: 40, cor: '#7ad9b7' },
    { nome: 'CDB', pct: 25, cor: '#3d7d66' },
    { nome: 'Fundo de Acoes', pct: 35, cor: '#183e31' },
  ],
};

const PERFIL_LABEL: Record<Perfil, string> = {
  conservador: 'Conservador', moderado: 'Moderado', arrojado: 'Arrojado',
};
const PERFIL_DESC: Record<Perfil, string> = {
  conservador: 'Voce prioriza seguranca. Sua carteira sugerida tem mais renda fixa.',
  moderado: 'Voce equilibra seguranca e retorno. Um pouco de cada mundo.',
  arrojado: 'Voce topa mais risco em troca de potencial. Mais renda variavel.',
};

const DICA_CURTO =
  'Como e uma meta de curto prazo, o ideal e renda fixa segura (ex: Tesouro Selic, CDB de liquidez diaria) - dinheiro que voce vai usar em breve nao combina com renda variavel, que oscila.';
const DICA_LONGO =
  'Como e uma meta de prazo mais longo, da pra pensar numa parte em renda variavel (que tem mais potencial e mais oscilacao) alem da renda fixa. Um perfil equilibrado ajuda.';

type MetaResumo = {
  id: string; titulo: string; valor_alvo: number; valor_atual: number; emoji: string;
};

export default function InvestirPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [userId, setUserId] = useState('');
  const [totalGasto, setTotalGasto] = useState(0);
  const [aporte, setAporte] = useState(100);
  const [metas, setMetas] = useState<MetaResumo[]>([]);

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [quizAberto, setQuizAberto] = useState(false);
  const [passo, setPasso] = useState(0);
  const [pontos, setPontos] = useState(0);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      const { data: perfilData } = await supabase
        .from('profiles').select('perfil_risco').eq('id', user.id).maybeSingle();
      if (perfilData?.perfil_risco) setPerfil(perfilData.perfil_risco as Perfil);

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

      const { data: metasData } = await supabase
        .from('metas')
        .select('id, titulo, valor_alvo, valor_atual, emoji')
        .order('criado_em', { ascending: false });
      if (metasData) {
        setMetas((metasData as MetaResumo[]).filter(
          (m) => Number(m.valor_atual) < Number(m.valor_alvo)
        ));
      }

      setCarregando(false);
    }
    carregar();
  }, [router]);

  function abrirQuiz() {
    setPasso(0); setPontos(0); setQuizAberto(true);
  }

  async function responder(p: 1 | 2 | 3) {
    const novoTotal = pontos + p;
    if (passo < PERGUNTAS.length - 1) {
      setPontos(novoTotal);
      setPasso(passo + 1);
      return;
    }
    const resultado = perfilPorPontos(novoTotal);
    setSalvandoPerfil(true);
    try {
      await supabase.from('profiles').update({ perfil_risco: resultado }).eq('id', userId);
    } catch {
      // se falhar, mostra o resultado na sessao mesmo assim
    }
    setPerfil(resultado);
    setQuizAberto(false);
    setSalvandoPerfil(false);
  }

  const carteira = CARTEIRAS[perfil || 'moderado'];

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

  const cardBranco: React.CSSProperties = {
    background: 'white', borderRadius: '20px', padding: '20px', border: '1px solid #eef2ef',
  };
  const tituloLinha: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px',
  };
  const h2: React.CSSProperties = { fontSize: '16px', fontWeight: 700, color: COLORS.ink, margin: 0 };
  const nota: React.CSSProperties = {
    fontSize: '10px', color: COLORS.muted, textAlign: 'center', marginTop: '16px', marginBottom: 0,
  };

  return (
    <div>
      <div style={{ background: COLORS.dark1, padding: '48px 24px 24px', borderRadius: '0 0 28px 28px' }}>
        <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 700, margin: 0 }}>Investir</h1>
        <p style={{ color: COLORS.primaryLight, fontSize: '14px', marginTop: '4px' }}>
          Veja seu dinheiro crescer no tempo
        </p>
      </div>

      {/* ===== PERFIL DE RISCO ===== */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={cardBranco}>
          {quizAberto ? (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: COLORS.primaryMid, margin: '0 0 8px' }}>
                Pergunta {passo + 1} de {PERGUNTAS.length}
              </p>
              <p style={{ fontSize: '16px', fontWeight: 700, color: COLORS.ink, margin: '0 0 12px', lineHeight: 1.4 }}>
                {PERGUNTAS[passo].pergunta}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {PERGUNTAS[passo].opcoes.map((op) => (
                  <button
                    key={op.texto}
                    onClick={() => responder(op.pontos)}
                    disabled={salvandoPerfil}
                    style={{ background: '#f4f7f5', border: '1px solid #eef2ef', borderRadius: '12px', padding: '14px', fontSize: '14px', color: COLORS.ink, textAlign: 'left', cursor: 'pointer', lineHeight: 1.4 }}
                  >
                    {op.texto}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setQuizAberto(false)}
                style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '12px', width: '100%' }}
              >
                Cancelar
              </button>
            </div>
          ) : perfil ? (
            <div>
              <div style={tituloLinha}>
                <ShieldCheck size={20} color={COLORS.primaryMid} />
                <h2 style={h2}>Seu perfil: {PERFIL_LABEL[perfil]}</h2>
              </div>
              <p style={{ fontSize: '13px', color: COLORS.muted, lineHeight: 1.4, margin: 0 }}>
                {PERFIL_DESC[perfil]}
              </p>
              <button
                onClick={abrirQuiz}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: COLORS.primaryMid, fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '12px', padding: 0 }}
              >
                <RotateCcw size={14} color={COLORS.primaryMid} />
                Refazer teste
              </button>
            </div>
          ) : (
            <div>
              <div style={tituloLinha}>
                <ShieldCheck size={20} color={COLORS.primaryMid} />
                <h2 style={h2}>Descubra seu perfil de investidor</h2>
              </div>
              <p style={{ fontSize: '13px', color: COLORS.muted, lineHeight: 1.4, margin: 0 }}>
                Responda 3 perguntas rapidas e a Menta ajusta a carteira sugerida ao seu jeito de investir.
              </p>
              <button
                onClick={abrirQuiz}
                style={{ background: COLORS.primary, color: COLORS.ink, border: 'none', borderRadius: '999px', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', marginTop: '14px', width: '100%' }}
              >
                Fazer o teste
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sugestao da IA */}
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
        <div style={cardBranco}>
          <div style={tituloLinha}>
            <PiggyBank size={20} color={COLORS.primaryMid} />
            <h2 style={h2}>Simulador de riqueza</h2>
          </div>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '12px', color: COLORS.muted, margin: 0 }}>Guardando por mes</p>
            <p style={{ fontSize: '32px', fontWeight: 700, color: COLORS.primaryMid, margin: '4px 0' }}>
              R$ {fmtCurto(aporte)}
            </p>
          </div>
          <input
            type="range" min={50} max={3000} step={10} value={aporte}
            onChange={(e) => setAporte(Number(e.target.value))}
            style={{ width: '100%', accentColor: COLORS.primary, cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: COLORS.muted, marginBottom: '20px' }}>
            <span>R$ 50</span><span>R$ 3.000</span>
          </div>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: '#f4f7f5', borderRadius: '16px', padding: '14px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: COLORS.primaryMid, margin: 0 }}>Em 5 anos</p>
              <p style={{ fontSize: '18px', fontWeight: 700, color: COLORS.ink, margin: '4px 0 0' }}>R$ {fmtCurto(futuro5)}</p>
            </div>
            <div style={{ background: '#f4f7f5', borderRadius: '16px', padding: '14px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: COLORS.primaryMid, margin: 0 }}>Em 10 anos</p>
              <p style={{ fontSize: '18px', fontWeight: 700, color: COLORS.ink, margin: '4px 0 0' }}>R$ {fmtCurto(futuro10)}</p>
            </div>
          </div>
          <p style={nota}>Simulacao com rendimento de 10% ao ano. Investimentos reais podem render mais ou menos.</p>
        </div>
      </div>

      {/* Ponte metas */}
      <div style={{ padding: '16px' }}>
        <div style={cardBranco}>
          <div style={tituloLinha}>
            <Target size={20} color={COLORS.primaryMid} />
            <h2 style={h2}>Realize suas metas</h2>
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
          <p style={nota}>Conteudo educativo, nao e recomendacao de investimento.</p>
        </div>
      </div>

      {/* Carteira sugerida (adapta ao perfil) */}
      <div style={{ padding: '0 16px 16px' }}>
        <div style={cardBranco}>
          <div style={tituloLinha}>
            <TrendingUp size={20} color={COLORS.primaryMid} />
            <h2 style={h2}>Carteira sugerida{perfil ? ` · ${PERFIL_LABEL[perfil]}` : ''}</h2>
          </div>
          {!perfil && (
            <p style={{ fontSize: '12px', color: COLORS.muted, lineHeight: 1.5, margin: '-6px 0 14px' }}>
              Faca o teste de perfil ali em cima pra esta carteira se ajustar ao seu jeito. Por enquanto,
              mostramos uma divisao equilibrada.
            </p>
          )}
          <div style={{ display: 'flex', height: '12px', borderRadius: '999px', overflow: 'hidden', marginBottom: '16px' }}>
            {carteira.map((item) => (
              <div key={item.nome} style={{ width: `${item.pct}%`, background: item.cor }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {carteira.map((item) => (
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
          <p style={nota}>Sugestao educativa, nao e recomendacao de investimento.</p>
        </div>
      </div>
    </div>
  );
  <div style={{ padding: '0 16px 16px' }}><CartoesEducativos /></div>
}