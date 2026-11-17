import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Renova a sessão do Supabase a cada pedido e redireciona para /entrar quem não tem.
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

  // getUser() (não getClaims()) revalida com o servidor do Auth a cada pedido: é o que faz um
  // usuário desativado no meio da sessão perder o acesso no próximo pedido (getClaims() só decodifica
  // o JWT local, que continua "válido" até expirar sozinho, sem saber que o usuário foi banido).
  const { data } = await supabase.auth.getUser();
  const { pathname, search } = request.nextUrl;

  if (data.user) {
    if (pathname === "/entrar") return NextResponse.redirect(new URL("/", request.url));
    return resposta;
  }

  if (pathname === "/entrar") return resposta;

  return NextResponse.redirect(new URL(`/entrar?proximo=${encodeURIComponent(pathname + search)}`, request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
