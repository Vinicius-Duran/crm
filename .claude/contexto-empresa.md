# Contexto da Empresa — Fonte da verdade do pipeline

> Preenchido para o repositório `Vinicius-Duran/crm` (CRM de eventos) em 2026-10-05.

Este arquivo é a **única** fonte de configuração do pipeline de tarefas. Os quatro agentes
(`coordenador`, `desenvolvedor`, `code-reviewer-task`, `finalizador`) leem este documento antes de
qualquer outra coisa e não carregam nomes de empresa, caminhos ou comandos embutidos no próprio
prompt.

Para mudar de empresa, projeto ou stack no futuro, edite **apenas este arquivo**.

Campos marcados com `<<PREENCHER>>` ainda não foram informados. Um agente que precise de um campo
`<<PREENCHER>>` para prosseguir deve **parar e retornar BLOQUEADO**, nomeando o campo — nunca
adivinhar, nunca usar valor de exemplo.

---

## 1. Identidade

| Item | Valor |
|---|---|
| Empresa | Vinicius Duran (projeto pessoal) |
| Organização (owner) no GitHub | `Vinicius-Duran` (conta de usuário, não organização) |
| Repositório padrão das issues | `Vinicius-Duran/crm` |
| Responsável das tarefas | `Vinicius-Duran` |
| Raiz dos repositórios na máquina | não definida — varia por máquina; ver nota na seção 2 |
| Idioma de artefatos e comentários | português do Brasil |

> **Issue Types não existem aqui.** O repositório é de conta de usuário, e Issue Types são recurso de
> organização. A taxonomia é só por label (seção 5). O repositório é **público**: nunca anexe dados
> reais de participante (nome, CPF, e-mail) em issue, PR, commit ou fixture.

O pipeline conversa com o GitHub pela CLI `gh`. Antes de qualquer leitura, confirme a autenticação:

```bash
gh auth status
```

Se `gh` não estiver instalado ou autenticado, isso é **falha de ambiente**: bloqueie as tarefas
afetadas nomeando o problema (ver 5.3). Nunca tente autenticar por conta própria nem gravar token.

### Como uma tarefa é identificada

O usuário informa **números de issue**. O repositório é o padrão da tabela acima, salvo quando o
próprio identificador diz outro:

| Formato informado | Resolve para |
|---|---|
| `152` | issue 152 no repositório padrão das issues |
| `repo#152` | issue 152 em `{owner padrão}/repo` |
| `owner/repo#152` | issue 152 nesse repositório, ignorando os padrões |

O repositório **da issue** e o repositório **do código** podem ser diferentes. Quem determina o
repositório de código é o `desenvolvedor`, a partir do conteúdo da issue (ver seção 2).

## 2. Repositórios de código

Preencha a tabela conforme os repositórios forem sendo mapeados. Enquanto ela estiver incompleta, o
`desenvolvedor` identifica o repositório por **evidência**: o que a issue nomeia e, na falta disso,
busca por termo-chave da tarefa dentro dos diretórios da raiz. O achado vai para o `IMPLEMENTACAO.md`.

Todos ficam em `https://github.com/{owner}/{repositório}`.

| Repositório | Caminho local | Stack | Domínio / responsabilidade |
|---|---|---|---|
| `crm` | | Next.js 16 + TypeScript + Supabase | CRM de eventos: cadastro, credencial em PDF, check-in |

> Confirme cada nome de repositório na plataforma de hospedagem e cada stack pelos marcadores da
> seção 3 antes de confiar nesta tabela. Nome de repositório **não** é prova de stack — inferir a
> stack pelo padrão do nome já produziu tabela errada neste pipeline.

A coluna "Caminho local" está vazia de propósito: cada máquina clona onde quiser. Quando o
`desenvolvedor` precisar do repositório, ele localiza o clone a partir do nome desta tabela. Se a sua
máquina usa um caminho estável, preencher a coluna economiza essa busca — é uma alteração local, não
uma regra do time.

