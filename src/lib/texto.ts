export function semAcento(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Guardado em nome_busca: a busca compara sem acento e sem caixa.
export function normalizarBusca(valor: string): string {
  return semAcento(valor).toLowerCase().replace(/\s+/g, " ").trim();
}

// Nome de participante entra no HTML do e-mail.
export function escaparHtml(valor: string): string {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Tira o que quebra a sintaxe do filtro .or() do PostgREST e os curingas do ilike.
export function limparTermo(valor: string): string {
  return normalizarBusca(valor).replace(/[,()%*\\:"]/g, " ").replace(/\s+/g, " ").trim();
}

// Avatar das listas: primeira letra do primeiro e do último nome, em maiúscula ("José da Conceição" → "JC").
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toLocaleUpperCase("pt-BR");
}

// Slug da conta, preenchido a partir do nome: "Barbearia do Zé" → "barbearia-do-ze". O corte em 40
// (limite do slug no banco) pode cair num hífen, por isso a ponta é limpa de novo depois dele.
export function slugDe(nome: string): string {
  return semAcento(nome)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}
