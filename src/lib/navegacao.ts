import type { Papel } from "./sessao";

export type Visao = { papel: Papel; adminPlataforma: boolean; modulos: readonly string[] };
export type Grupo = { titulo: string; itens: { href: string; texto: string }[] };

// Itens do menu lateral, em grupos, conforme o papel e os módulos ligados na conta.
export function gruposPara(v: Visao): Grupo[] {
  const grupos: Grupo[] = [];
  if (v.papel === "dono" && v.modulos.includes("eventos")) {
    grupos.push({
      titulo: "Gestão",
      // Na ordem do trabalho: a empresa vem antes do evento.
      itens: [
        { href: "/empresas", texto: "Empresas" },
        { href: "/eventos", texto: "Eventos" },
      ],
    });
    grupos.push({ titulo: "Operação", itens: [{ href: "/checkin", texto: "Check-in" }] });
  }
  if (v.papel === "dono") grupos.push({ titulo: "Conta", itens: [{ href: "/usuarios", texto: "Usuários" }] });
  if (v.adminPlataforma) grupos.push({ titulo: "Plataforma", itens: [{ href: "/admin/contas", texto: "Contas" }] });
  return grupos;
}

// Ativo é o item cujo caminho é o prefixo mais longo da rota atual:
// em /eventosx não acende "Eventos", e em /eventos/<id>/participantes/novo acende.
export function itemAtivo(caminho: string, grupos: Grupo[]): string | undefined {
  const todos = grupos.flatMap((g) => g.itens.map((i) => i.href));
  return todos.filter((h) => caminho === h || caminho.startsWith(`${h}/`)).sort((a, b) => b.length - a.length)[0];
}

// Para onde mandar depois do login, por papel e módulo.
export function inicioDe(v: Visao): string {
  if (v.papel === "dono" && v.modulos.includes("eventos")) return "/eventos";
  if (v.adminPlataforma) return "/admin/contas";
  if (v.papel === "dono") return "/usuarios";
  return "/minha-conta";
}

// `?proximo=` do login: só caminho interno. Recusa URL absoluta, protocol-relative ("//host")
// e o próprio /entrar (senão o login redireciona para o login).
export function destinoSeguro(proximo: string | undefined): string {
  if (!proximo || !proximo.startsWith("/") || proximo.startsWith("//") || proximo === "/entrar") return "/";
  return proximo;
}

const NOMES: Record<string, string> = {
  eventos: "Eventos",
  participantes: "Participantes",
  empresas: "Empresas",
  importar: "Importar planilha",
  novo: "Novo",
  editar: "Editar",
  entrar: "Entrar",
  "minha-conta": "Minha conta",
  usuarios: "Usuários",
  admin: "Plataforma",
  contas: "Contas",
};

// Cada segmento da URL vira um passo do breadcrumb; segmento desconhecido (o id) vira "Detalhe".
export function trilha(caminho: string): { href: string; texto: string }[] {
  const partes = caminho.split("/").filter(Boolean);
  return partes.map((p, i) => ({ href: "/" + partes.slice(0, i + 1).join("/"), texto: NOMES[p] ?? "Detalhe" }));
}
