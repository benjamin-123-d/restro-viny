import "dotenv/config";

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { SignJWT } from "jose";

import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Screenshot a dashboard page as the real owner, in headless Chrome or Edge,
 * cut into viewport-high slices so tall pages stay legible.
 *
 *   npx tsx scripts/screenshot-page.ts /dashboard/sales out-dir [--dark] [--width=1440]
 */

const [route = "/dashboard", outDir = "screenshots"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dark = process.argv.includes("--dark");
const width = Number(process.argv.find((a) => a.startsWith("--width="))?.slice(8) ?? 1440);
const SLICE = 1000;
const BASE = process.env.SCREENSHOT_BASE ?? "http://localhost:3000";
const PORT = 9333;

const BROWSERS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
  });
  const restaurant = await prisma.restaurant.findFirst({ select: { ownerId: true } });
  await prisma.$disconnect();
  if (!restaurant) throw new Error("Aucun restaurant.");

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(restaurant.ownerId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET ?? ""));

  const browser = spawn(
    BROWSERS[0],
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${join(tmpdir(), `restro-shot-${Date.now()}`)}`,
      "--no-first-run",
      "--hide-scrollbars",
      `--window-size=${width},${SLICE}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    // A fresh tab: headless builds list their initial targets as "other".
    let target: { webSocketDebuggerUrl: string } | null = null;
    for (let i = 0; i < 40 && !target; i += 1) {
      await sleep(250);
      target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })
        .then((r) => (r.ok ? (r.json() as Promise<{ webSocketDebuggerUrl: string }>) : null))
        .catch(() => null);
    }
    if (!target) throw new Error("Navigateur injoignable.");

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let id = 0;
    const pending = new Map<number, (value: Record<string, unknown>) => void>();
    const listeners: ((method: string) => void)[] = [];
    ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as {
        id?: number;
        method?: string;
        result?: Record<string, unknown>;
        error?: { message: string };
      };
      if (msg.id !== undefined) {
        if (msg.error) console.error(msg.error.message);
        pending.get(msg.id)?.(msg.result ?? {});
      } else if (msg.method) {
        listeners.forEach((l) => l(msg.method as string));
        const params = (msg as { params?: Record<string, unknown> }).params ?? {};
        if (msg.method === "Runtime.exceptionThrown") {
          console.error("EXCEPTION", JSON.stringify(params).slice(0, 600));
        }
        if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(String(params.type))) {
          const args = (params.args as { value?: unknown; description?: string }[] | undefined) ?? [];
          console.error(`CONSOLE ${params.type}:`, args.map((a) => a.value ?? a.description).join(" ").slice(0, 600));
        }
      }
    };
    const send = (method: string, params: Record<string, unknown> = {}) =>
      new Promise<Record<string, unknown>>((resolve) => {
        id += 1;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });

    await send("Page.enable");
    await send("Runtime.enable");
    // A tab in the background gets no animation frames, so charts never draw.
    await send("Page.bringToFront");
    await send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await send("Network.enable");
    await send("Network.setCookie", { name: "restro_session", value: token, url: BASE });
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: SLICE,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });

    const loaded = new Promise<void>((resolve) =>
      listeners.push((m) => m === "Page.loadEventFired" && resolve()),
    );
    await send("Page.navigate", { url: `${BASE}${route}` });
    await loaded;
    if (dark) {
      await send("Runtime.evaluate", { expression: "document.documentElement.classList.add('dark')" });
    }
    await sleep(3500);

    const { result } = (await send("Runtime.evaluate", {
      expression: "Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)",
      returnByValue: true,
    })) as { result: { value: number } };
    const height = result.value;

    mkdirSync(outDir, { recursive: true });
    const slices = Math.ceil(height / SLICE);
    for (let s = 0; s < slices; s += 1) {
      const shot = (await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: { x: 0, y: s * SLICE, width, height: Math.min(SLICE, height - s * SLICE), scale: 1 },
      })) as { data: string };
      const file = join(outDir, `shot-${String(s + 1).padStart(2, "0")}.png`);
      writeFileSync(file, Buffer.from(shot.data, "base64"));
      console.log(file);
    }
    ws.close();
  } finally {
    browser.kill();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
