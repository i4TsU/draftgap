import { invoke, isTauri } from "@tauri-apps/api/core";

export async function fetchLolalyticsPageText(url: string) {
    if (isTauri()) {
        return await invoke<string>("fetch_lolalytics_page", { url });
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Lolalytics returned ${response.status} for ${url}`);
    }

    return await response.text();
}