Se a mesma issue atingir mais de um repositório, o pipeline trata **um por vez**: o desenvolvedor
escolhe o principal e registra os demais na seção de impacto do `IMPLEMENTACAO.md`.

## 3. Stacks e comandos

A stack é **detectada por repositório**, pelos marcadores abaixo. Nunca presuma a stack pelo nome do
repositório.

### 3.1 Stacks do projeto — preencha um bloco por stack

Copie o bloco abaixo uma vez para cada stack que o projeto usa, numerando (3.1, 3.2, …). Apague os
que não usar. **A detecção é o campo mais importante:** é por ela que o agente descobre a stack de um
repositório, e ela nunca deve ser o nome do repositório.

#### Stack: Next.js 16 + TypeScript

| Item | Valor |
|---|---|
| Detecção | `package.json` contém `"next"` |
| Build | `npm run build` |
| Typecheck | `& .\node_modules\.bin\tsc.cmd --noEmit -p .` |
| Lint | `& .\node_modules\.bin\eslint.cmd src e2e playwright.config.ts` |
| Testes | unitários: `& .\node_modules\.bin\vitest.cmd run` · ponta a ponta: `npm run e2e` (Playwright; exige `.env.local` com Supabase) |
| Biblioteca compartilhada | nenhuma |

Pontos de entrada típicos para exploração (confirme no repositório antes de assumir):
`src/lib/` (regras e acesso ao banco), `src/app/` (telas e Server Actions), `supabase/migrations/`,
e o plano em `docs/superpowers/plans/2026-10-05-crm-eventos.md`, de onde saem as issues.

**Como rodar os comandos:** pelo **PowerShell**, chamando o binário de `node_modules\.bin` direto.
A ferramenta Bash desta máquina passa por um hook (`rtk`) que já devolveu suíte "quebrada" sem
nenhum teste ter rodado. `git` pelo Bash funciona normal.

**Duas suítes:** Vitest (unitária, sempre) e Playwright (`e2e/`, a partir da tarefa que a cria).
O E2E grava no Supabase de verdade e apaga o que criou; sem `.env.local` ele não roda. Isso é falha
de ambiente, a registrar, e não teste vermelho.

**Front-end:** tarefas com tela seguem as cinco skills obrigatórias e o teste no Playwright MCP em
1440 e 390 de largura, conforme as Restrições globais do plano.

**Next 16:** leia `node_modules/next/dist/docs/` antes de usar uma API do Next (ver `AGENTS.md`).

**Se algum comando desta stack não puder ser rodado pela ferramenta padrão de shell** — hook que
corrompe a saída, runner que exige invocação própria, binário fora do `PATH` —, escreva aqui **como**
rodar. Um agente que lê saída corrompida reporta suíte quebrada sem que nada tenha quebrado, e isso
já aconteceu.

**Se o projeto tiver mais de uma suíte de testes, liste TODAS.** Suíte esquecida fica vermelha sem
ninguém ver.

**Se o CI rodar algum portão além de build/lint/teste** (documentação gerada, formatação, licença),
registre aqui — senão o pipeline entrega PR que o CI reprova.

### 3.4 Gerenciador de pacotes (stacks de JavaScript/TypeScript)

Detecte pelo lockfile presente no repositório e use o gerenciador correspondente em **todos** os
comandos:

| Lockfile | Gerenciador |
|---|---|
| `package-lock.json` | `npm` |
| `yarn.lock` | `yarn` |
| `pnpm-lock.yaml` | `pnpm` |
| `bun.lockb` | `bun` |

Nunca troque de gerenciador nem gere um lockfile diferente do que já existe no repositório.

### 3.5 Regra que prevalece sobre tudo acima

Se o repositório tiver `CLAUDE.md` ou `AGENTS.md`, **ele é a autoridade** sobre arquitetura,
convenções, camadas e comandos. Esta seção é o padrão de fallback para quando o repositório não
documenta. Em caso de conflito, o documento do repositório vence.

