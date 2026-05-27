'use client';
 
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
 
type Notificacao = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  lida: boolean;
  criado_em: string;
};
 
export default function SinoNotificacoes({ userId }: { userId: string }) {
  const [aberto, setAberto] = useState(false);
  const [notifs, setNotifs] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
 
  // Busca as notificacoes do usuario
  useEffect(() => {
    async function carregar() {
      if (!userId) return;
      const { data } = await supabase
        .from('notificacoes')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(20);
      if (data) setNotifs(data as Notificacao[]);
      setCarregando(false);
    }
    carregar();
  }, [userId]);
 
  // Fecha o dropdown ao clicar fora dele
  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    if (aberto) {
      document.addEventListener('mousedown', handleClickFora);
      return () => document.removeEventListener('mousedown', handleClickFora);
    }
  }, [aberto]);
 
  async function marcarTodasComoLidas() {
    const naoLidas = notifs.filter((n) => !n.lida);
    if (naoLidas.length === 0) return;
 
    const ids = naoLidas.map((n) => n.id);
    await supabase
      .from('notificacoes')
      .update({ lida: true })
      .in('id', ids);
 
    setNotifs((prev) => prev.map((n) => ({ ...n, lida: true })));
  }
 
  const naoLidas = notifs.filter((n) => !n.lida).length;
 
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto(!aberto)}
        aria-label="Notificações"
        className="w-10 h-10 grid place-items-center rounded-full border border-white/10 text-white/80 hover:text-white hover:bg-white/5 transition-colors relative"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] grid place-items-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>
 
      {aberto && (
        <div className="absolute right-0 top-12 w-80 bg-[#0c2019] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <p className="text-white font-bold text-sm">Notificações</p>
            {naoLidas > 0 && (
              <button
                onClick={marcarTodasComoLidas}
                className="text-[#7ad9b7] text-xs font-medium hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
 
          <div className="max-h-96 overflow-y-auto">
            {carregando ? (
              <p className="text-white/40 text-sm text-center py-8">Carregando...</p>
            ) : notifs.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <p className="text-white/60 text-sm">Você não tem notificações ainda.</p>
                <p className="text-white/30 text-xs mt-1">As novidades aparecerão aqui.</p>
              </div>
            ) : (
              notifs.map((n) => <ItemNotif key={n.id} n={n} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
 
function ItemNotif({ n }: { n: Notificacao }) {
  const data = new Date(n.criado_em);
  const agora = new Date();
  const diffMin = Math.floor((agora.getTime() - data.getTime()) / 60000);
 
  let tempo: string;
  if (diffMin < 1) tempo = 'agora há pouco';
  else if (diffMin < 60) tempo = `${diffMin} min atrás`;
  else if (diffMin < 1440) tempo = `${Math.floor(diffMin / 60)}h atrás`;
  else tempo = `${Math.floor(diffMin / 1440)}d atrás`;
 
  return (
    <div className={`px-4 py-3 border-b border-white/5 ${!n.lida ? 'bg-white/5' : ''}`}>
      <div className="flex items-start gap-2">
        {!n.lida && <span className="w-2 h-2 rounded-full bg-[#7ad9b7] mt-1.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">{n.titulo}</p>
          {n.mensagem && (
            <p className="text-white/60 text-xs mt-1 leading-relaxed">{n.mensagem}</p>
          )}
          <p className="text-white/30 text-[10px] mt-1.5">{tempo}</p>
        </div>
      </div>
    </div>
  );
}