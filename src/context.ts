import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The API key for the request currently being served.
 *
 * Over stdio there is one user per process and the key can come from the
 * environment. Over HTTP one process serves every customer, so the key has to
 * come from that request's Authorization header — reading it from the
 * environment there would hand one caller another's workspace.
 *
 * Threading a token argument through all 39 tools would touch every tool file
 * for no behavioural gain; async-local storage carries it instead, which is
 * what it is for.
 */
const store = new AsyncLocalStorage<string>();

export function withApiKey<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return store.run(key, fn);
}

/** The request's key, or the environment's when running over stdio. */
export function currentApiKey(): string | undefined {
  return store.getStore() ?? process.env.SENDRAVEN_API_KEY ?? process.env.EMAILS_API_KEY;
}
