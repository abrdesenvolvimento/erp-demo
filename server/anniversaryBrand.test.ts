import { describe, expect, it } from "vitest";
import { ANNIVERSARY_BRAND } from "../shared/anniversaryBrand";
import { renderOAuthSuccessPage } from "./anniversaryBrand";

describe("renderOAuthSuccessPage", () => {
  it("renders the approved logo lockup and badge/headline copy", () => {
    const html = renderOAuthSuccessPage(true);

    expect(html).toContain('src="/logo-abrwf.png"');
    expect(html).toContain('background:linear-gradient(135deg,#114352,#2f6d44)');
    expect(html).toContain('background:linear-gradient(135deg,#fbfaf2,#eff3e4)');
    expect(html).toContain('border-radius:24px');
    expect(html).toContain('mix-blend-mode:multiply');
    expect(html).toContain('color:#d59e15');
    expect(html).toContain('color:#2f6d44');
    expect(html).toContain('<div class="anniversary-seal">');
    expect(html).toContain('aria-label="1 ANO"');
    expect(html).toContain('>1</span><span class="anniversary-word">ANO</span>');
    expect(html).toContain(ANNIVERSARY_BRAND.headline);
    expect(html).not.toContain("eyebrow");
    expect(html).not.toContain("supporting");
    expect(html).not.toContain("period");
    expect(html).not.toContain("nov2025");
    expect(html).not.toContain("nov2026");
    expect(html).toContain('meta http-equiv="refresh" content="2;url=/"');
    expect(html).toContain("setTimeout(function(){location.replace('/')},1200)");
  });

  it("escapes supplied anniversary copy before inserting it into HTML", () => {
    const html = renderOAuthSuccessPage(true, {
      badge: '<img src=x onerror="bad">',
      headline: "<b>headline</b>",
    });

    expect(html).toContain('aria-label="&lt;img src=x onerror=&quot;bad&quot;&gt;"');
    expect(html).toContain("&lt;b&gt;headline&lt;/b&gt;");
    expect(html).not.toContain('<img src=x onerror="bad">');
    expect(html).not.toContain("<b>headline</b>");
  });

  it("renders the normal welcome without anniversary copy or the one-year mark", () => {
    const html = renderOAuthSuccessPage(false);

    expect(html).toContain("Bem-vindo ao ABRWF");
    expect(html).toContain('src="/logo-abrwf.png"');
    expect(html).not.toContain('<div class="anniversary-seal">');
    expect(html).not.toContain('<div class="anniversary-mark"');
    expect(html).not.toContain(ANNIVERSARY_BRAND.headline);
    expect(html).not.toContain("nov2025");
    expect(html).not.toContain("nov2026");
  });
});
