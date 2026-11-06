/**
 * Compatibilite runtime (hook `instrumentation` de Next.js).
 *
 * Le correctif d'en-tetes depend de `node:http` : il est isole dans
 * `instrumentation-node.ts` et charge dynamiquement uniquement pour le runtime
 * Node.js, afin de ne jamais etre embarque dans le bundle Edge.
 *
 * Voir `instrumentation-node.ts` pour le detail du probleme corrige
 * (`request.headers` sans prototype sur les versions experimentales de Node).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { installHeadersCompat } = await import("./instrumentation-node");
  await installHeadersCompat();
}
