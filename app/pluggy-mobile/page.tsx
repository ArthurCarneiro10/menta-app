'use client';
 
/**
 * Pagina-ponte do Pluggy Connect para o app MOBILE.
 *
 * O app (menta-mobile) abre esta pagina dentro de uma WebView (react-native-webview),
 * passando o connectToken pela URL:
 *
 *   https://app.mentaapp.com.br/pluggy-mobile?token=<CONNECT_TOKEN>&sandbox=1
 *
 * Aqui carregamos o script oficial do Pluggy Connect (CDN), abrimos o widget,
 * e devolvemos o resultado pro app pela "ponte" da WebView (window.ReactNativeWebView).
 *
 * Mensagens enviadas pro app (JSON via postMessage):
 *   { tipo: 'sucesso', itemId }   -> usuario conectou o banco
 *   { tipo: 'erro', mensagem }    -> deu erro no widget
 *   { tipo: 'fechado' }           -> usuario fechou o widget sem conectar
 *   { tipo: 'pronto' }            -> script carregou e o widget abriu (debug)
 *
 * Esta pagina NAO depende de sessao do navegador nem do resto do app: o
 * connectToken (gerado server-side, so pra usuario premium) eh a unica
 * credencial necessaria. O login do banco acontece DENTRO do widget oficial
 * do Pluggy - esta pagina nunca ve as credenciais bancarias.
 */
 
import { useEffect, useRef, useState } from 'react';
 
// Tipagem minima do construtor global que o script da CDN expoe.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    PluggyConnect?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ReactNativeWebView?: { postMessage: (msg: string) => void };
  }
}
 
const CDN_SCRIPT = 'https://cdn.pluggy.ai/pluggy-connect/v2.9.1/pluggy-connect.js';
 
function enviarProApp(payload: Record<string, unknown>) {
  const msg = JSON.stringify(payload);
  if (typeof window !== 'undefined' && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(msg);
  } else {
    // Fora da WebView (ex: aberto num navegador comum) - so loga.
    console.log('[pluggy-mobile] (sem WebView) ->', msg);
  }
}
 
export default function PluggyMobilePage() {
  const [estado, setEstado] = useState<'carregando' | 'aberto' | 'erro'>('carregando');
  const [mensagem, setMensagem] = useState('Preparando conexao segura...');
  const jaAbriu = useRef(false);
 
  useEffect(() => {
    // Le params da URL
    const params = new URLSearchParams(window.location.search);
    const connectToken = params.get('token') || '';
    const includeSandbox = params.get('sandbox') === '1';
 
    if (!connectToken) {
      setEstado('erro');
      setMensagem('Token de conexao ausente. Volte e tente novamente.');
      enviarProApp({ tipo: 'erro', mensagem: 'token ausente' });
      return;
    }
 
    // Carrega o script da CDN do Pluggy Connect
    const script = document.createElement('script');
    script.src = CDN_SCRIPT;
    script.async = true;
 
    script.onload = () => {
      if (jaAbriu.current) return;
      if (!window.PluggyConnect) {
        setEstado('erro');
        setMensagem('Nao foi possivel carregar o conector. Verifique sua internet.');
        enviarProApp({ tipo: 'erro', mensagem: 'PluggyConnect indisponivel apos load' });
        return;
      }
 
      try {
        const pluggy = new window.PluggyConnect({
          connectToken,
          includeSandbox,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onSuccess: (itemData: any) => {
            const itemId = itemData?.item?.id || itemData?.id || '';
            enviarProApp({ tipo: 'sucesso', itemId });
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onError: (error: any) => {
            enviarProApp({
              tipo: 'erro',
              mensagem: error?.message || 'erro no widget',
            });
          },
          onClose: () => {
            enviarProApp({ tipo: 'fechado' });
          },
        });
 
        pluggy.init();
        jaAbriu.current = true;
        setEstado('aberto');
        setMensagem('');
        enviarProApp({ tipo: 'pronto' });
      } catch (e) {
        setEstado('erro');
        setMensagem('Erro ao abrir o conector.');
        enviarProApp({
          tipo: 'erro',
          mensagem: e instanceof Error ? e.message : 'erro init',
        });
      }
    };
 
    script.onerror = () => {
      setEstado('erro');
      setMensagem('Nao foi possivel carregar o conector. Verifique sua internet.');
      enviarProApp({ tipo: 'erro', mensagem: 'falha ao carregar script CDN' });
    };
 
    document.body.appendChild(script);
 
    return () => {
      // Limpeza: remove o script se a pagina desmontar
      try { document.body.removeChild(script); } catch { /* noop */ }
    };
  }, []);
 
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#0c2019',
        color: '#7ad9b7',
        fontFamily: 'system-ui, sans-serif',
        padding: 24,
        textAlign: 'center',
      }}
    >
      {estado !== 'aberto' && (
        <div>
          <div
            style={{
              width: 40,
              height: 40,
              margin: '0 auto 16px',
              border: '3px solid rgba(122,217,183,0.25)',
              borderTopColor: '#7ad9b7',
              borderRadius: '50%',
              animation: estado === 'carregando' ? 'girar 0.9s linear infinite' : 'none',
            }}
          />
          <p style={{ fontSize: 14, color: estado === 'erro' ? '#fca5a5' : '#7ad9b7' }}>
            {mensagem}
          </p>
          <style>{`@keyframes girar { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}
 