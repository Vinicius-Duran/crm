export function normalizarDocumento(valor: string): string {
  return valor.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

// O banco guarda só dígitos/letras; na tela, CPF volta a ter pontos e traço.
export function formatarDocumento(documento: string): string {
  return /^\d{11}$/.test(documento) ? documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : documento;
}

export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = (base: string) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(cpf.slice(0, 9)) === Number(cpf[9]) && digito(cpf.slice(0, 10)) === Number(cpf[10]);
}

export type ResultadoDocumento = { ok: true; documento: string } | { ok: false; erro: string };

// 11 dígitos = CPF e confere os verificadores; qualquer outra coisa (passaporte) passa como veio.
export function validarDocumento(valor: string): ResultadoDocumento {
  const documento = normalizarDocumento(valor);
  if (!documento) return { ok: false, erro: "Documento obrigatório" };
  if (/^\d{11}$/.test(documento) && !cpfValido(documento)) return { ok: false, erro: "CPF inválido" };
  return { ok: true, documento };
}
