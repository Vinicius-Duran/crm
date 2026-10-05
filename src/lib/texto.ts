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
