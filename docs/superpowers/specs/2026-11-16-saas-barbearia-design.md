# SaaS multiconta, login com papéis e módulo de barbearia com lembrete pelo WhatsApp — Spec

> Data: 2026-11-16 · Autor: Vinicius Duran

## Objetivo

Transformar o CRM de eventos na base de um SaaS com vários módulos. Cada cliente (uma barbearia,
uma organizadora de eventos) é uma **conta** com usuários e dados próprios, isolados no banco. O
primeiro módulo novo é **agendamento para barbearia**: página pública de agendamento no estilo chat
da referência (`chat.inbarberapp.com`) e área do dono com serviços, barbeiros, agenda e clientes. O
diferencial é o **lembrete pelo WhatsApp** via OpenWA: N dias depois do atendimento o cliente recebe
uma mensagem e, se marcar o próximo ali mesmo, respondendo no WhatsApp, ganha um benefício que o
dono configura.

## Decisões do autor

| # | Decisão | Observação |
|---|---|---|
| 1 | **Cada barbearia é uma conta; cada barbeiro tem o próprio login e vê só os próprios dados; o módulo de eventos também fica isolado por conta.** | Rejeitado: uma só equipe (a do autor) operando tudo com perfis por módulo. |
| 2 | **O cliente marca o próximo horário conversando no WhatsApp** (responde à mensagem do lembrete). | Rejeitado: link com validade que abre a página web já com o desconto. |
| 3 | **O bot só fala quando foi ele que começou a conversa** (lembrete). Mensagem que chega do nada, o dono responde no celular dele, como já faz. | Rejeitado: atendente completo no WhatsApp que agenda do zero. |
| 4 | **Isolamento no banco (RLS)**, não só no código. | Rejeitado: filtro por conta em toda consulta, com a chave mestra como hoje. Ver *Abordagens*. |
| 5 | Página pública e área do dono como descritas na seção 4, confirmadas pelo autor ("é isso"). | |
| 6 | **Vercel passa ao plano Pro** (US$ 20/mês): cron a cada 5 minutos para os lembretes e uso comercial regularizado. | Rejeitados: ficar no Hobby com envio feito por um processo no droplet; ficar no Hobby com teto de ~50 lembretes por dia no total. |
| 7 | **Senha esquecida sem e-mail**: o dono redefine a senha dos barbeiros e o administrador da plataforma redefine a do dono, pela tela. | Rejeitado: configurar o Resend como SMTP do Supabase Auth. Pode entrar depois. |

## Fora de escopo

- Cadastro público de contas, planos e cobrança. As contas são criadas pelo administrador da
  plataforma.
- Atendente completo no WhatsApp (decisão 3) e qualquer resposta automática a mensagem que o
  sistema não iniciou.
- Lembrete de véspera ("seu horário é amanhã"), fila de espera, pacotes, comissões, caixa e
  relatórios financeiros. Candidatos a módulos futuros.
- Login social, dois fatores, convite por e-mail.
- Aplicativo nativo e notificações push (o "ativar notificações" da referência).
- Envio de e-mail das credenciais de evento continua **parado** (decisão de 2026-10-05).

## Restrições

- **OpenWA é não-oficial** (Baileys / whatsapp-web.js): risco real de banimento do número. Cada
  barbearia conecta um **número dedicado**, nunca o pessoal. O sistema espaça os envios e respeita
  a palavra de saída (`PARAR`). Isso é obrigação de produto, não detalhe.
- OpenWA precisa de um processo ligado o tempo todo com disco persistente. **Não roda na Vercel.**
  Vai num droplet da DigitalOcean em Docker (ver seção 7). O app Next.js continua na Vercel.
- Uma função na Vercel dura no máximo 300 s. Com 5 s entre envios, uma execução do cron manda no
  máximo **50 mensagens**; o resto espera a próxima. Por isso o plano Pro (decisão 6): cron a cada
  5 minutos. O Hobby, com uma execução por dia, daria ~50 lembretes por dia para todas as contas
  juntas, e proíbe uso comercial.