## 4. Git

| Item | Valor |
|---|---|
| Branch padrão do repositório | `main` |
| Branch base do pipeline | `main` — é a branch ALVO do PR |
| Origem da branch de trabalho | criada a partir da branch base acima |
| Padrão de nome de branch | `{issue}-{até-duas-palavras-kebab-case}` |
| Regra sobre a branch base | nunca commite direto nela; só entra por PR revisado pelo autor |
| Exemplo | issue 4521 "Adicionar campo X" → `4521-campo-x` |
| Estilo de commit | Verbo no imperativo, em português, referenciando a issue |
| Exemplo de commit | `Adiciona campo X no cadastro (#4521)` |
| Push da branch | Feito pelo `finalizador`, ao encerrar a tarefa |
| Criação de PR | Feita pelo `finalizador`, via skill `github-pr` |

Antes de commitar, confira o estilo real do histórico com `git log --oneline -10` e siga o que o
repositório já pratica, mesmo que divirja do exemplo acima.

> **Atenção ao `#{issue}` na mensagem de commit.** Quando o repositório de código é o mesmo das
> issues, o GitHub cria a referência automaticamente — é o comportamento desejado. Quando são
> repositórios diferentes, `#{issue}` aponta para uma issue **do repositório de código**, que
> provavelmente não é a sua. Nesse caso use a forma completa `owner/repo#{issue}`.

## 4.1 Pull request

| Item | Valor |
|---|---|
| Branch alvo do PR | a branch base da tabela acima |
| **Unidade de entrega** | **a EXECUÇÃO** — todas as tarefas de uma fila compartilham uma branch e rendem **uma** PR |
| Reviewers padrão | nenhum: o autor revisa pela UI |
| Vínculo com a issue | obrigatório — o corpo do PR sempre referencia a issue da tarefa |
| Idioma do título e da descrição | português do Brasil |

O PR é criado **exclusivamente** pelo `finalizador`, e **uma vez por execução** — no fim da fila,
e não a cada tarefa. A skill usada sai da plataforma do remote (`github-pr` ou `azure-devops-pr`).
Nenhum outro agente faz push ou abre PR.

**Quem invoca decide o tamanho da entrega escolhendo o que passa na fila.** Passar as tarefas de
uma fatia rende a PR daquela fatia; passar uma tarefa só rende a PR dela. Uma PR por tarefa num
plano de dezenas produz revisões que ninguém acompanha — foi por isso que a unidade virou a fila.

**Não use palavra-chave de fechamento automático** (`Closes #123`, `Fixes #123`) no corpo do PR: quem
fecha a issue é o `finalizador`, ao encerrar a tarefa, e não o merge do PR. Duas fontes fechando a
mesma issue produzem fechamento em momento imprevisível. Referencie com `Ref #123` ou
`Ref owner/repo#123`.

## 5. GitHub — issues e labels

Uma issue não tem estado além de **aberta** e **fechada**. O estágio do pipeline é registrado em
**labels**, e é o que permite retomar uma execução interrompida.

**Os agentes não conhecem estes nomes.** Eles referem-se aos labels por **papel**, usando os
símbolos da coluna "Papel"; o nome real sai desta tabela. Um projeto que já tenha um label
equivalente **reaproveita o que existe** em vez de criar outro — taxonomia que ninguém aplica é pior
que taxonomia pequena.

| Papel | Nome neste projeto | Significado | Pipeline escreve? |
|---|---|---|---|
| `{label-desenvolvimento}` | `em-desenvolvimento` | Em implementação | **sim** |
| `{label-code-review}` | `em-code-review` | Em revisão de código | **sim** |
| `{label-bloqueio}` | `bloqueado` | Bloqueada — precisa de decisão humana | **sim** (fim de linha em falha) |
| `{label-fora-do-pipeline}` | `rascunho` | Ainda em descrição — não entra no pipeline | **não** — é a pessoa que aplica e remove |

