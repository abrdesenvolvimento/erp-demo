import express, { type Express, type RequestHandler } from "express";
import fs from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessPendingCard, AnniversaryAccess } from "../client/src/components/AnniversaryAccess";
import { ANNIVERSARY_BRAND } from "../shared/anniversaryBrand";
import { injectAccessBoot } from "./accessBoot";

vi.mock("vite", () => ({ createServer: vi.fn() }));
vi.mock("../vite.config", () => ({ default: {} }));

const template = fs.readFileSync(path.resolve(import.meta.dirname, "../client/index.html"), "utf8");
const startMarker = "<!-- abrwf-access-start -->";
const endMarker = "<!-- abrwf-access-end -->";
function accessMarkup(html: string) {
  return html.slice(html.indexOf(startMarker) + startMarker.length, html.indexOf(endMarker));
}
function expectAnonymousCard(html: string) {
  expect(html).toContain("Acesse o ABRWF");
  expect(html).toContain("Faça login para continuar");
  expect(html).toMatch(/<button\b[^>]*id="abrwf-boot-enter"[^>]*\bdisabled(?:="")?[^>]*>Entrar(?:<svg[\s\S]*?<\/svg>)?<\/button>/);
  expect(html).toMatch(/<button\b[^>]*id="abrwf-boot-retry"[^>]*\bhidden(?:="")?[^>]*>/);
  const access = accessMarkup(html);
  expect(access).toContain('src="/logo-abrwf.png"');
  expect(access).not.toMatch(/\b(?:nonce|pin|userId|companyId|sessionRef|accessToken|csrf)\b|type="password"|<form\b|<a\b|oauth|Carregando|Aguarde/i);
  // React 19 may prepend the existing logo's image preload; no login URLs are allowed.
  expect([...access.matchAll(/href="([^"]*)"/g)].map(match => match[1])).toEqual(["/logo-abrwf.png"]);
  expect(access).not.toContain('class="operator-access-company"');
  for (const id of ["abrwf-boot", "abrwf-boot-title", "abrwf-boot-copy", "abrwf-boot-enter", "abrwf-boot-retry"]) {
    expect(access.split(`id="${id}"`)).toHaveLength(2);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("injectAccessBoot", () => {
  it.each([
    ["último instante de outubro em São Paulo", "2026-11-01T02:59:59.999Z", false],
    ["início de novembro em São Paulo", "2026-11-01T03:00:00.000Z", true],
    ["durante novembro", "2026-11-03T15:00:00.000Z", true],
    ["último instante de novembro em São Paulo", "2026-12-01T02:59:59.999Z", true],
    ["início de dezembro em São Paulo", "2026-12-01T03:00:00.000Z", false],
    ["novembro fora de 2026", "2027-11-03T15:00:00.000Z", false],
  ])("entrega branding correto no primeiro HTML: %s", (_name, iso, campaign) => {
    const now = Date.parse(iso);
    const html = injectAccessBoot(template, now);
    const access = accessMarkup(html);
    expect(html).toContain(`data-abrwf-server-now="${now}"`);
    expect(html).not.toContain("__ABRWF_SERVER_NOW__");
    expect(access.includes(ANNIVERSARY_BRAND.headline)).toBe(campaign);
    expect(access.includes('class="operator-access-signature"')).toBe(campaign);
    expect(access.includes("Rotina organizada.")).toBe(!campaign);
    expectAnonymousCard(html);
  });

  it("renderiza exatamente o cartão compartilhado, sem renderizar App nem estado autenticado", () => {
    const now = Date.parse("2026-11-03T15:00:00Z");
    const html = injectAccessBoot(template, now);
    const pendingCard = renderToStaticMarkup(createElement(AccessPendingCard, { boot: true }));
    expect(accessMarkup(html)).toContain(pendingCard);
    const frame = renderToStaticMarkup(createElement(AnniversaryAccess, {
      serverNow: now,
      children: createElement("div", { id: "abrwf-boot", "aria-live": "polite" }),
    }));
    expect(accessMarkup(html).split('<div id="abrwf-boot"')[0]).toBe(frame.split('<div id="abrwf-boot"')[0]);
  });

  it("usa Date.now por requisição sem prender a campanha ao relógio anterior", () => {
    const november = Date.parse("2026-12-01T02:59:59.999Z");
    const december = Date.parse("2026-12-01T03:00:00.000Z");
    const clock = vi.spyOn(Date, "now").mockReturnValue(november);
    expect(accessMarkup(injectAccessBoot(template))).toContain(ANNIVERSARY_BRAND.headline);
    clock.mockReturnValue(december);
    expect(accessMarkup(injectAccessBoot(template))).not.toContain(ANNIVERSARY_BRAND.headline);
  });

  it("mantém head, módulo, service worker e guard fora do bloco substituído", () => {
    const now = Date.parse("2026-11-03T15:00:00Z");
    const html = injectAccessBoot(template, now);
    expect(html.slice(0, html.indexOf(startMarker))).toBe(
      template.slice(0, template.indexOf(startMarker)).replace("__ABRWF_SERVER_NOW__", String(now))
    );
    expect(html.slice(html.indexOf(endMarker))).toBe(template.slice(template.indexOf(endMarker)));
  });

  it.each([
    template.replace(startMarker, ""),
    template.replace(endMarker, ""),
    template.replace("__ABRWF_SERVER_NOW__", "0"),
    template.replace(startMarker, startMarker + startMarker),
    template.replace(endMarker, endMarker + endMarker),
    template.replace(startMarker, "SWAP_START").replace(endMarker, startMarker).replace("SWAP_START", endMarker),
    template + 'data-abrwf-server-now="__ABRWF_SERVER_NOW__"',
  ])("falha explicitamente em um template inválido, sem devolver página branca", invalid => {
    expect(() => injectAccessBoot(invalid)).toThrow("template markers");
  });

  it.each([NaN, Infinity, -Infinity, 1.5, Number.MAX_SAFE_INTEGER])("rejeita timestamp inválido: %s", now => {
    expect(() => injectAccessBoot(template, now)).toThrow("valid server timestamp");
  });
});

async function withServer(app: Express, run: (base: string) => Promise<void>) {
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
}

function mockTemplateReads() {
  const originalRead = fs.promises.readFile.bind(fs.promises);
  return vi.spyOn(fs.promises, "readFile").mockImplementation(((file: Parameters<typeof originalRead>[0], ...args: unknown[]) => {
    if (String(file).endsWith("index.html")) return Promise.resolve(template);
    return (originalRead as any)(file, ...args);
  }) as typeof fs.promises.readFile);
}

describe("HTML por requisição no servidor", () => {
  it("dev aplica o helper depois de transformIndexHtml e entrega relógio atual em / e /index.html", async () => {
    const { createServer: createViteServer } = await import("vite");
    const { setupVite } = await import("./_core/vite");
    const transformIndexHtml = vi.fn(async (_url: string, html: string) => html.replace("</head>", '<meta name="vite-transformed" content="yes" /></head>'));
    const ssrFixStacktrace = vi.fn();
    vi.mocked(createViteServer).mockResolvedValue({
      middlewares: ((_req, _res, next) => next()) as RequestHandler,
      transformIndexHtml,
      ssrFixStacktrace,
    } as any);
    mockTemplateReads();
    const november = Date.parse("2026-12-01T02:59:59.999Z");
    const december = Date.parse("2026-12-01T03:00:00.000Z");
    const clock = vi.spyOn(Date, "now").mockReturnValue(november);
    const app = express();
    await setupVite(app, {} as Server);
    await withServer(app, async base => {
      for (const route of ["/", "/index.html"]) {
        const response = await fetch(base + route);
        const html = await response.text();
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-cache");
        expect(response.headers.get("content-type")).toContain("text/html");
        expect(html).toContain('name="vite-transformed"');
        expect(html).toContain(`data-abrwf-server-now="${november}"`);
        expect(accessMarkup(html)).toContain(ANNIVERSARY_BRAND.headline);
        expectAnonymousCard(html);
      }
      clock.mockReturnValue(december);
      const html = await (await fetch(base + "/index.html?nonce=DO_NOT_REFLECT&userId=42", {
        headers: { Cookie: "session=DO_NOT_REFLECT" },
      })).text();
      expect(html).toContain(`data-abrwf-server-now="${december}"`);
      expect(accessMarkup(html)).not.toContain(ANNIVERSARY_BRAND.headline);
      expect(html).not.toMatch(/DO_NOT_REFLECT|userId=42/);
    });
    expect(transformIndexHtml).toHaveBeenCalledTimes(3);
    expect(transformIndexHtml.mock.calls.every(([, input]) => input.includes("__ABRWF_SERVER_NOW__"))).toBe(true);
    expect(ssrFixStacktrace).not.toHaveBeenCalled();
  });

  it("produção intercepta / e /index.html antes de static, injeta catchall e mantém assets intactos", async () => {
    const { serveStatic } = await import("./_core/vite");
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    mockTemplateReads();
    const assetMiddleware = vi.fn<RequestHandler>((req, res, next) => {
      if (req.path === "/assets/app.js") res.set("Cache-Control", "public, max-age=0").type("js").send("console.log('asset unchanged');");
      else next();
    });
    const staticSpy = vi.spyOn(express, "static").mockReturnValue(assetMiddleware);
    const november = Date.parse("2026-12-01T02:59:59.999Z");
    const december = Date.parse("2026-12-01T03:00:00.000Z");
    const clock = vi.spyOn(Date, "now").mockReturnValue(november);
    const app = express();
    serveStatic(app);
    expect(staticSpy).toHaveBeenCalledWith(expect.any(String), { index: false });
    await withServer(app, async base => {
      for (const route of ["/", "/index.html"]) {
        const response = await fetch(base + route, { headers: { Cookie: "session=DO_NOT_REFLECT" } });
        const html = await response.text();
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-cache");
        expect(html).toBe(injectAccessBoot(template, november));
        expectAnonymousCard(html);
      }
      expect(assetMiddleware).not.toHaveBeenCalled();
      clock.mockReturnValue(december);
      for (const route of ["/company/dashboard", "/index.html?nonce=DO_NOT_REFLECT&userId=42"]) {
        const response = await fetch(base + route);
        const html = await response.text();
        expect(response.headers.get("cache-control")).toBe("no-cache");
        expect(html).toBe(injectAccessBoot(template, december));
        expect(html).not.toMatch(/DO_NOT_REFLECT|userId=42/);
        expect(accessMarkup(html)).not.toContain(ANNIVERSARY_BRAND.headline);
      }
      const asset = await fetch(base + "/assets/app.js");
      expect(await asset.text()).toBe("console.log('asset unchanged');");
      expect(asset.headers.get("cache-control")).toBe("public, max-age=0");
    });
  });

  it("produção encaminha erro explícito quando o template não contém os marcadores", async () => {
    const { serveStatic } = await import("./_core/vite");
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs.promises, "readFile").mockResolvedValue("<html><body></body></html>");
    vi.spyOn(express, "static").mockReturnValue((_req, _res, next) => next());
    const app = express();
    serveStatic(app);
    app.use(((error, _req, res, _next) => res.status(500).send(error.message)) as express.ErrorRequestHandler);
    await withServer(app, async base => {
      const response = await fetch(base + "/index.html");
      expect(response.status).toBe(500);
      expect(await response.text()).toContain("template markers");
    });
  });
});