- Produção hoje tem uma empresa (VM Events) e dados de eventos reais. A migração **preserva** tudo,
  colocando o que existe dentro de uma conta do autor.
- Repositório público: nenhum dado real de cliente (nome, telefone) em issue, PR, commit ou fixture.

## Abordagens consideradas

| | 1. Isolamento no código | 2. Isolamento no banco (RLS) — **escolhida** |
|---|---|---|
| Login | Supabase Auth, sessão em cookie | igual |
| Acesso a dados | chave `service_role` como hoje; `conta_id` em toda tabela; um ajudante filtra pela conta do usuário logado (36 chamadas a `db()` em 19 arquivos passam por ele) | o servidor consulta com o **token do usuário**; cada tabela tem política "só linhas da conta deste usuário"; papel (dono/barbeiro) também é política |
| Consulta sem filtro | **vaza** dados de outra conta; nada no banco impede | devolve vazio |
| Custo | menor: sem política, sem claim | uma política por tabela, função `conta_atual()`, testes de acesso contra banco real |
| `service_role` | em toda parte | só em três lugares delimitados: página pública, webhook do WhatsApp, cron |

Descartada sem tabela: login próprio (tabela de senhas, bcrypt, sessão feita à mão) — reinventa o
que o Supabase já entrega e é a parte mais fácil de errar.

Escolhida a **2** pelo autor, por recomendação: é um SaaS com dados de negócios alheios, e a
diferença de custo é de dias.

## 1. Contas, usuários e papéis

### 1.1 Modelo

| tabela | colunas principais | regra |
|---|---|---|
| `contas` | `id`, `nome`, `slug` (único, para a página pública), `modulos text[]` (`eventos`, `barbearia`), `fuso` (padrão `America/Sao_Paulo`), `created_at` | criada só pelo administrador da plataforma |
| `usuarios` | `id` (= `auth.users.id`), `conta_id`, `nome`, `papel` (`dono` \| `barbeiro`), `admin_plataforma boolean` (padrão `false`), `created_at` | **um usuário pertence a exatamente uma conta**. Linha criada junto com o usuário do Auth. |

- `auth.users` é do Supabase Auth, e-mail e senha. Metadados não guardam papel nem conta: a fonte é
  `usuarios`.
- **Administrador da plataforma** é o autor (`admin_plataforma = true`). Cria contas, liga módulos,
  cria o primeiro usuário dono de cada conta. Não entra nos dados das contas pela interface normal;
  a área `/admin` usa `service_role` e só abre para quem tem a flag (checada no servidor pela
  sessão, não por cookie solto).
- **Dono**: tudo da própria conta, inclusive criar e remover usuários dela.
- **Barbeiro**: só o módulo barbearia, só a própria agenda e os próprios clientes (seção 1.3). Um
  usuário barbeiro está ligado a um `profissionais.usuario_id` (seção 3.1). Um profissional pode
  existir sem login (o dono marca por ele).
- Criação de usuário: o dono (ou o admin) informa nome, e-mail, papel e **senha inicial**; o sistema
  cria no Auth pela API administrativa (`service_role`, no servidor) e grava em `usuarios`. Sem
  e-mail de convite.
- **Senha esquecida** (decisão 7): não há e-mail. O dono tem "Redefinir senha" em cada usuário da
  conta; o administrador da plataforma tem o mesmo botão em `/admin` para qualquer usuário,
  inclusive donos. O botão gera uma senha temporária mostrada uma vez na tela, e o usuário troca em
  `/minha-conta` depois de entrar. A tela `/entrar` diz "Esqueceu a senha? Fale com o responsável
  pela sua barbearia". O e-mail embutido do Supabase só entrega para membros do projeto, por isso
  não serve.

### 1.2 Login e sessão

- Rotas públicas: `/entrar`, `/b/[slug]` (página pública de agendamento),
  `/api/whatsapp/webhook`, `/api/cron/*`. Todo o resto exige sessão.
- `src/proxy.ts` deixa de fazer Basic Auth: renova o cookie de sessão do Supabase (`@supabase/ssr`)
  e redireciona para `/entrar` quem não tem sessão. `ADMIN_USER`/`ADMIN_PASSWORD` saem do
  `.env.example` e da Vercel.
