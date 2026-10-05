// Confere o cabeçalho Authorization de uma requisição com HTTP Basic Auth.
export function autorizado(cabecalho: string | null, usuario: string, senha: string): boolean {
  if (!cabecalho?.startsWith("Basic ")) return false;
  let credenciais: string;
  try {
    const bytes = Uint8Array.from(atob(cabecalho.slice(6)), (c) => c.charCodeAt(0));
    credenciais = new TextDecoder().decode(bytes);
  } catch {
    return false;
  }
  return iguais(credenciais, `${usuario}:${senha}`);
}

// Comparação em tempo constante, para o tempo de resposta não revelar a senha.
function iguais(a: string, b: string): boolean {
  let diferenca = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diferenca |= (a.charCodeAt(i) || 0) ^ b.charCodeAt(i);
  return diferenca === 0;
}