Além dos de estágio, o repositório usa `fatia` (issue guarda-chuva, escrita a partir da spec) e
`tarefa` (uma por tarefa do plano). O pipeline não escreve nenhum dos dois.
| — | _(issue fechada)_ | Entregue, PR aberto | **sim** (fim de linha em sucesso) |

Os labels precisam existir no repositório das issues antes da primeira execução. Crie apenas os
que **não** tiverem equivalente já em uso:

```bash
gh label create em-desenvolvimento --repo Vinicius-Duran/crm --color 1D76DB --description "Pipeline: em implementação"
gh label create em-code-review --repo Vinicius-Duran/crm --color FBCA04 --description "Pipeline: em revisão de código"
gh label create bloqueado --repo Vinicius-Duran/crm --color B60205 --description "Pipeline: precisa de decisão humana"
gh label create rascunho --repo Vinicius-Duran/crm --color CCCCCC --description "Ainda em descrição — fora do pipeline"
```

Isso é preparação de ambiente, feita **uma vez por uma pessoa** — o pipeline nunca cria label em
tempo de execução. Label inexistente no momento de aplicar é bloqueio, não motivo para improvisar.

Se o time não usar `rascunho`, apague a linha desta tabela: a ausência do label passa a significar
apenas "sem marcação", e toda issue aberta e atribuída fica elegível.

| Item | Valor |
|---|---|
| Desfecho de sucesso | issue **fechada** |
| Quem aplica e remove label de estágio | **apenas o `coordenador`** |
| Quem fecha a issue | **apenas o `finalizador`**, no estágio 3 |
| Campos que o pipeline pode alterar | labels de estágio e o estado aberta/fechada |
| Campos que o pipeline nunca altera | título, corpo, responsável, milestone, projeto, demais labels |

O `finalizador` fecha a issue porque o fechamento é parte da entrega: ele acontece no mesmo momento e
pela mesma razão que o comentário de entrega, depois do PR existir. Já os labels de estágio são do
`coordenador`, que é quem conhece o veredito de cada estágio. Nenhum outro agente escreve na issue.

### Reabertura

O pipeline **nunca reabre** uma issue fechada. Issue fechada é tarefa concluída; se ela precisar
voltar, quem reabre é uma pessoa.

## 5.1 Elegibilidade da tarefa

Uma tarefa só entra no pipeline se atender a **todos** os critérios abaixo. A verificação é feita
pelo `coordenador`, na triagem, **antes** de despachar qualquer agente — nunca depois de já ter
gasto implementação.

| Critério | Regra |
|---|---|
| Estado | a issue precisa estar **aberta** |
| Responsável | `assignees` precisa conter o responsável configurado na seção 1 |
| Labels | não pode ter `rascunho` nem `bloqueado` |

Não há critérios adicionais: tipo da issue, milestone, projeto e presença de critérios de aceite
**não** são avaliados na elegibilidade.

### Onde estão os critérios de aceite

A issue **é** o plano — o pipeline não produz documento de desenho antes do código. Os critérios de
aceite saem do corpo da issue, nesta ordem de preferência:

1. Uma seção intitulada "Critérios de aceite" (ou "Acceptance criteria"), quando existir.
2. Os itens de checklist `- [ ]` do corpo, quando não houver a seção.
3. Na falta dos dois, **a descrição inteira é o requisito** — e cada afirmação verificável dela é
   tratada como um critério.

Comentários da issue contam como parte do requisito quando esclarecem ou corrigem o corpo. Quando
comentário e corpo se contradizem sem que se possa decidir qual vale, isso é **BLOQUEADO** — não
escolha um dos dois por conta própria.

### Quando a tarefa não é elegível

O coordenador **pula a tarefa e segue para a próxima da fila**. Nunca para o lote inteiro por causa
de um item inelegível.

Ao pular, ele:

