import { randomBytes } from "node:crypto";

// 128 bits aleatórios, 22 caracteres base64url. É o que vai no QR.
export function gerarCodigo(): string {
  return randomBytes(16).toString("base64url");
}
