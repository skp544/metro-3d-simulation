// Dev tool: real-time headless Chrome screenshot of the app, for checking the 3D view (WebGL needs
// real animation frames, which plain --screenshot doesn't give on macOS). Not part of the app or tests.
// Usage: npm run build && npx vite preview --port 4173   then
//   node scripts/screenshot.mjs "http://localhost:4173/?view=3d" out.png [width] [height] [waitMs]
// EVAL='js' runs in the page before the shot (e.g. click a row); WHEEL=n scrolls n notches in at the centre.

import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

const [url, out, w = "1440", h = "900", wait = "6000"] = process.argv.slice(2);
const port = 9333;
const binary =
  process.env.CHROME_PATH ??
  (process.platform === "win32"
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "google-chrome");
const chrome = spawn(
  binary,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--hide-scrollbars",
    "--no-first-run",
    `--window-size=${w},${h}`,
    `--user-data-dir=${join(tmpdir(), `cdp-shot-profile-${Date.now()}`)}`,
    "about:blank",
  ],
  { stdio: "ignore", windowsHide: true },
);

try {
  let target;
  for (let i = 0; i < 40 && !target; i++) {
    await sleep(250);
    try {
      target = (
        await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      ).find((t) => t.type === "page");
    } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) pending.get(m.id)(m.result ?? m.error);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type !== "warning")
      console.log(
        "console." + m.params.type,
        m.params.args
          .map((a) => a.value ?? a.description)
          .join(" ")
          .slice(0, 400),
      );
    if (m.method === "Runtime.exceptionThrown")
      console.log(
        "EXCEPTION",
        (
          m.params.exceptionDetails.exception?.description ??
          m.params.exceptionDetails.text
        ).slice(0, 600),
      );
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      pending.set(++id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: +w,
    height: +h,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url });
  await sleep(+wait);
  if (process.env.EVAL) {
    console.log(
      "eval",
      JSON.stringify(
        await send("Runtime.evaluate", {
          expression: process.env.EVAL,
          awaitPromise: true,
          returnByValue: true,
        }),
      ).slice(0, 400),
    );
    await sleep(3000);
  }
  for (let i = 0; i < +(process.env.WHEEL ?? 0); i++) {
    await send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: +w / 2,
      y: +h / 2,
      deltaX: 0,
      deltaY: -300,
    });
    await sleep(150);
  }
  if (process.env.WHEEL) await sleep(2500);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(out, Buffer.from(data, "base64"));
  console.log("saved", out);
  ws.close();
} finally {
  chrome.kill();
}