1. **Não** toca na issue — não comenta, não altera label, não cria branch.
2. Registra o motivo exato (qual critério falhou e qual era o valor encontrado).
3. Continua imediatamente para o próximo ID.
4. Lista todas as puladas no relatório final, com o motivo de cada uma.

Se **todas** as tarefas da fila forem inelegíveis, ele reporta isso claramente em vez de anunciar
um lote concluído sem trabalho feito.

### Autenticação versus atribuição

O pipeline se autentica no GitHub com a conta que estiver ativa em `gh auth status`. Isso é
independente do critério de atribuição: a conta autenticada **executa**, mas a issue precisa estar
atribuída ao responsável configurado na seção 1. Não confunda os dois.

## 5.2 Máquina de estados do pipeline

O label da issue **é** o estado do pipeline. Ele avança conforme os estágios passam, de modo que o
board reflete onde a tarefa está e uma execução interrompida possa ser retomada depois.

```
  aberta ──▶ em-desenvolvimento ──▶ em-code-review ──▶ fechada
  (entrada)     implementação          code review       PR aberto
                                            │            (fim do pipeline)
                                            ▼
                                   em-desenvolvimento
                                    code review reprovado

          qualquer estágio ──────────▶ bloqueado
           (BLOQUEADO ou                precisa de
            limite de ciclos)           decisão humana
```

### Transições

| Momento | Label resultante | Quem move |
|---|---|---|
| Antes do pipeline | nenhum (ou `rascunho`) | pessoa (fora do pipeline) |
| Ao despachar o `desenvolvedor` | `em-desenvolvimento` | coordenador |
| Ao despachar o `code-reviewer-task` | `em-code-review` | coordenador |
| Code review **reprovado** | `em-desenvolvimento` | coordenador |
| Após o `finalizador` retornar CONCLUIDO | nenhum — issue **fechada** | finalizador (fecha) + coordenador (limpa os labels) |
| Qualquer agente retornar BLOQUEADO | `bloqueado` | coordenador |
| Limite de ciclos atingido | `bloqueado` | coordenador |

Regras:

- **Só o coordenador escreve label.** Nenhum agente de trabalho aplica ou remove label.
- **Só o finalizador fecha a issue.** O coordenador nunca fecha, nem reabre.
- Os labels de estágio são **mutuamente exclusivos**: ao aplicar um, remova o anterior. Uma issue
  com `em-desenvolvimento` e `em-code-review` ao mesmo tempo torna a retomada ambígua.
- O coordenador move o label **ao despachar** o estágio, não depois — assim, se a execução cair no
  meio, o label já reflete onde ela estava.
- Ao aplicar `bloqueado`, remova os labels de estágio: a tarefa não está mais avançando.
- Depois que o finalizador fechar a issue, o coordenador remove `em-code-review`. Issue fechada com
  label de estágio pendurado sugere trabalho em andamento que não existe mais.
- Se uma escrita de label for rejeitada pelo GitHub (rede, permissão, label inexistente), o
  coordenador **bloqueia a tarefa** (ver 5.3), registrando o label atual, o pretendido e o erro.
  Nunca improvise outro label nem crie label novo em tempo de execução. Se a própria aplicação de
  `bloqueado` for rejeitada, registre isso no `BLOQUEIO.md` e siga para a próxima tarefa.

### Elegibilidade por estado

| Situação encontrada | Ação |
|---|---|
| Aberta, sem label de estágio | inicia do desenvolvimento |
| Aberta com `em-desenvolvimento` | **retoma** — estágio determinado pelos artefatos em disco |
| Aberta com `em-code-review` | **retoma** do code review |
| Aberta com `rascunho` | pula — ainda em descrição |
| Aberta com `bloqueado` | pula — aguarda decisão humana sobre o bloqueio anterior |
| Fechada | pula — o pipeline já concluiu esta tarefa |

Uma issue com `bloqueado` só volta ao pipeline depois que alguém resolve o impedimento e remove o
label. O pipeline nunca desbloqueia sozinho — se pudesse, repetiria o mesmo bloqueio indefinidamente.

