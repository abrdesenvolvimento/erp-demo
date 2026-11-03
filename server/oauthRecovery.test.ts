import { describe, expect, it } from "vitest";
import { renderOAuthRecoveryPage } from "./oauthRecovery";

describe("página de recuperação OAuth", () => {
  it("é pura, sem argumentos e com conteúdo determinístico", () => {
    expect(renderOAuthRecoveryPage).toHaveLength(0);
    expect(renderOAuthRecoveryPage()).toBe(renderOAuthRecoveryPage());
  });

  it("oferece uma única âncora real para o início, sem reutilizar o callback", () => {
    const html = renderOAuthRecoveryPage();
    expect(html).toContain('<a href="/">Voltar e tentar novamente</a>');
    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).not.toContain("/api/oauth/callback");
    expect(html).not.toMatch(/<script\b|<form\b|http-equiv\s*=\s*["']refresh|\bon\w+\s*=|javascript:|location\.|setTimeout/i);
  });

  it("orienta a reiniciar no mesmo navegador sem atribuir a falha ao provedor", () => {
    const html = renderOAuthRecoveryPage();
    expect(html).toContain("Não foi possível validar o login");
    expect(html).toContain("Evite alternar entre app e navegador");
    expect(html).toContain("solicite um novo login");
    expect(html).toContain("no mesmo navegador");
    expect(html).not.toMatch(/provedor|nonce|cookie|state|code=/i);
  });

  it("preserva a marca original, layout móvel e navegação acessível sem recursos externos", () => {
    const html = renderOAuthRecoveryPage();
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain('<meta name="viewport" content="width=device-width,initial-scale=1">');
    expect(html).toContain('<meta name="referrer" content="no-referrer">');
    expect(html).toContain("#114352");
    expect(html).toContain("#2f6d44");
    expect(html).toContain("max-width:520px");
    expect(html).toContain("a:focus-visible");
    expect(html).toContain('aria-labelledby="recovery-title"');
    expect(html).not.toMatch(/https?:\/\/|<iframe\b|<link\b|\bsrc=/i);
  });
});
