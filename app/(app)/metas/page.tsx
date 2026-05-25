'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Target, Plus, X } from 'lucide-react';

const COLORS = {
  primary: '#7ad9b7',
  primaryLight: '#7cdbb9',
  primaryMid: '#3d7d66',
  dark1: '#183e31',
  ink: '#010302',
  muted: '#86958f',
};

type Meta = {
  id: string;
  titulo: string;
  valor_alvo: number;
  valor_atual: number;
  emoji: string;
  criado_em: string;
};

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EMOJIS = ['🎯', '✈️', '🏠', '🚗', '💍', '🎓', '🏖️', '💻', '👶', '🎁'];

export default function MetasPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [valorAlvo, setValorAlvo] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [salvando, setSalvando] = useState(false);

  async function carregarMetas() {
    const { data } = await supabase
      .from('metas')
      .select('*')
      .order('criado_em', { ascending: false });
    if (data) setMetas(data as Meta[]);
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);
      await carregarMetas();
      setCarregando(false);
    }
    init();
  }, [router]);

  async function criarMeta() {
    if (!titulo.trim() || !valorAlvo || !userId) return;
    const alvo = parseFloat(valorAlvo.replace(',', '.'));
    if (isNaN(alvo) || alvo <= 0) return;

    setSalvando(true);
    const { error } = await supabase.from('metas').insert({
      user_id: userId,
      titulo: titulo.trim(),
      valor_alvo: alvo,
      valor_atual: 0,
      emoji,
    });
    setSalvando(false);

    if (!error) {
      setTitulo('');
      setValorAlvo('');
      setEmoji('🎯');
      setMostrarForm(false);
      await carregarMetas();
    }
  }

  async function adicionarValor(meta: Meta, quanto: number) {
    if (!userId) return;
    const novoValor = Math.max(0, meta.valor_atual + quanto);
    const { error } = await supabase
      .from('metas')
      .update({ valor_atual: novoValor })
      .eq('id', meta.id);
    if (!error) await carregarMetas();
  }

  async function apagarMeta(id: string) {
    if (!userId) return;
    const { error } = await supabase.from('metas').delete().eq('id', id);
    if (!error) await carregarMetas();
  }

  if (carregando) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: COLORS.muted }}>
        Carregando suas metas...
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: COLORS.dark1, padding: '48px 24px 24px', borderRadius: '0 0 28px 28px' }}>
        <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 700, margin: 0 }}>Suas metas</h1>
        <p style={{ color: COLORS.primaryLight, fontSize: '14px', marginTop: '4px' }}>
          Um passo de cada vez pra realizar seus sonhos
        </p>
      </div>

      <div style={{ padding: '16px' }}>
        {!mostrarForm ? (
          <button
            onClick={() => setMostrarForm(true)}
            style={{ width: '100%', background: COLORS.primary, color: COLORS.ink, border: 'none', borderRadius: '16px', padding: '14px', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Plus size={18} /> Criar nova meta
          </button>
        ) : (
          <div style={{ background: 'white', borderRadius: '20px', padding: '20px', border: '1px solid #eef2ef' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.ink, margin: 0 }}>Nova meta</h2>
              <button onClick={() => setMostrarForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <X size={20} color={COLORS.muted} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: COLORS.muted, margin: '0 0 8px' }}>Escolha um icone</p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  style={{ width: '40px', height: '40px', borderRadius: '12px', fontSize: '20px', cursor: 'pointer', background: emoji === e ? COLORS.primary : '#f4f7f5', border: emoji === e ? `2px solid ${COLORS.primaryMid}` : '2px solid transparent' }}
                >
                  {e}
                </button>
              ))}
            </div>

            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Viajar pro Japao"
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '12px', border: '1px solid #e6ebe8', fontSize: '14px', marginBottom: '12px', outline: 'none', color: COLORS.ink }}
            />

            <input
              value={valorAlvo}
              onChange={(e) => setValorAlvo(e.target.value)}
              placeholder="Quanto quer juntar? Ex: 18000"
              inputMode="decimal"
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '12px', border: '1px solid #e6ebe8', fontSize: '14px', marginBottom: '16px', outline: 'none', color: COLORS.ink }}
            />

            <button
              onClick={criarMeta}
              disabled={salvando}
              style={{ width: '100%', background: COLORS.primaryMid, color: 'white', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: salvando ? 'wait' : 'pointer', opacity: salvando ? 0.6 : 1 }}
            >
              {salvando ? 'Salvando...' : 'Criar meta'}
            </button>
          </div>
        )}
      </div>

      {metas.length === 0 ? (
        <div style={{ margin: '0 16px', background: 'white', borderRadius: '16px', padding: '32px', textAlign: 'center', border: '1px solid #eef2ef' }}>
          <Target size={32} color={COLORS.primary} style={{ margin: '0 auto 12px' }} />
          <p style={{ color: COLORS.ink, fontWeight: 600, margin: 0 }}>Nenhuma meta ainda</p>
          <p style={{ color: COLORS.muted, fontSize: '13px', marginTop: '8px', marginBottom: 0 }}>
            Crie sua primeira meta e comece a juntar pra realizar aquele sonho.
          </p>
        </div>
      ) : (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {metas.map((meta) => {
            const pct = meta.valor_alvo > 0 ? Math.min(100, (meta.valor_atual / meta.valor_alvo) * 100) : 0;
            const concluida = meta.valor_atual >= meta.valor_alvo;
            return (
              <div key={meta.id} style={{ background: 'white', borderRadius: '20px', padding: '18px', border: '1px solid #eef2ef' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', display: 'grid', placeItems: 'center', fontSize: '22px', background: '#f4f7f5', flexShrink: 0 }}>
                    {meta.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '15px', color: COLORS.ink, margin: 0 }}>{meta.titulo}</p>
                    <p style={{ fontSize: '12px', color: COLORS.muted, margin: '2px 0 0' }}>
                      R$ {fmt(meta.valor_atual)} de R$ {fmt(meta.valor_alvo)}
                    </p>
                  </div>
                  <button onClick={() => apagarMeta(meta.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                    <X size={16} color={COLORS.muted} />
                  </button>
                </div>

                <div style={{ height: '10px', borderRadius: '999px', background: '#f0f4f1', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{ height: '100%', borderRadius: '999px', width: `${pct}%`, background: concluida ? COLORS.primaryMid : COLORS.primary, transition: 'width 0.3s' }} />
                </div>
                <p style={{ fontSize: '12px', fontWeight: 700, color: concluida ? COLORS.primaryMid : COLORS.muted, margin: '0 0 14px', textAlign: 'right' }}>
                  {concluida ? '🎉 Meta concluida!' : `${pct.toFixed(0)}%`}
                </p>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {[50, 100, 500].map((v) => (
                    <button
                      key={v}
                      onClick={() => adicionarValor(meta, v)}
                      style={{ flex: 1, background: '#f4f7f5', color: COLORS.primaryMid, border: 'none', borderRadius: '12px', padding: '10px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                    >
                      +R$ {v}
                    </button>
                  ))}
                  <button
                    onClick={() => adicionarValor(meta, -50)}
                    style={{ background: '#f4f7f5', color: COLORS.muted, border: 'none', borderRadius: '12px', padding: '10px 14px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                  >
                    -50
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}