### Como o coordenador determina o ponto de retomada

Em qualquer label de estágio, ele inspeciona `.tarefas/{issue}/` e retoma do **primeiro estágio
incompleto**. Avalie as linhas na ordem e pare na primeira que casar:

| Situação encontrada | Retoma de |
|---|---|
| Sem `IMPLEMENTACAO.md` | desenvolvedor |
| `IMPLEMENTACAO.md` presente, sem `CODE-REVIEW.md` | code-reviewer-task |
| `CODE-REVIEW.md` com veredito REPROVADO ou BLOQUEADO | desenvolvedor |
| `CODE-REVIEW.md` APROVADO, sem `FECHAMENTO.md` | finalizador |
| `FECHAMENTO.md` presente e a issue ainda aberta | finalizador — a entrega não se completou |

O label diz onde a execução anterior **estava**; os artefatos dizem o que ela **terminou**. Quando os
dois discordam, os artefatos vencem: o label pode ter sido escrito e a execução cair em seguida.

Se a pasta de artefatos não existir — típico de outra máquina, já que ela não é versionada — o
coordenador **recomeça do desenvolvimento e avisa explicitamente** que vai refazer o trabalho
anterior. Nunca finja retomar sem os artefatos.

## 5.3 Bloqueio de tarefa

**O pipeline roda sozinho, sem supervisão humana. A fila nunca para.** Não há ninguém olhando o
terminal para responder perguntas. Toda impossibilidade — qualquer que seja — vira registro em
artefato, label `bloqueado`, e seguir para a próxima tarefa.

Nenhum agente deve fazer pergunta e aguardar resposta. Nenhum agente deve interromper a execução
esperando decisão. O que não puder ser resolvido é documentado e deixado para trás.

### Quando bloquear

Sempre que a tarefa não puder avançar. Sem exceção, e sem tentar contornar:

| Situação | Exemplo |
|---|---|
| Qualquer agente retorna **BLOQUEADO** | requisito ambíguo na issue, repositório indefinido, corpo e comentário se contradizendo |
| Limite de ciclos de correção | o code review reprovou 3 vezes seguidas |
| Árvore de trabalho suja | o repositório tem alterações não commitadas de outro trabalho |
| Falha de ambiente | dependência não restaura, build quebrado na branch base, `gh` sem autenticação |
| Escrita de label rejeitada | o GitHub recusou aplicar o label seguinte |
| Issue inacessível | o número não existe, ou a leitura falhou |
| Configuração incompleta | campo deste documento marcado como `<<PREENCHER>>` |

### Procedimento

1. **Escrever `BLOQUEIO.md`** na pasta de artefatos da tarefa. Este passo vem primeiro e nunca
   falha, porque é local — é a garantia de que o motivo não se perde mesmo se o GitHub estiver fora.
2. **Aplicar o label `bloqueado`** e remover os labels de estágio.
3. **Publicar um comentário** na issue com o motivo (template abaixo).
4. **Não desfazer nada:** branch criada e commits feitos permanecem, para quem for destravar.
5. **Seguir imediatamente** para a próxima tarefa da fila.

Se os passos 2 ou 3 falharem — GitHub indisponível, sem permissão —, registre a falha no próprio
`BLOQUEIO.md` e **siga assim mesmo**. Um bloqueio documentado só localmente é melhor do que uma fila
travada.

A issue bloqueada **permanece aberta**. Fechar uma tarefa que não foi entregue apagaria do board o
único sinal de que ela precisa de alguém.

O comentário de bloqueio é escrito pelo **coordenador**, não pelo finalizador. A divisão é: o
finalizador comenta a **entrega**; o coordenador comenta o **bloqueio**. Nunca os dois na mesma
tarefa, porque uma tarefa entregue não está bloqueada e vice-versa.

### `BLOQUEIO.md`

