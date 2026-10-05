# CRM de eventos

Cadastro de participantes e eventos, credencial em PDF com QR code e check-in no dia pelo celular.
Next.js na Vercel, Postgres no Supabase. Desenho completo em
`docs/superpowers/specs/2026-10-05-crm-eventos-design.md`.

## Rodar local

```bash
npm install
cp .env.example .env.local   # preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
npm run dev                  # http://localhost:3000
```

Testes: `npm test` (unitários, Vitest) e `npm run e2e` (fluxo completo no navegador, Playwright).
O E2E grava no Supabase configurado no `.env.local` e apaga no fim tudo o que criou (prefixo `E2E `).
Na primeira vez: `npx playwright install chromium`.

## Banco

A migração fica em `supabase/migrations/`. Aplique pelo MCP do Supabase (`apply_migration`) ou colando
o SQL no SQL Editor do painel. Todas as tabelas têm RLS ligado **sem política**: a API pública do
Supabase não lê nada; só o servidor Next.js, com a chave secreta, acessa.

## Deploy na Vercel

1. Importe o repositório na Vercel (framework Next.js, sem ajuste de build).
2. Em *Settings → Environment Variables*, cadastre as variáveis do `.env.example`.
3. Em *Settings → Deployment Protection*, ligue a proteção. Sem ela o sistema fica aberto na internet.
   - **Vercel Authentication + "All Deployments"**: protege inclusive o domínio de produção, em qualquer
     plano. Entra quem estiver logado numa conta Vercel com acesso ao projeto.
   - **Password Protection**: uma senha única para todos. Recurso do plano Pro (US$ 20/mês por projeto,
     conforme a documentação da Vercel em set/2026).
   - "Standard Protection" **não** protege o domínio de produção.
4. E-mail automático (opcional): crie a conta no Resend, verifique o domínio e preencha
   `RESEND_API_KEY` e `EMAIL_FROM`. O plano grátis envia 100 e-mails por dia; o sistema manda em lotes
   e o que passar da cota fica pendente para o dia seguinte.

## No dia do evento

Abra `/checkin` no celular (HTTPS é obrigatório para a câmera; a Vercel já serve em HTTPS) e aceite
a permissão da câmera. O evento do dia vem selecionado. Quem chegar sem QR legível é achado pela busca
por nome ou CPF na mesma tela. Leitor de código de barras USB também funciona: ele digita no campo de
código e manda Enter.
