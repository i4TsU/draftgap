import { invoke, isTauri } from "@tauri-apps/api/core";

const LOLALYTICS_REQUEST_TIMEOUT_MS = 30_000;

export async function fetchLolalyticsPageText(url: string) {
    if (isTauri()) {
        return await Promise.race([
            invoke<string>("fetch_lolalytics_page", { url }),
            timeout(LOLALYTICS_REQUEST_TIMEOUT_MS, url),
        ]);
    }

    const controller = new AbortController();
    const timer = setTimeout(
        () => controller.abort(),
        LOLALYTICS_REQUEST_TIMEOUT_MS,
    );
    let response: Response;
    try {
        response = await fetch(url, { signal: controller.signal });
    } catch (error) {
        if (controller.signal.aborted) {
            throw new Error(
                `Lolalytics request timed out after ${LOLALYTICS_REQUEST_TIMEOUT_MS / 1000}s`,
            );
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
    if (!response.ok) {
        throw new Error(`Lolalytics returned ${response.status} for ${url}`);
    }

    return await response.text();
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
