import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function arquivosTs(dir: string): string[] {
  const resultado: string[] = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) resultado.push(...arquivosTs(caminho));
    else if (/\.tsx?$/.test(nome)) resultado.push(caminho);
  }
  return resultado;
}

describe("dbServico", () => {
  it("só é importado pelos arquivos permitidos", () => {
    const permitidos = [/^src[\\/]app[\\/]admin[\\/]/, /^src[\\/]lib[\\/]usuarios\.ts$/, /^src[\\/]lib[\\/]supabase\.ts$/, /^scripts[\\/]/];
    const infratores = arquivosTs("src").filter(
      (f) => /\bdbServico\b/.test(readFileSync(f, "utf8")) && !permitidos.some((p) => p.test(f)) && !f.endsWith(".test.ts"),
    );
    expect(infratores).toEqual([]);
  });
});
