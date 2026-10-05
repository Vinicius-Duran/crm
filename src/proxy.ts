import { NextResponse, type NextRequest } from "next/server";
import { autorizado } from "@/lib/acesso";

// Todo o sistema fica atrás de usuário e senha (o navegador mostra a janela de login).
export function proxy(request: NextRequest) {
  const usuario = process.env.ADMIN_USER;
  const senha = process.env.ADMIN_PASSWORD;

  if (!usuario || !senha) {
    // Em produção, sem credenciais configuradas, o sistema fica fechado em vez de aberto.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Acesso não configurado: defina ADMIN_USER e ADMIN_PASSWORD.", {
        status: 503,
      });
    }
    return NextResponse.next();
  }

  if (autorizado(request.headers.get("authorization"), usuario, senha)) return NextResponse.next();

  return new NextResponse("Acesso restrito.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="CRM de eventos", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
