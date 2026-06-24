import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

 
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
 
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
 
export const metadata: Metadata = {
  title: "Menta · Seu dinheiro, no piloto automático",
  description:
    "A Menta analisa suas faturas com IA e organiza seus gastos automaticamente.",
};
 
// Aplica o tema salvo ANTES da pagina pintar (evita flash branco ao carregar).
// Se nao houver nada salvo, usa o tema escuro como padrao.
const temaScript = `
(function() {
  try {
    var t = localStorage.getItem('menta-tema');
    document.documentElement.classList.add(t === 'claro' ? 'tema-claro' : 'tema-escuro');
  } catch (e) {
    document.documentElement.classList.add('tema-escuro');
  }
})();
`;
 
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}