import { describe, expect, it } from "vitest";
import { ANNIVERSARY_BRAND } from "../shared/anniversaryBrand";
import { renderOAuthSuccessPage } from "./anniversaryBrand";

describe("renderOAuthSuccessPage", () => {
  it("renders the original logo lockup and shared anniversary copy", () => {
    const html = renderOAuthSuccessPage(true);

    expect(html).toContain('src="/logo-abrwf.png"');
    expect(html).toContain('aria-label="1 ANO"');
    expect(html).toContain('>1</span><span class="anniversary-word">ANO</span>');
    expect(html).toContain(ANNIVERSARY_BRAND.eyebrow);
    expect(html).toContain(ANNIVERSARY_BRAND.headline);
    expect(html).toContain(ANNIVERSARY_BRAND.supporting);
    expect(html).toContain(ANNIVERSARY_BRAND.period);
    expect(html).toContain('meta http-equiv="refresh" content="2;url=/"');
    expect(html).toContain("setTimeout(function(){location.replace('/')},1200)");
  });

  it("escapes supplied anniversary copy before inserting it into HTML", () => {
    const html = renderOAuthSuccessPage(true, {
      badge: '<img src=x onerror="bad">',
      eyebrow: "<script>bad()</script>",
      headline: "<b>headline</b>",
      supporting: "A & B",
      period: "<period>",
    });

    expect(html).toContain("&lt;script&gt;bad()&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;headline&lt;/b&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).toContain("&lt;period&gt;");
    expect(html).not.toContain('<script>bad()</script>');
    expect(html).not.toContain('<img src=x onerror="bad">');
  });

  it("renders the normal welcome without anniversary copy or the one-year mark", () => {
    const html = renderOAuthSuccessPage(false);

    expect(html).toContain("Bem-vindo ao ABRWF");
    expect(html).toContain('src="/logo-abrwf.png"');
    expect(html).not.toContain('<div class="anniversary-mark"');
    expect(html).not.toContain(ANNIVERSARY_BRAND.eyebrow);
    expect(html).not.toContain(ANNIVERSARY_BRAND.headline);
    expect(html).not.toContain(ANNIVERSARY_BRAND.supporting);
    expect(html).not.toContain(ANNIVERSARY_BRAND.period);
  });
});
