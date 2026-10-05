import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const CONSULTA = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function assinar(avisar: () => void) {
  const mql = window.matchMedia(CONSULTA);
  mql.addEventListener("change", avisar);
  return () => mql.removeEventListener("change", avisar);
}

// Lê a largura direto do navegador, sem setState em efeito (regra react-hooks/set-state-in-effect).
export function useIsMobile() {
  return React.useSyncExternalStore(
    assinar,
    () => window.matchMedia(CONSULTA).matches,
    () => false,
  );
}
