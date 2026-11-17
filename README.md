# CRM de eventos

Cadastro de participantes e eventos, credencial em PDF com QR code e check-in no dia pelo celular.
Next.js na Vercel, Postgres no Supabase. Desenho completo em
`docs/superpowers/specs/2026-10-05-crm-eventos-design.md`.

## Rodar local

```bash
npm install
cp .env.example .env.local   # preencha SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY
npm run primeiro-admin -- <email> <senha> [nome]   # uma vez por banco: cria o seu usuário
npm run dev                  # http://localhost:3000 → entre em /entrar
```

Testes: `npm test` (unitários, Vitest) e `npm run e2e` (fluxo completo no navegador, Playwright).
O E2E grava no Supabase configurado no `.env.local` e apaga no fim tudo o que criou (prefixo `E2E `).
Na primeira vez: `npx playwright install chromium`.

## Login e contas

Cada usuário entra com e-mail e senha em `/entrar` e pertence a exatamente uma conta. Os dados de
eventos ficam separados por conta no próprio banco: um usuário só lê e grava os da conta dele.

### Variáveis

| Variável | Para quê |
|---|---|
| `SUPABASE_URL` | Endereço do projeto (Supabase → Project Settings → API). |
| `SUPABASE_ANON_KEY` | Chave publicável (`anon`). Usada só no servidor, no login e na renovação da sessão; o navegador não recebe chave nenhuma. Sem ela ninguém entra. |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta, ignora as regras de acesso do banco. Só a usam a área `/admin`, o cadastro de usuários e o `npm run primeiro-admin`. Nunca no Git, nunca com prefixo `NEXT_PUBLIC_`. |
| `ADMIN_USER` e `ADMIN_PASSWORD` | Transição: usuário e senha do navegador (HTTP Basic Auth), aceitos como alternativa ao login. Saem da Vercel na ordem descrita em "Ligar o login em produção". |

### Primeiro acesso

A migração cria a conta `VM Events` (slug `vm-events`), mas nenhum usuário: sem alguém para entrar,
ninguém chega à tela de criar usuários. O primeiro sai pela linha de comando:

```bash
npm run primeiro-admin -- <email> <senha> [nome]
```

O script lê `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do `.env.local` e cria o usuário como dono
da conta `vm-events` e administrador da plataforma. A senha precisa de pelo menos 8 caracteres. Se o
e-mail já existir, troca a senha (e o nome, quando informado) e garante os dois papéis, então rodar de
novo é seguro e serve também para recuperar o acesso do administrador. Falta de argumento, de
variável ou da conta `vm-events` encerra com código 1 e a mensagem do que falta. Precisa de Node 24:
ele roda o `.ts` direto, sem build.

Depois de entrar, troque a senha em `/minha-conta`: a usada no comando fica no histórico do terminal.

### Papéis

- **Administrador da plataforma**: vê o grupo "Plataforma" no menu (`/admin/contas`), cria contas,
  liga módulos e cria, redefine a senha e desativa usuários de qualquer conta. O usuário do
  `primeiro-admin` também é dono da conta VM Events.
- **Dono**: tudo da própria conta, inclusive "Conta → Usuários" (`/usuarios`). Não redefine a senha
  nem desativa o administrador da plataforma.
- **Barbeiro**: só o módulo barbearia, que ainda não existe; por enquanto entra em `/minha-conta`,
  sem itens no menu, e `/usuarios` responde 404 para ele.

### Criar conta e usuário

1. **Conta**: o administrador abre "Plataforma → Contas → Nova conta" e informa nome, slug
   (preenchido a partir do nome; de 3 a 40 caracteres entre letras minúsculas, números e hífen,
   único), módulos e fuso. Não há como apagar conta pela tela.
2. **Primeiro usuário da conta**: na página da conta (`/admin/contas/<id>`), "Novo usuário" com nome,
   e-mail, papel (Dono, de início) e senha inicial de pelo menos 8 caracteres. Não sai e-mail de
   convite: passe a senha à pessoa.
3. **Demais usuários**: o dono cria em `/usuarios`, com o mesmo formulário. Ali ele também desativa
   (a sessão aberta cai no pedido seguinte) e reativa.

### Esqueci a senha

Não há recuperação por e-mail: o e-mail embutido do Supabase só entrega para membros do projeto. A
tela `/entrar` orienta a falar com o responsável pela conta.

- O dono clica em "Redefinir senha" na linha do usuário, em `/usuarios`.
- O administrador da plataforma faz o mesmo para qualquer usuário, inclusive donos, em
  `/admin/contas/<id>`.
- A senha temporária aparece uma vez na tela. A pessoa entra com ela e troca em `/minha-conta`.
- Se o esquecido for o próprio administrador: `npm run primeiro-admin -- <email> <nova senha>`.

## Banco

As migrações ficam em `supabase/migrations/`. Aplique pelo MCP do Supabase (`apply_migration`) ou
colando o SQL no SQL Editor do painel. Todas as tabelas têm RLS ligado: nas de eventos (`empresas`,
`eventos`, `participantes`), o usuário logado só alcança as linhas da própria conta; `contas` e
`usuarios` ele só lê, e quem grava nelas é o servidor, com a chave secreta.

## Deploy na Vercel

1. Importe o repositório na Vercel (framework Next.js, sem ajuste de build).
2. Em *Settings → Environment Variables*, cadastre `SUPABASE_URL`, `SUPABASE_ANON_KEY` e
   `SUPABASE_SERVICE_ROLE_KEY`, em production e preview. Quem abrir qualquer página sem sessão vai
   para `/entrar`; com `ADMIN_USER` e `ADMIN_PASSWORD` cadastradas, recebe antes o pedido de senha do
   navegador (só `/entrar` dispensa).
3. Em *Settings → Deployment Protection*, desligue a Vercel Authentication, senão o navegador pede
   dois logins (o da Vercel e o do sistema).
4. E-mail automático (opcional): crie a conta no Resend, verifique o domínio e preencha
   `RESEND_API_KEY` e `EMAIL_FROM`. O plano grátis envia 100 e-mails por dia; o sistema manda em lotes
   e o que passar da cota fica pendente para o dia seguinte.

### Ligar o login em produção

O Basic Auth continua aceito até o primeiro usuário existir em produção. Nesta ordem, para não ficar
trancado do lado de fora:

1. Cadastre `SUPABASE_ANON_KEY` na Vercel (production e preview) e faça um novo deploy.
2. No seu computador, aponte o `.env.local` para o projeto Supabase de produção (`SUPABASE_URL` e
   `SUPABASE_SERVICE_ROLE_KEY` de lá) e rode `npm run primeiro-admin -- <email> <senha> [nome]`.
3. Abra `https://<seu-domínio>/entrar`, entre com esse e-mail e senha e confira o grupo "Plataforma"
   no menu.
4. **Só então** remova `ADMIN_USER` e `ADMIN_PASSWORD` da Vercel e faça um novo deploy. O código do
   Basic Auth sai do sistema na tarefa seguinte do plano.

## No dia do evento

Abra `/checkin` no celular e entre com o seu e-mail e senha: o login devolve você ao check-in (HTTPS é
obrigatório para a câmera; a Vercel já serve em HTTPS). Aceite a permissão da câmera. O evento do dia
vem selecionado. Quem chegar sem QR legível é achado pela busca por nome ou CPF na mesma tela. Leitor
de código de barras USB também funciona: ele digita no campo de código e manda Enter.
