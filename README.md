# Menta App
 
Aplicativo brasileiro de finanças pessoais com Open Finance e IA. App principal em [app.mentaapp.com.br](https://app.mentaapp.com.br).
 
## Stack
 
- **Framework**: Next.js (App Router)
- **Banco**: Supabase (Postgres + Auth + Storage)
- **IA**: OpenRouter (Claude Haiku 4.5 via `MODELO_IA` constant)
- **Open Finance**: Pluggy
- **Pagamentos**: Mercado Pago Subscriptions
- **Hosting**: Vercel
## Setup local
 
```bash
# Instala dependências
npm install
 
# Cria .env.local (ver seção abaixo)
cp .env.example .env.local  # se houver, senão cria manualmente
 
# Roda dev server
npm run dev
```
 
App roda em `http://localhost:3000`.
 
## Variáveis de ambiente
 
Todas vão em `.env.local` (local) e na **Vercel → Settings → Environment Variables** (produção).
 
### Obrigatórias
 
| Var | Descrição | Exemplo |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública Supabase | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (bypassa RLS) | `eyJ...` |
| `OPENROUTER_API_KEY` | Chave OpenRouter pra IA | `sk-or-v1-...` |
| `PLUGGY_CLIENT_ID` | Client ID Pluggy | UUID |
| `PLUGGY_CLIENT_SECRET` | Client secret Pluggy | UUID |
| `MP_ACCESS_TOKEN` | Access token Mercado Pago | `APP_USR-...` ou `TEST-...` |
| `MP_PUBLIC_KEY` | Public key Mercado Pago | `APP_USR-...` ou `TEST-...` |
| `NEXT_PUBLIC_APP_URL` | URL base do app | `https://app.mentaapp.com.br` |
| `ADMIN_SECRET` | Secret pra rotas /api/admin/* | Hex 64 chars |
| `LIMPEZA_SECRET` | Secret pra cron de limpeza vencidos | Hex 64 chars |
 
### Opcionais
 
| Var | Descrição | Default |
|---|---|---|
| `MP_WEBHOOK_SECRET` | Secret HMAC do webhook MP | vazio |
| `MP_WEBHOOK_STRICT` | `true` rejeita webhooks sem HMAC válido | desativado |
| `MP_WEBHOOK_VERBOSE` | `true` loga body completo pra debug | desativado |
| `PLUGGY_WEBHOOK_SECRET` | Secret HMAC do webhook Pluggy | vazio |
| `PLUGGY_WEBHOOK_STRICT` | `true` exige HMAC válido | desativado |
| `NEXT_PUBLIC_PLUGGY_AMBIENTE` | `producao` ou `sandbox` (controla banner UI) | sandbox |
 
### Importante
 
- `NEXT_PUBLIC_*` **NUNCA** marcar como Sensitive na Vercel (precisam ir pro client)
- Demais env vars (sem `NEXT_PUBLIC_`) devem ficar como Sensitive sempre
- `.env.local` **NUNCA** entra no Git (está no `.gitignore`)
- Mudou env var? **Reinicia o dev server** — Next.js só lê env no startup
## Estrutura de rotas
 
```
app/(app)/dashboard       Dashboard principal (Free + Premium)
app/(app)/gastos          Lista de gastos (PDFs + Timeline Open Finance)
app/(app)/historico       Histórico de faturas PDF
app/(app)/conectar        Gerenciar conexões Pluggy (Premium-only)
app/(app)/upload          Upload de PDF de fatura
app/(app)/ia              Chat IA financeiro
app/(app)/metas           Metas financeiras
app/(app)/investir        Sugestões de investimento
app/(app)/planos          Página de assinatura Premium
app/(app)/config          Configurações do usuário
 
app/api/analisar              Processa PDF de fatura com IA
app/api/cancelar-premium      Cancela Premium (grace 30 dias)
app/api/limpeza-vencidos      Cron: limpa dados vencidos
app/api/excluir-conta         Apaga conta do usuário
app/api/mp/iniciar-assinatura Cria preapproval no MP
app/api/mp/webhook            Recebe eventos MP (HMAC opcional)
app/api/pluggy/conectar       Gera connect token Pluggy
app/api/pluggy/sincronizar    Sincroniza transações bancárias
app/api/pluggy/webhook        Recebe eventos Pluggy
app/api/pluggy/desconectar    Remove conexão bancária
```
 
## Tabelas Supabase
 
- `profiles` — perfil do usuário (plano free/premium, foto, etc)
- `faturas` — PDFs de fatura analisados (modo Free)
- `notificacoes` — sino de notificações
- `connections` — conexões Pluggy
- `contas_bancarias` — contas vinculadas via Pluggy
- `transacoes_banco` — transações sincronizadas via Pluggy
- `assinaturas` — estado das assinaturas Mercado Pago
- `waitlist` — lista de interessados (captada via landing)
Todas com RLS ativo. Cliente só acessa próprios dados.
 
## Deploy
 
Push pra `main` no GitHub → Vercel deploya automaticamente.
 
```bash
git add .
git commit -m "Mensagem do commit"
git push origin main
```
 
## Convenções
 
- Comentários no código sem acentos (terminal Windows)
- Acentos OK em strings de UI
- Tailwind v4 (sintaxe `bg-linear-to-br`, não `bg-gradient-to-br`)
- Tema dark, paleta verde-musgo (`#0c2019`, `#183e31`, `#7ad9b7`)