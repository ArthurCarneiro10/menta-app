'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Receipt, Sparkles, Target, TrendingUp } from 'lucide-react';

// Paleta oficial Menta
const COLORS = {
  primary: '#7ad9b7',
  ink: '#010302',
  muted: '#86958f',
};

// Os 5 itens da barra, na ordem: Inicio - Gastos - IA - Metas - Investir
const NAV = [
  { href: '/dashboard', label: 'Inicio', icon: Home },
  { href: '/gastos', label: 'Gastos', icon: Receipt },
  { href: '/ia', label: 'IA', icon: Sparkles },
  { href: '/metas', label: 'Metas', icon: Target },
  { href: '/investir', label: 'Investir', icon: TrendingUp },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7f5', paddingBottom: '90px' }}>
      {/* Conteudo da tela atual */}
      {children}

      {/* Barra de navegacao fixa embaixo */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          justifyContent: 'center',
          padding: '12px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: '4px',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '8px',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
            maxWidth: '440px',
            width: '100%',
            pointerEvents: 'auto',
          }}
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  padding: '8px 10px',
                  borderRadius: '16px',
                  border: 'none',
                  cursor: 'pointer',
                  minWidth: '56px',
                  background: active ? COLORS.primary : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <Icon
                  size={18}
                  color={active ? COLORS.ink : COLORS.muted}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: active ? COLORS.ink : COLORS.muted,
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}