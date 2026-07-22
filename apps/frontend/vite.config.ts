import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

const LOLALYTICS_PROXY_PATH = "/api/lolalytics";
const lolalyticsProxy = {
    [LOLALYTICS_PROXY_PATH]: {
        target: "https://lolalytics.com",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/lolalytics/, ""),
    },
};

export default defineConfig({
    plugins: [solidPlugin()],
    define: {
        APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    server: {
        port: 3000,
        watch: {
            ignored: ["**/src-tauri/target/**"],
        },
        proxy: lolalyticsProxy,
    },
    preview: {
        proxy: lolalyticsProxy,
    },
    build: {
        target: "esnext",
    },
});
