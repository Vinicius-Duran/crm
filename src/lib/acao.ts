import { z } from "zod";

// Estado devolvido pelas Server Actions de formulário (useActionState).
// `valores` volta o que foi digitado: o React 19 limpa o form depois da action, e o
// defaultValue lido daqui é o que repõe os campos quando há erro.
export type EstadoAcao = {
  ok: boolean;
  mensagem: string;
  erros?: Record<string, string[] | undefined>;
  valores?: Record<string, string>;
};

export const estadoInicial: EstadoAcao = { ok: true, mensagem: "" };

export function valoresDo(form: FormData): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [chave, valor] of form.entries()) if (typeof valor === "string") valores[chave] = valor;
  return valores;
}

export function errosDoZod(erro: z.ZodError, valores: Record<string, string>): EstadoAcao {
  return {
    ok: false,
    mensagem: "Corrija os campos destacados",
    erros: z.flattenError(erro).fieldErrors as Record<string, string[] | undefined>,
    valores,
  };
}
