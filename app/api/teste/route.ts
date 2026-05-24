import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    mensagem: 'A API do Menta esta funcionando!',
    horario: new Date().toISOString(),
  });
}