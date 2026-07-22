import { invoke, isTauri } from "@tauri-apps/api/core";

const LOLALYTICS_ORIGIN = "https://lolalytics.com";
const DEFAULT_LOLALYTICS_PROXY_BASE_URL = "/api/lolalytics";
const lolalyticsProxyBaseUrl =
    import.meta.env?.VITE_LOLALYTICS_PROXY_BASE_URL ??
    DEFAULT_LOLALYTICS_PROXY_BASE_URL;

type Fetcher = (
    input: RequestInfo | URL,
    init?: RequestInit,
) => Promise<Response>;

export function lolalyticsProxyUrlForPage(
    pageUrl: string,
    proxyBaseUrl = lolalyticsProxyBaseUrl,
) {
    const parsed = parseLolalyticsPageUrl(pageUrl);
    const normalizedProxyBaseUrl = normalizeProxyBaseUrl(proxyBaseUrl);

    return `${normalizedProxyBaseUrl}${parsed.pathname}${parsed.search}`;
}

export async function fetchLolalyticsPageText(
    url: string,
    fetcher: Fetcher = fetch,
) {
    if (isTauri()) {
        return await invoke<string>("fetch_lolalytics_page", { url });
    }

    const proxyUrl = lolalyticsProxyUrlForPage(url);
    const response = await fetcher(proxyUrl);
    if (!response.ok) {
        throw new Error(
            `Lolalytics proxy returned ${response.status} for ${url}`,
        );
    }

    return await response.text();
}

function parseLolalyticsPageUrl(url: string) {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error(`Invalid Lolalytics page URL: ${url}`);
    }

    if (
        parsed.origin !== LOLALYTICS_ORIGIN ||
        !parsed.pathname.startsWith("/lol/")
    ) {
        throw new Error(
            `Only ${LOLALYTICS_ORIGIN}/lol/... pages can be fetched: ${url}`,
        );
    }

    return parsed;
}

function normalizeProxyBaseUrl(proxyBaseUrl: string) {
    const trimmed = proxyBaseUrl.trim();
    const base = trimmed || DEFAULT_LOLALYTICS_PROXY_BASE_URL;

    return base.endsWith("/") ? base.slice(0, -1) : base;
}