- O menu lateral mostra só os módulos ligados na conta e permitidos ao papel. Barbeiro não vê
  Configurações nem Clientes de outros. A conta aparece no cabeçalho do menu (no lugar de "CRM de
  eventos").
- Variáveis novas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (chave publicável; o
  navegador só a usa para login e renovação de sessão, nunca para consultar dados).

### 1.3 Isolamento no banco

- Toda tabela de negócio tem `conta_id uuid not null references contas on delete cascade` com
  índice. **Isso inclui as tabelas de eventos de hoje** (`empresas`, `eventos`, `participantes`).
- Função `conta_atual()` (`security definer`, `stable`): devolve `usuarios.conta_id` do
  `auth.uid()`. Função `papel_atual()` análoga.
- Política padrão em cada tabela, para `authenticated`: `conta_id = conta_atual()` em
  `select/insert/update/delete`.
- Políticas de papel no módulo barbearia:
  - `agendamentos`: dono vê e mexe em tudo da conta; barbeiro só onde
    `profissional_id in (select id from profissionais where usuario_id = auth.uid())`.
  - `clientes`: dono tudo; barbeiro só clientes com pelo menos um agendamento com ele.
  - `servicos`, `profissionais`, `horarios`, `bloqueios`, `config_barbearia`: barbeiro lê; só dono
    escreve. Exceção: barbeiro edita os **próprios** bloqueios.
- No servidor, `src/lib/supabase.ts` passa a expor dois clientes:
  - `dbUsuario()`: cliente com o token da sessão (cookies). **É o padrão** em páginas, Server
    Actions e rotas autenticadas. As 36 chamadas a `db()` de hoje migram para ele.
  - `dbServico()`: a chave `service_role` de hoje, `server-only`, **só** importável por
    `src/app/b/**`, `src/app/api/whatsapp/**`, `src/app/api/cron/**`, `src/app/admin/**` e pelo
    cadastro de usuários. Um teste de lint ou de unidade garante que nenhum outro arquivo o importa.
- Os testes de acesso (seção 8) rodam contra o banco com dois usuários de duas contas e provam que
  um não lê nem escreve o do outro, e que o barbeiro não lê a agenda alheia.

### 1.4 Migração dos dados de eventos

Uma migração cria `contas`, `usuarios`, as funções e as políticas; cria a conta `VM Events`
(`modulos = {eventos}`); adiciona `conta_id` às três tabelas de eventos preenchendo com essa conta;
depois torna `not null`. A migração **não** cria usuário (a tela `/admin` exige login, e ninguém
teria como entrar): um script único (`scripts/primeiro-admin.ts`, roda local com `service_role`)
cria o primeiro usuário a partir de e-mail e senha passados por argumento e o marca
`admin_plataforma` e `dono` da conta VM Events.

O Basic Auth só sai depois que esse usuário existir em produção (ordem no plano).

## 2. Administração da plataforma (`/admin`)

Só para `admin_plataforma`. Telas mínimas:

- `/admin/contas`: lista; nova conta (nome, slug, módulos, fuso).
- `/admin/contas/[id]`: dados, módulos, usuários da conta, "novo usuário" (nome, e-mail, papel,
  senha inicial), desativar usuário (bane no Auth).

Sem métricas, sem cobrança.

## 3. Módulo barbearia — dados

Todas com `conta_id` e RLS (seção 1.3).

| tabela | colunas | regra |
|---|---|---|
| `servicos` | `id`, `nome`, `preco_centavos int`, `duracao_min int`, `ativo bool`, `ordem int` | preço em centavos; duração múltipla de 5 |
| `profissionais` | `id`, `nome`, `usuario_id` (nulo se sem login), `ativo` | `usuario_id` único por conta |
| `profissionais_servicos` | `profissional_id`, `servico_id` | quais serviços faz |
| `horarios` | `profissional_id`, `dia_semana 0-6`, `inicio time`, `fim time` | pode haver mais de uma faixa por dia (manhã e tarde); sem faixa = não trabalha |
| `bloqueios` | `profissional_id`, `inicio timestamptz`, `fim timestamptz`, `motivo` | folga, almoço avulso, curso |
| `clientes` | `id`, `nome`, `telefone` (E.164, ex. `+5511999990000`), `nao_contatar bool`, `created_at` | `unique (conta_id, telefone)` |
| `agendamentos` | `id`, `cliente_id`, `profissional_id`, `inicio timestamptz`, `fim timestamptz`, `status` (`agendado` \| `concluido` \| `faltou` \| `cancelado`), `origem` (`pagina` \| `lembrete` \| `manual`), `preco_centavos`, `desconto_tipo` (`nenhum` \| `porcentagem` \| `valor` \| `brinde`), `desconto_valor int`, `desconto_descricao`, `lembrete_enviado_em`, `created_at` | sem sobreposição por profissional: `exclude using gist (profissional_id with =, tstzrange(inicio, fim) with &&) where (status in ('agendado','concluido'))` |
| `agendamentos_servicos` | `agendamento_id`, `servico_id`, `preco_centavos`, `duracao_min` | cópia do serviço na hora, para histórico |
| `config_barbearia` | `conta_id` pk, `capa_url`, `descricao`, `whatsapp_sessao` (id no OpenWA), `whatsapp_status`, `lembrete_ativo bool`, `lembrete_dias int`, `lembrete_prazo_horas int`, `lembrete_hora time`, `lembrete_beneficio_tipo`, `lembrete_beneficio_valor`, `lembrete_beneficio_descricao`, `lembrete_mensagem text` | uma linha por conta com o módulo |
| `conversas_whatsapp` | `id`, `cliente_id`, `agendamento_origem_id`, `passo`, `dados jsonb`, `expira_em`, `encerrada_em`, `resultado` | estado do bot (seção 6) |
| `mensagens_whatsapp` | `id`, `conversa_id`, `direcao` (`enviada` \| `recebida`), `texto`, `id_externo`, `created_at` | registro para o dono ver o que o bot disse |

Horários são guardados em UTC e exibidos no fuso da conta.

## 4. Módulo barbearia — telas

### 4.1 Página pública `/b/[slug]`

Sem login. Lê com `dbServico()` **apenas** a conta pelo slug, serviços ativos, profissionais
ativos e disponibilidade; escreve **apenas** `clientes` (upsert pelo telefone) e `agendamentos`.
Estilo chat da referência, um passo por vez, com os passos anteriores visíveis acima:

1. Saudação com o nome da barbearia e a capa. "Qual o seu nome?"
2. "Qual o seu WhatsApp?" (com DDD; validado e normalizado para E.164; mostra o que entendeu).
3. Serviços: lista com nome, preço e duração; escolha múltipla; mostra total e duração somada.
4. Profissional: só os que fazem **todos** os serviços escolhidos. Opção "Qualquer um" (minha
   proposta): o sistema escolhe quem tem o horário livre.
5. Dia: 5 semanas à frente; dia sem faixa de horário para o profissional aparece desabilitado.
6. Horário: grade de horários livres (seção 5). "Neste dia não há horários" quando vazio.
7. Confirmação: resumo (serviços, profissional, dia, hora, total) e botão "Confirmar".
8. Pronto: "Marcado! Você recebe a confirmação no WhatsApp." Se o WhatsApp da barbearia não estiver
   conectado, só "Marcado!".

```
┌─────────────────────────────────────────────┐
│  [capa]            BARBEARIA DO ZÉ          │
│                                             │
│  Oi! Sou o agendamento da Barbearia do Zé.  │
│  Qual o seu nome?                           │
│                        Carlos Mendes ▸      │
│  E o seu WhatsApp, com DDD?                 │
│                        (11) 99999-0000 ▸    │
│  Quais serviços?                            │
│  ☑ Social ou Degradê   R$ 40,00   40 min    │
│  ☐ Barba clássica      R$ 40,00   35 min    │
│  ☐ Luzes               R$ 140,00  50 min    │
│  Total: R$ 40,00 · 40 min      [Continuar]  │
└─────────────────────────────────────────────┘
```

Ao confirmar: cria o agendamento com `origem = pagina`, `preco_centavos` = soma, e, se houver
sessão de WhatsApp conectada, envia a confirmação (modelo fixo, com nome, serviços, profissional,
data e hora e o endereço se houver na descrição). Não cria conversa.

Proteções mínimas: limite de 10 agendamentos por telefone por dia; nenhum dado de outros clientes
é exposto (a grade só diz "livre"/"ocupado").

### 4.2 Área do dono e do barbeiro (menu "Barbearia")

| rota | quem | o quê |
|---|---|---|
| `/agenda` | dono, barbeiro | dia a dia; uma coluna por profissional (barbeiro vê só a sua); navegação por dia; clicar num horário livre abre "Novo agendamento" (cliente por telefone, serviços, hora); clicar num agendamento abre detalhe com **Concluído**, **Faltou**, **Cancelar**, e o histórico de mensagens do WhatsApp daquele agendamento |
| `/clientes` | dono, barbeiro (só os seus) | lista com busca por nome e telefone; detalhe com histórico de atendimentos, `nao_contatar` e a última conversa |
| `/servicos` | dono | CRUD, ordenação, ativar/desativar |
| `/profissionais` | dono | CRUD; serviços que faz; faixas de horário por dia da semana; bloqueios; ligar a um usuário barbeiro |
| `/bloqueios` | barbeiro | os próprios bloqueios (folga, almoço) |
| `/configuracoes` | dono | capa, descrição, endereço da página pública (`/b/<slug>`, com botão copiar e QR), **WhatsApp** (seção 7.2) e **Lembrete** (seção 6.1) |

```
Agenda · ter 18/11                              [◀ hoje ▶]
         João             Ricardo          Júnior
09:00    Carlos M.        —                Pedro S.
         Social 40min                      Barba 35min
09:40    —                Lucas R.         —
10:20    (livre)          Cabelo/barba     (livre)
11:00    bloqueio: almoço (livre)          (livre)
```

Conclusão automática (minha proposta): o cron marca como `concluido` todo `agendado` cujo
`fim` já passou há mais de 24 h e que ninguém marcou como `faltou` ou `cancelado`. Sem isso, o
lembrete depende da disciplina do dono de clicar em "Concluído" em cada corte, e não sairia.

## 5. Disponibilidade

Função pura em `src/lib/agenda.ts`, testada em unidade:

`horariosLivres(profissional, dia, duracaoTotal, faixas, bloqueios, agendamentos, agora) → hora[]`

- Passo da grade = **duração total** dos serviços escolhidos (a referência faz isso: 09:00, 09:40,
  10:20 para 40 min). Começa no início de cada faixa do dia.
- Um horário entra se `[inicio, inicio + duracao)` cabe dentro de uma faixa, não cruza bloqueio nem
  agendamento `agendado`/`concluido`, e `inicio` é ao menos 30 min depois de `agora` (sem marcar
  para daqui a 5 minutos).
- "Qualquer um": roda por profissional habilitado e junta os horários; ao confirmar, escolhe o
  profissional com menos agendamentos no dia entre os livres naquele horário.
- A gravação confia na restrição de exclusão do banco: se dois clientes pegarem o mesmo horário,
  o segundo recebe erro e a tela pede outro horário.

## 6. Lembrete e bot do WhatsApp

### 6.1 Configuração (`/configuracoes`, aba Lembrete)

- Ligado / desligado.
- **Dias após o atendimento** (ex.: 15).
- **Benefício**: porcentagem (`10` = 10 %), valor (`R$ 10,00`) ou brinde em texto ("barba grátis").
- **Prazo da oferta** em horas (padrão 24): tempo de silêncio depois do qual a conversa fecha sem
  desconto.
- **Hora de envio** (padrão 10:00, no fuso da conta): o lembrete sai na primeira rodada do cron
  depois dessa hora.
- **Mensagem**, editável, com campos `{nome}`, `{servico}`, `{profissional}`, `{dias}`,
  `{beneficio}`. Padrão:

  > Oi, {nome}! Faz {dias} dias do seu {servico} com {profissional}. Marcando agora você ganha
  > {beneficio}.

  O sistema acrescenta as opções numeradas e a linha `Responda PARAR para não receber mais`.

### 6.2 Disparo (cron `/api/cron/lembretes` a cada 5 minutos, autenticado por `CRON_SECRET`)

Para cada conta com módulo barbearia, WhatsApp conectado, lembrete ligado e cuja hora de envio já
passou hoje, seleciona agendamentos `concluido` com `fim <= agora − dias`, `lembrete_enviado_em`
nulo, cliente sem `nao_contatar`, sem agendamento futuro `agendado`, e **um por cliente** (o mais
recente). Para cada um:

1. Calcula duas sugestões: os dois primeiros horários livres a partir de amanhã, com o mesmo
   profissional e os mesmos serviços (se o profissional saiu, o primeiro que faz os serviços).
2. Envia a mensagem + opções e grava `conversas_whatsapp` (`passo = oferta`, `dados` com serviços,
   profissional, sugestões e benefício, `expira_em = agora + prazo`), e `lembrete_enviado_em`.
3. Espaça os envios em 5 s (OpenWA recomenda ritmo), **no máximo 50 por execução** somando todas
   as contas (300 s de limite da função); o resto sai nas rodadas seguintes, alternando contas para
   nenhuma monopolizar. Falha num envio não derruba os outros: registra em `mensagens_whatsapp` e
   segue. A rodada marca `lembrete_enviado_em` **antes** de enviar, para duas rodadas concorrentes
   não mandarem o mesmo lembrete.

A conclusão automática de agendamentos (seção 4.2) roda na mesma rota, uma vez por rodada.

Sem sugestão possível (profissional sem horário livre em 14 dias): não manda e registra o motivo
no log do cron.

```
Barbearia: Oi, Carlos! Faz 15 dias do seu Social ou Degradê com o João.
           Marcando agora você ganha 10% de desconto.
           1) ter 18/11 às 10:20
           2) qui 20/11 às 15:00
           3) Ver outros horários
           0) Agora não
           Responda PARAR para não receber mais.
Cliente:   1
Barbearia: Marcado! ter 18/11 às 10:20, Social ou Degradê com João,
           R$ 36,00 (10% de desconto). Para desmarcar, responda CANCELAR.
```

### 6.3 Conversa (webhook `/api/whatsapp/webhook`)

OpenWA entrega `message.received` com assinatura HMAC (`OPENWA_WEBHOOK_SECRET`); assinatura
inválida → 401 e nada acontece. Mensagens enviadas pelo próprio número (`fromMe`) são ignoradas.

Procura conversa **aberta** (`encerrada_em` nulo, `expira_em` no futuro) pela sessão e pelo
telefone. **Sem conversa aberta: não responde nada** (decisão 3). Com conversa, pelo `passo`:

| passo | cliente manda | sistema |
|---|---|---|
| `oferta` | `1` ou `2` | tenta marcar; ok → confirma, `passo = marcado`; horário já ocupado → "Esse horário acabou de ser preenchido" e oferece as duas próximas sugestões, continua em `oferta` |
| `oferta` | `3` | lista até 7 próximos dias com horário livre, numerados; `passo = dia` |
| `oferta`, `dia`, `hora` | `0` | "Tudo bem! Quando quiser, é só marcar em /b/slug" com o link; encerra, `resultado = recusou` |
| `dia` | número da lista | lista até 8 horários livres daquele dia, numerados, mais `9) outro dia`; `passo = hora` |
| `hora` | número | marca como em `oferta`; `passo = marcado` |
| `marcado` | `CANCELAR` | cancela o agendamento, confirma, encerra, `resultado = cancelou` |
| qualquer | `PARAR` | `clientes.nao_contatar = true`, confirma, encerra |
| qualquer | não entendido | repete as opções **uma vez**; na segunda, "Sem problemas, o pessoal da barbearia te responde por aqui" e encerra, `resultado = nao_entendeu` |
| expirada | qualquer coisa | nada (o dono responde) |

Agendamento criado pelo bot: `origem = lembrete`, `desconto_*` copiados da configuração **no
momento do envio** (mudar a regra depois não altera ofertas já feitas), preço já com desconto. Se
a conversa chegar a `marcado`, a conta já não manda outro lembrete até esse atendimento concluir.
A conversa em `marcado` fica aberta até `expira_em` para aceitar `CANCELAR`; depois, cancelamento é
com o dono.

A lógica dos passos é uma função pura (`src/lib/bot-lembrete.ts`): recebe o estado e o texto,
devolve a resposta e o novo estado, sem tocar banco. É onde ficam os testes.

## 7. OpenWA e infraestrutura

### 7.1 Instalação

- **OpenWA é `github.com/rmyndharis/OpenWA`** (NestJS, MIT, imagem Docker multi-arch no GHCR;
  16,9 mil estrelas e último push em 2026-11-16, conferido). Não confundir com `open-wa/wa-automate`,
  WAHA nem Evolution API. É ele que tem **várias sessões numa instância**, chave de API gerada no
  primeiro boot (`X-API-Key`, com papéis admin/operator/viewer), `POST /api/sessions`,
  `POST /api/sessions/{id}/start`, `GET /api/sessions/{id}/qr`,
  `POST /api/sessions/{id}/messages/send-text`, e webhooks por sessão com eventos
  `message.received` e `session.status` assinados por HMAC com `secret`. Fixar a versão da imagem
  no compose; a API está em `openapi.json` no repositório.
- Um droplet da DigitalOcean (Ubuntu, 2 GB mínimo; o motor `whatsapp-web.js` usa 300–500 MB por
  sessão, então **o tamanho sobe com o número de barbearias**), Docker Compose do OpenWA com volume
  persistente, HTTPS por Caddy, firewall só 443. Domínio: um subdomínio do autor (ex.
  `wa.<dominio>`); se não houver domínio disponível na hora, `<ip>.sslip.io` serve para o Caddy
  emitir certificado, e troca-se depois. A chave de API gerada no primeiro boot vai para a Vercel como
  `OPENWA_API_KEY`; a URL, `OPENWA_URL`.
- Uma instância, **uma sessão por conta** (`whatsapp_sessao = conta.slug`). Cada sessão tem um
  webhook registrado apontando para `https://<app>/api/whatsapp/webhook`, todas com o mesmo
  `OPENWA_WEBHOOK_SECRET`; a sessão vem no corpo do evento e é por ela que o sistema acha a conta.
- O desenvolvimento local aponta para o mesmo OpenWA de produção **só com sessão de teste própria**
  (`teste-<nome>`), nunca a de uma barbearia. Isso é regra do `.env.example`.
- Provisionar o droplet é tarefa manual do autor, com roteiro no `README`; o sistema não cria
  infraestrutura. O `contexto-empresa.md` ganha o campo do app autorizado da DigitalOcean quando
  o droplet existir.

### 7.2 Conexão pela tela (`/configuracoes`, aba WhatsApp)

- Estado desconectado: botão "Conectar WhatsApp" → o servidor cria e inicia a sessão no OpenWA e
  mostra o QR (atualizado a cada 20 s até conectar). Instrução na tela: "Use um número só da
  barbearia; o WhatsApp pode bloquear números que mandam mensagem em massa."
- Conectado: número ligado, data, botão "Desconectar". O evento `session.status` do webhook
  atualiza `whatsapp_status`; a tela também consulta o status ao abrir.
- Qualquer envio com sessão fora do ar falha de forma registrada e não derruba a operação.

### 7.3 Envio

`src/lib/whatsapp.ts`, `server-only`: `enviarTexto(sessao, telefone, texto)` chama
`POST /api/sessions/{sessao}/messages/send-text` com `X-API-Key`, registra em
`mensagens_whatsapp` quando há conversa, e devolve sucesso/erro. Único ponto que fala com o OpenWA,
para trocar o motor depois (inclusive pela API oficial) sem tocar no resto.

## 8. Testes

- Unidade (vitest, já existe): `horariosLivres`, `bot-lembrete` (todos os passos da tabela 6.3,
  inclusive não entendido duas vezes, horário ocupado, PARAR), normalização de telefone, cálculo
  de desconto, montagem da mensagem com campos.
- Acesso (vitest contra o Supabase do projeto, com `SUPABASE_URL` de teste ou o mesmo projeto com
  contas descartáveis criadas e apagadas pelo teste): duas contas, um dono e um barbeiro em cada;
  prova de que select/insert/update/delete não cruzam conta e que o barbeiro não lê agenda nem
  cliente alheio. Roda no `npm test` quando as variáveis existirem; pula com aviso quando não.
- E2E (Playwright, já existe): login e redirecionamento; página pública do começo ao "Marcado!";
  agenda mostrando o agendamento criado; webhook simulado (POST assinado) levando uma conversa de
  `oferta` a `marcado`.
- Importação de `dbServico()` fora dos diretórios permitidos reprova em teste.

## 9. Fatias e ordem

1. **Contas e login**: seções 1, 2 e a migração; menu por módulo; Basic Auth sai no fim da fatia,
   depois do primeiro admin existir em produção. Eventos continua funcionando igual, agora dentro
   da conta VM Events.
2. **Barbearia**: seções 3, 4, 5; página pública e área do dono completas, sem WhatsApp (a
   confirmação pós-agendamento fica desligada até a fatia 3).
3. **WhatsApp e lembrete**: seções 6 e 7; droplet provisionado e Vercel no plano Pro antes de a
   fila começar (são dependências: sem OpenWA no ar e sem cron de 5 minutos, a fatia não fecha).

Cada fatia tem plano, issue guarda-chuva, issues de tarefa e **uma** PR.

## 10. Decisões pequenas já tomadas (minhas, após a revisão do documento)

- `empresas_nome_unico` passa a ser único **por conta** (`conta_id, lower(nome)`).
- Barbeiro pode **inserir** em `clientes` (cria cliente novo ao marcar pela agenda); não pode
  apagar.
- Telefone no webhook: números brasileiros chegam com ou sem o nono dígito; a busca do cliente
  casa as duas formas.
- `capa_url` vem do Supabase Storage, bucket público `capas`, caminho por `conta_id`.
- Cron em `vercel.json`: `*/5 * * * *` para `/api/cron/lembretes`. Mudar o plano da Vercel para
  Pro é tarefa manual do autor, antes da fatia 3.
- Extensão `btree_gist` ligada na migração, exigida pela restrição de exclusão de `agendamentos`.
- Durante a fatia 1, `proxy.ts` aceita **sessão ou Basic Auth**; as variáveis `ADMIN_*` saem da
  Vercel só depois de `primeiro-admin.ts` rodar em produção. Última tarefa da fatia remove o ramo
  do Basic Auth.
- O projeto Supabase de produção é `bedudumhtxflidndgqqz` (o da PR #37; o antigo foi apagado em
  2026-10-16, e a Vercel já aponta para o novo). A migração roda nele, com backup antes.

## 11. O que fica para quem constrói

- Formato exato das políticas RLS e da função `conta_atual()`; se usar claim no JWT em vez de
  consulta a `usuarios` para desempenho, documentar.
- Componentes da página pública (os `ui/` do shadcn já no projeto; GSAP para a entrada das
  mensagens do chat, já instalado). O portão de design (Refero, 21st.dev, `DIRECAO.md`) vale para
  a página pública, que é tela nova vista por cliente final; a área do dono segue o AdminCN atual.
- Nome e cor do módulo no menu; ícones.
- Detalhe das mensagens do bot fora das mostradas aqui (confirmação de cancelamento, texto do
  PARAR), desde que curtas e em português.
- Como mostrar o QR do OpenWA (imagem base64 que a API devolve) e o intervalo de atualização.
- Estratégia de teste de acesso: projeto Supabase separado ou contas descartáveis no mesmo.
