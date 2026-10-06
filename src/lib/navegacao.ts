// Itens do menu lateral, em grupos. Os ícones ficam no componente; aqui só caminho e texto.
export const GRUPOS = [
  {
    titulo: "Gestão",
    // Na ordem do trabalho: a empresa vem antes do evento.
    itens: [
      { href: "/empresas", texto: "Empresas" },
      { href: "/eventos", texto: "Eventos" },
    ],
  },
  {
    titulo: "Operação",
    itens: [{ href: "/checkin", texto: "Check-in" }],
  },
] as const;

const TODOS: string[] = GRUPOS.flatMap((g) => g.itens.map((i) => i.href));

// Ativo é o item cujo caminho é o prefixo mais longo da rota atual:
// em /eventosx não acende "Eventos", e em /eventos/<id>/participantes/novo acende.
export function itemAtivo(caminho: string): string | undefined {
  return TODOS.filter((h) => caminho === h || caminho.startsWith(`${h}/`)).sort((a, b) => b.length - a.length)[0];
}

const NOMES: Record<string, string> = {
  eventos: "Eventos",
  participantes: "Participantes",
  empresas: "Empresas",
  importar: "Importar planilha",
  novo: "Novo",
  editar: "Editar",
};

// Cada segmento da URL vira um passo do breadcrumb; segmento desconhecido (o id) vira "Detalhe".
export function trilha(caminho: string): { href: string; texto: string }[] {
  const partes = caminho.split("/").filter(Boolean);
  return partes.map((p, i) => ({ href: "/" + partes.slice(0, i + 1).join("/"), texto: NOMES[p] ?? "Detalhe" }));
}
