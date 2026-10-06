// ?pagina=N da URL -> página válida e o intervalo de linhas para o .range() do PostgREST (inclusivo).
// Página acima da última cai na última; qualquer coisa que não seja inteiro positivo cai na primeira.
export function paginar(param: string | undefined, total: number, porPagina: number) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pedida = /^\d+$/.test(param ?? "") ? Number(param) : 1;
  const pagina = Math.min(Math.max(pedida, 1), paginas);
  const de = (pagina - 1) * porPagina;
  return { pagina, paginas, de, ate: de + porPagina - 1 };
}
