// Erro do PostgREST/Postgres -> frase para quem está usando o sistema.
// `code` é o SQLSTATE do Postgres. `on delete restrict` devolve 23001; FK sem ação devolve 23503.
export type ErroBanco = { code?: string; message: string };

export function mensagemErro(e: ErroBanco, unico = "Já existe um cadastro com esse valor"): string {
  if (e.code === "23505") return unico;
  if (e.code === "23001" || e.code === "23503") return "Não dá para apagar: há cadastros ligados a este registro";
  return `Erro ao salvar: ${e.message}`;
}
