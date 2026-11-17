import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { autorizado } from "@/lib/acesso";

// Renova a sessão do Supabase a cada pedido e redireciona para /entrar quem não tem.
// O Basic Auth (ADMIN_USER/ADMIN_PASSWORD) continua como alternativa até a Tarefa 7.
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) resposta.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const { pathname, search } = request.nextUrl;

  if (data) {
    if (pathname === "/entrar") return NextResponse.redirect(new URL("/", request.url));
    return resposta;
  }

  if (pathname === "/entrar") return resposta;

  const usuario = process.env.ADMIN_USER;
  const senha = process.env.ADMIN_PASSWORD;
  if (usuario && senha) {
    if (autorizado(request.headers.get("authorization"), usuario, senha)) return resposta;
    return new NextResponse("Acesso restrito.", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="CRM de eventos", charset="UTF-8"' },
    });
  }

  return NextResponse.redirect(new URL(`/entrar?proximo=${encodeURIComponent(pathname + search)}`, request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
