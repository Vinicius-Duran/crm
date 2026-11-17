const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

// Sem 0/O/1/l/I: caracteres fáceis de confundir ao digitar uma senha temporária à mão.
export function gerarSenhaTemporaria(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}
