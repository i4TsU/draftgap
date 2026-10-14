import { within } from "./owned-process";

export async function waitReady<T>(
  ready: Promise<T>,
  signal: AbortSignal,
  timeoutMs: number,
  message: string,
) {
  if (signal.aborted) throw signal.reason;
  const interrupted = () => rejectAbort(signal.reason);
  let rejectAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  signal.addEventListener("abort", interrupted, { once: true });
  try {
    return await within(Promise.race([ready, aborted]), timeoutMs, message);
  } finally {
    signal.removeEventListener("abort", interrupted);
  }
}
