import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./index.js";

test("production server serves the game and API without exposing secrets", async (t) => {
    const app = createApp({ GEMINI_API_KEY: "test-private-key" });
    await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => { app.close(resolve); app.closeAllConnections(); }));
    const base = `http://127.0.0.1:${app.address().port}`;
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /The Odyssey/);
    const health = await fetch(`${base}/healthz`);
    assert.equal(await health.text(), "ok");
    const status = await fetch(`${base}/api/status`);
    assert.deepEqual(await status.json(), { gemini: true, elevenlabs: false });
    for (const name of [".env", "server/ai.js", "package.json", "%2e%2e%5c.env", "missing.wav"]) {
        assert.equal((await fetch(`${base}/${name}`)).status, 404, name);
    }
    const icon = await fetch(`${base}/favicon.ico?v=2`);
    assert.equal(icon.status, 200);
    assert.equal(icon.headers.get("content-type"), "image/x-icon");
    const range = await fetch(`${base}/assets/cyclops.wav`, { headers: { Range: "bytes=0-15" } });
    assert.equal(range.status, 206);
    assert.equal((await range.arrayBuffer()).byteLength, 16);
    assert.equal((await fetch(`${base}/assets/cyclops.wav`, { headers: { Range: "bytes=20-10" } })).status, 416);
    const blocked = await fetch(`${base}/api/speak`, { method: "POST", headers: { Origin: "https://another-site.example" } });
    assert.equal(blocked.status, 403);
    const invalid = await fetch(`${base}/api/speak`, { method: "POST", body: "not json" });
    assert.equal(invalid.status, 400);
});
