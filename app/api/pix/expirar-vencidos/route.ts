/**
 * POST /api/pix/expirar-vencidos
 *
 * Cron diario: expira planos pagos via PIX cuja validade (plano_expira_em)
 * ja passou. Cada vencido vira Free + grace de 30 dias (reusa a logica de
 * cancelamento). A faxina dos dados bancarios fica pro /api/limpeza-vencidos.
 *
 * Seguranca: protegida pela MESMA LIMPEZA_SECRET do limpeza-vencidos
 * (header Authorization: Bearer <secret>). Sem ela, nao roda.
 *
 * Agendada no vercel.json. A Vercel manda o secret via header automaticamente.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { expirarPlanosPixVencidos } from '@/lib/premium';

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LIMPEZA_SECRET = process.env.LIMPEZA_SECRET || '';

export async function POST(request: Request) {
  try {
    // ===== Auth via secret (mesmo padrao do limpeza-vencidos) =====
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!LIMPEZA_SECRET) {
      console.error('[pix-expirar] LIMPEZA_SECRET nao configurado no servidor');
      return NextResponse.json({ erro: 'Rota nao configurada' }, { status: 500 });
    }

    if (token !== LIMPEZA_SECRET) {
      return NextResponse.json({ erro: 'Nao autorizado' }, { status: 401 });
    }

    const { expirados, erros } = await expirarPlanosPixVencidos(supabase);

    console.log(
      `[pix-expirar] OK: expirados=${expirados} erros=${erros.length}`
    );

    return NextResponse.json({
      sucesso: true,
      expirados,
      erros: erros.length > 0 ? erros : undefined,
    });
  } catch (e) {
    console.error('[pix-expirar] Erro:', e);
    return NextResponse.json(
      { erro: 'Erro: ' + (e instanceof Error ? e.message : 'desconhecido') },
      { status: 500 }
    );
  }
}

// GET: status pra ver se a rota ta viva e configurada
export async function GET() {
  return NextResponse.json({
    status: 'pix-expirar endpoint ativo',
    configurado: !!LIMPEZA_SECRET,
  });
}