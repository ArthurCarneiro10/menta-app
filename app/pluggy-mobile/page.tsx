'use client';
 
/**
 * Pagina-ponte do Pluggy Connect para o app MOBILE.
 *
 * O app (menta-mobile) abre esta pagina dentro de uma WebView, passando o
 * connectToken pela URL:
 *
 *   https://app.mentaapp.com.br/pluggy-mobile?token=<CONNECT_TOKEN>&sandbox=1
 *
 * IMPORTANTE: esta pagina usa o MESMO componente `react-pluggy-connect` que a
 * tela /conectar do web ja usa em producao. Nada de CDN externa - reusa o
 * pacote ja instalado no menta-app, que e robusto e testado.
 *
 * Mensagens enviadas pro app (JSON via postMessage da WebView):
 *   { tipo: 'sucesso', itemId }   -> usuario conectou o banco
 *   { tipo: 'erro', mensagem }    -> deu erro no widget
 *   { tipo: 'fechado' }           -> usuario fechou o widget sem conectar
 *
 * O login do banco acontece DENTRO do widget oficial do Pluggy - esta pagina
 * nunca ve as credenciais bancarias. O connectToken (gerado server-side, so
 * pra premium) eh a unica credencial necessaria.
 */
 
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
 
// Mesmo import da tela /conectar do web. ssr:false porque o widget so roda no client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PluggyConnect = dynamic<any>(
  () => import('react-pluggy-connect').then((m) => m.PluggyConnect),
  { ssr: false }
);
 
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
  }
}
 
function enviarProApp(payload: Record<string, unknown>) {
  const msg = JSON.stringify(payload);
  if (typeof window !== 'undefined' && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(msg);
  } else {
    // Fora da WebView (ex: testando no navegador comum) - so loga.
    console.log('[pluggy-mobile] (sem WebView) ->', msg);
  }
}
 
export default function PluggyMobilePage() {
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [includeSandbox, setIncludeSandbox] = useState(false);
  const [erro, setErro] = useState('');
 
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || '';
    const sandbox = params.get('sandbox') === '1';
 
    if (!token) {
      setErro('Token de conexao ausente. Volte e tente novamente.');
      enviarProApp({ tipo: 'erro', mensagem: 'token ausente' });
      return;
    }
 
    setConnectToken(token);
    setIncludeSandbox(sandbox);
  }, []);
 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onSuccess(itemData: any) {
    const itemId = itemData?.item?.id || itemData?.id || '';
    enviarProApp({ tipo: 'sucesso', itemId });
  }
 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onError(error: any) {
    enviarProApp({ tipo: 'erro', mensagem: error?.message || 'erro no widget' });
  }
 
  function onClose() {
    enviarProApp({ tipo: 'fechado' });
  }
 
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#0c2019',
        color: erro ? '#fca5a5' : '#7ad9b7',
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        textAlign: 'center',
      }}
    >
      {erro ? (
        <p style={{ fontSize: 14 }}>{erro}</p>
      ) : (
        <p style={{ fontSize: 14 }}>Preparando conexao segura...</p>
      )}
 
      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={includeSandbox}
          onSuccess={onSuccess}
          onError={onError}
          onClose={onClose}
        />
      )}
    </div>
  );
}