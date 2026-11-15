import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAiMiddleware } from "./ai.js";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const types = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json",
    ".ico": "image/x-icon", ".png": "image/png", ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp",
    ".wav": "audio/wav", ".mp3": "audio/mpeg", ".mp4": "video/mp4",
    ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
};

/** Serves only built public files; source files and credentials stay private. */
export function createApp(env = process.env) {
    const ai = createAiMiddleware(env);
    return createServer(async (req, res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        try {
            const url = new URL(req.url, "http://localhost");
            if (url.pathname === "/healthz") {
                res.writeHead(200, { "Content-Type": "text/plain" });
                return res.end("ok");
            }
            if (url.pathname.startsWith("/api/")) {
                // Browser calls must come from this site, not another website.
                const origin = req.headers.origin;
                if (origin && new URL(origin).host !== req.headers.host) {
                    res.writeHead(403);
                    return res.end("Forbidden");
                }
                return await ai(req, res, () => { res.writeHead(404); res.end(); });
            }
            if (req.method !== "GET" && req.method !== "HEAD") {
                res.writeHead(405, { Allow: "GET, HEAD" });
                return res.end();
            }
            const pathname = decodeURIComponent(url.pathname);
            const filename = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
            const relative = path.relative(root, filename);
            if (relative.startsWith("..") || path.isAbsolute(relative) || relative.split(/[\\/]/).some((part) => part.startsWith("."))) {
                res.writeHead(404);
                return res.end("Not found");
            }
            const info = await stat(filename);
            if (!info.isFile()) { res.writeHead(404); return res.end("Not found"); }
            res.setHeader("Content-Type", types[path.extname(filename).toLowerCase()] ?? "application/octet-stream");
            res.setHeader("Cache-Control", filename.endsWith(".html") ? "no-cache" : "public, max-age=3600");
            res.setHeader("Accept-Ranges", "bytes");
            let start = 0;
            let end = info.size - 1;
            if (req.headers.range) {
                const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
                if (range && (range[1] || range[2])) {
                    start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
                    end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end;
                }
                if (!range || (!range[1] && !range[2]) || start > end || start >= info.size) {
                    res.writeHead(416, { "Content-Range": `bytes */${info.size}` });
                    return res.end();
                }
                res.statusCode = 206;
                res.setHeader("Content-Range", `bytes ${start}-${end}/${info.size}`);
            }
            res.setHeader("Content-Length", end - start + 1);
            if (req.method === "HEAD") return res.end();
            const stream = createReadStream(filename, { start, end });
            stream.on("error", () => res.destroy());
            res.on("close", () => stream.destroy());
            stream.pipe(res);
        } catch (error) {
            res.writeHead(error?.code === "ENOENT" || error?.code === "ENOTDIR" ? 404 : 400);
            res.end("Request could not be served");
        }
    });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const port = Number(process.env.PORT || 3001);
    const app = createApp();
    app.listen(port, "0.0.0.0", () => console.log(`Odyssey listening on port ${port}`));
    process.on("SIGTERM", () => app.close(() => process.exit(0)));
}
