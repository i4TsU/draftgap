import { invoke, isTauri } from "@tauri-apps/api/core";

const LOLALYTICS_REQUEST_TIMEOUT_MS = 30_000;

export async function fetchLolalyticsPageText(
    url: string,
    signal?: AbortSignal,
) {
    if (isTauri()) {
        return await withAbort(
            Promise.race([
                invoke<string>("fetch_lolalytics_page", { url }),
                timeout(LOLALYTICS_REQUEST_TIMEOUT_MS, url),
            ]),
            signal,
        );
    }

    const controller = new AbortController();
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) controller.abort(signal.reason);
    const timer = setTimeout(
        () => controller.abort(),
        LOLALYTICS_REQUEST_TIMEOUT_MS,
    );
    let response: Response;
    try {
        response = await fetch(url, { signal: controller.signal });
    } catch (error) {
        if (signal?.aborted) {
            throw signal.reason ?? error;
        }
        if (controller.signal.aborted) {
            throw new Error(
                `Lolalytics request timed out after ${LOLALYTICS_REQUEST_TIMEOUT_MS / 1000}s`,
            );
        }
        throw error;
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
    }
    if (!response.ok) {
        throw new Error(`Lolalytics returned ${response.status} for ${url}`);
    }

    return await response.text();
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return promise;
    if (signal.aborted) {
        return Promise.reject(
            signal.reason ?? new DOMException("Aborted", "AbortError"),
        );
    }
    return new Promise<T>((resolve, reject) => {
        const onAbort = () =>
            reject(
                signal.reason ?? new DOMException("Aborted", "AbortError"),
            );
        signal.addEventListener("abort", onAbort, { once: true });
        promise.then(resolve, reject).finally(() => {
            signal.removeEventListener("abort", onAbort);
        });
    });
}

function timeout(ms: number, url: string): Promise<never> {
    return new Promise((_, reject) =>
        setTimeout(
            () =>
                reject(
                    new Error(
                        `Lolalytics request timed out after ${ms / 1000}s: ${url}`,
                    ),
                ),
            ms,
        ),
    );
}
