'use client';
 
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { FileText, Trash2, ArrowLeft } from 'lucide-react';
 
const COLORS = {
  primary: '#7ad9b7',
  primaryLight: '#7cdbb9',
  primaryMid: '#3d7d66',
  dark1: '#183e31',
  ink: '#010302',
  muted: '#86958f',
  danger: '#d96a6a',
};
 
type Fatura = {
  id: string;
  nome_original: string;
  status: string;
  criado_em: string;
  arquivo_path: string | null;
  total: number | null;
  insight: string | null;
  analisado_em: string | null;
};
 
const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 
export default function HistoricoPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [confirmandoId, setConfirmandoId] = useState('');
  const [removendoId, setRemovendoId] = useState('');
  const [avisoRemover, setAvisoRemover] = useState('');
 
  useEffect(() => {
    async function carregar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
 
      const { data } = await supabase
        .from('faturas')
        .select('id, nome_original, status, criado_em, arquivo_path, total, insight, analisado_em')
        .eq('user_id', user.id)
        .order('criado_em', { ascending: false });
 
      if (data) setFaturas(data as Fatura[]);
      setCarregando(false);
    }
    carregar();
  }, [router]);
 
  async function removerFatura(f: Fatura) {
    setRemovendoId(f.id);
    setAvisoRemover('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setAvisoRemover('Sua sessao expirou. Saia e entre de novo para continuar.');
        setRemovendoId('');
        return;
      }
 
      const resp = await fetch('/api/remover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ faturaId: f.id }),
      });
      const dados = await resp.json();
 
      if (!dados.sucesso) {
        setAvisoRemover('Nao foi possivel remover a fatura agora. Tente de novo.');
        setRemovendoId('');
        return;
      }
 
      setFaturas((prev) => prev.filter((x) => x.id !== f.id));
      setConfirmandoId('');
      setRemovendoId('');
    } catch {
      setAvisoRemover('A conexao falhou. Verifique sua internet e tente de novo.');
      setRemovendoId('');
    }
  }
 
  if (carregando) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: COLORS.muted }}>
        Carregando seu histórico...
      </div>
    );
  }
 
  return (
    <div>
      {/* Cabecalho com fundo escuro e botao voltar */}
      <div style={{ background: COLORS.dark1, padding: '48px 24px 24px', borderRadius: '0 0 28px 28px' }}>
        <button
          onClick={() => router.back()}
          aria-label="Voltar"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'white',
            padding: '0',
            marginBottom: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
          }}
        >
          <ArrowLeft size={18} /> Voltar
        </button>
        <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 700, margin: 0 }}>
          Histórico de faturas
        </h1>
        <p style={{ color: COLORS.primaryLight, fontSize: '14px', marginTop: '4px' }}>
          Suas faturas em PDF analisadas anteriormente
        </p>
      </div>
 
      {/* Lista */}
      <div style={{ padding: '16px' }}>
        {faturas.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', textAlign: 'center', border: '1px solid #eef2ef' }}>
            <p style={{ color: COLORS.ink, fontWeight: 600, margin: 0 }}>Nenhuma fatura no histórico</p>
            <p style={{ color: COLORS.muted, fontSize: '13px', marginTop: '8px' }}>
              Você ainda não enviou nenhuma fatura em PDF para a Menta analisar.
            </p>
            <button
              onClick={() => router.push('/upload')}
              style={{ marginTop: '16px', background: COLORS.primary, color: COLORS.ink, border: 'none', borderRadius: '12px', padding: '12px 20px', fontWeight: 700, cursor: 'pointer' }}
            >
              Enviar fatura
            </button>
          </div>
        ) : (
          <>
            {avisoRemover && (
              <p style={{ fontSize: '12px', color: COLORS.danger, marginBottom: '8px' }}>
                {avisoRemover}
              </p>
            )}
 
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {faturas.map((f) => (
                <div key={f.id} style={{ background: 'white', borderRadius: '16px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #eef2ef' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'grid', placeItems: 'center', background: '#f4f7f5', flexShrink: 0 }}>
                    <FileText size={18} color={COLORS.primaryMid} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: COLORS.ink, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.nome_original}
                    </p>
                    <p style={{ fontSize: '11px', color: COLORS.muted, margin: '2px 0 0' }}>
                      {new Date(f.criado_em).toLocaleDateString('pt-BR')} · {f.status}
                    </p>
                  </div>
 
                  {confirmandoId === f.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontSize: '12px', color: COLORS.muted }}>Remover?</span>
                      <button
                        onClick={() => removerFatura(f)}
                        disabled={removendoId === f.id}
                        style={{ background: COLORS.danger, color: 'white', border: 'none', borderRadius: '999px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: removendoId === f.id ? 0.6 : 1 }}
                      >
                        {removendoId === f.id ? '...' : 'Sim'}
                      </button>
                      <button
                        onClick={() => setConfirmandoId('')}
                        disabled={removendoId === f.id}
                        style={{ background: 'white', color: COLORS.muted, border: '1px solid #e6ebe8', borderRadius: '999px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Nao
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      {f.total != null && (
                        <span style={{ fontWeight: 700, fontSize: '14px', color: COLORS.ink }}>
                          R$ {fmt(f.total)}
                        </span>
                      )}
                      <button
                        onClick={() => { setConfirmandoId(f.id); setAvisoRemover(''); }}
                        aria-label="Remover fatura"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'grid', placeItems: 'center' }}
                      >
                        <Trash2 size={16} color={COLORS.muted} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}