import { defineConfig, loadEnv } from "vite";
import { createAiMiddleware } from "./server/ai.js";

const kaplayCongrats = () => {
    return {
        name: "vite-plugin-kaplay-hello",
        buildEnd() {
            const line =
                "---------------------------------------------------------";
            const msg = `🦖 Awesome pal! Send your game to us:\n\n💎 Discord: https://discord.com/invite/aQ6RuQm3TF \n💖 Donate to KAPLAY: https://opencollective.com/kaplay\n\ (you can disable this msg on vite.config)`;

            process.stdout.write(`\n${line}\n${msg}\n${line}\n`);
        },
    };
};

// Serves /api/turn, /api/speak and /api/narrate from the dev and preview servers,
// so the Gemini and ElevenLabs keys in .env are used here and never sent to the browser.
const aiEndpoints = (/** @type {Record<string, string>} */ env) => {
    const middleware = createAiMiddleware(env);
    return {
        name: "odyssey-ai-endpoints",
        configureServer(/** @type {import("vite").ViteDevServer} */ server) {
            server.middlewares.use(middleware);
        },
        configurePreviewServer(/** @type {import("vite").PreviewServer} */ server) {
            server.middlewares.use(middleware);
        },
    };
};

export default defineConfig(({ mode }) => ({
    // index.html out file will start with a relative path for script
    base: "./",
    server: {
        port: 3001,
    },
    build: {
        // disable this for low bundle sizes
        sourcemap: true,
        rollupOptions: {
            output: {
                // keep the engine in its own chunk, separate from game code
                manualChunks(id) {
                    if (id.includes("node_modules/kaplay")) return "kaplay";
                },
            },
        },
    },
    plugins: [
        // Disable messages removing this line
        kaplayCongrats(),
        // "" = read every variable in .env, not only the VITE_ ones (these stay on the server)
        aiEndpoints(loadEnv(mode, process.cwd(), "")),
    ],
}));