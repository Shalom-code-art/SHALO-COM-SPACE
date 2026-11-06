/**
 * Compatibilite runtime, partie reservee au runtime Node.js.
 *
 * Ce module est importe dynamiquement par `instrumentation.ts` uniquement
 * lorsque `NEXT_RUNTIME === "nodejs"`, afin de ne jamais embarquer `node:http`
 * dans le bundle Edge.
 *
 * Certaines versions experimentales de Node.js (>= 27 alpha) exposent
 * `request.headers` sous forme d'objet sans prototype. Le framework appelle
 * `headers.hasOwnProperty(...)` en interne et echoue alors sur **toutes** les
 * routes (HTTP 500). Node 22/24 LTS renvoie un objet standard : ce correctif
 * n'a donc aucun effet sur les versions supportees.
 */
export async function installHeadersCompat(): Promise<void> {
  const http = await import("node:http");
  const prototype = http.IncomingMessage.prototype as unknown as {
    _addHeaderLines?: (...args: unknown[]) => unknown;
    __shaloHeadersCompat?: boolean;
  };

  if (prototype.__shaloHeadersCompat || typeof prototype._addHeaderLines !== "function") return;

  // Le patch est idempotent et se contente de rendre son prototype standard a
  // l'objet d'en-tetes deja construit, sans modifier les valeurs recues.
  const original = prototype._addHeaderLines;
  prototype._addHeaderLines = function patched(this: { headers?: unknown }, ...args: unknown[]) {
    const result = original.apply(this, args);
    try {
      const headers = this.headers;
      if (headers && typeof headers === "object" && Object.getPrototypeOf(headers) === null) {
        Object.setPrototypeOf(headers, Object.prototype);
      }
    } catch {
      // Jamais bloquant : au pire le runtime d'origine s'applique.
    }
    return result;
  };
  prototype.__shaloHeadersCompat = true;
}