```markdown
# Bloqueio — Issue {id}

- **Data:** {data}
- **Estágio:** {desenvolvimento | code review | entrega}
- **Origem:** {veredito BLOQUEADO de {agente} | limite de ciclos | falha de ambiente | ...}

## Motivo
{o que impediu o avanço, em texto claro}

## Evidência
{saída de erro, pendências do agente, ou o que foi observado}

## Estado deixado
- **Issue:** {labels aplicados, ou "não foi possível alterar — motivo"}
- **Comentário no GitHub:** {publicado | falhou — motivo}
- **Branch:** {nome e commits, ou nenhuma}
- **PR:** {número, ou não criado}

## O que é preciso decidir
- {o que uma pessoa precisa resolver}
```

### Template do comentário de bloqueio

```markdown
## Tarefa bloqueada

**Estágio:** {desenvolvimento | code review | entrega}

## Motivo

{Explicação em português, para uma pessoa que não acompanhou a execução. Diga o que impediu o
avanço, não o jargão interno do pipeline.}

## O que já foi feito

- {artefatos produzidos, branch criada, commits, PR — ou "nada, o bloqueio ocorreu antes"}

## O que é preciso decidir

- {o que uma pessoa precisa resolver para a tarefa voltar ao fluxo}

## Como retomar

Resolva os pontos acima e remova o label `bloqueado`. O pipeline retoma do ponto onde parou quando o
trabalho anterior estiver disponível.
```

Valem as mesmas regras de formatação do comentário de entrega: quebras de linha reais, português, e
nenhuma menção a IA ou atribuição automática.

### Falha sistêmica

Quando o problema afeta **todas** as tarefas — GitHub inacessível, `gh` sem autenticação,
configuração incompleta — o pipeline ainda assim **não para**. Ele registra `BLOQUEIO.md` para cada
tarefa da fila com a mesma causa e conclui, deixando no relatório final o diagnóstico consolidado.

Isso evita o pior desfecho para uma execução desassistida: parar no primeiro ID e não deixar rastro
dos demais. Ao final, quem ler o relatório vê de uma vez que a causa era única e ambiental, e não um
problema por tarefa.

## 6. Artefatos do pipeline

| Item | Valor |
|---|---|
| Pasta por tarefa | `.tarefas/{issue}/`, relativa à raiz do projeto |
| Implementação | `IMPLEMENTACAO.md` |
| Code review | `CODE-REVIEW.md` |
| Fechamento | `FECHAMENTO.md` |
| Bloqueio | `BLOQUEIO.md` |
| Estado do pipeline | `ESTADO.json` |
| Máx. ciclos de correção de código | 3 |

Não há artefato de plano: a issue é o plano. O `IMPLEMENTACAO.md` é o primeiro documento produzido, e
é ele que carrega o repositório, a stack e a branch para os estágios seguintes.

## 7. Regras invioláveis

Valem para todos os agentes, em todos os artefatos que saem deste pipeline:

1. **Nunca** mencione Claude, IA, "Generated with", "Co-Authored-By" ou qualquer atribuição
   automática em código, comentário de código, mensagem de commit, descrição de PR ou comentário de
   issue. O code review reprova por isso.
2. Push e criação de PR são **exclusividade do `finalizador`**, e só depois do code review
   aprovado. Nenhum outro agente envia branch ao remoto nem abre PR.
3. **Nunca** commite segredo, credencial, connection string, `.env` ou configuração local.
4. **Nunca** amplie o escopo além do que a issue pede: sem refatoração oportunista, sem bump de
   dependência, sem formatação em massa.
5. **Nunca** descarte, faça stash ou commite trabalho não relacionado que já estava na árvore.
6. Artefatos e comentários sempre em português, com quebras de linha reais — nunca `\n` literal.
7. **Execução desassistida.** Nenhum agente faz pergunta e aguarda resposta, nem interrompe a fila
   esperando decisão humana. O que não puder ser resolvido é documentado em artefato, marcado como
   `bloqueado`, e deixado para trás — a fila segue. Ver 5.3.
