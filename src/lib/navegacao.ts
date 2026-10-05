// Itens do menu lateral, em grupos. Os ícones ficam no componente; aqui só caminho e texto.
export const GRUPOS = [
  {
    titulo: "Gestão",
    itens: [
      { href: "/eventos", texto: "Eventos" },
      { href: "/participantes", texto: "Participantes" },
      { href: "/empresas", texto: "Empresas" },
    ],
  },
  {
    titulo: "Operação",
    itens: [
      { href: "/participantes/importar", texto: "Importar planilha" },
      { href: "/checkin", texto: "Check-in" },
    ],
  },
] as const;

const TODOS: string[] = GRUPOS.flatMap((g) => g.itens.map((i) => i.href));

// Ativo é o item cujo caminho é o prefixo mais longo da rota atual:
// em /participantes/importar acende "Importar planilha", e não "Participantes".
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
  inscrever: "Inscrever",
};

// Cada segmento da URL vira um passo do breadcrumb; segmento desconhecido (o id) vira "Detalhe".
export function trilha(caminho: string): { href: string; texto: string }[] {
  const partes = caminho.split("/").filter(Boolean);
  return partes.map((p, i) => ({ href: "/" + partes.slice(0, i + 1).join("/"), texto: NOMES[p] ?? "Detalhe" }));
}
