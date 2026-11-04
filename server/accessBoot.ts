import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccessPendingCard, AnniversaryAccess } from "../client/src/components/AnniversaryAccess";

const START_MARKER = "<!-- abrwf-access-start -->";
const END_MARKER = "<!-- abrwf-access-end -->";
const CLOCK_MARKER = 'data-abrwf-server-now="__ABRWF_SERVER_NOW__"';

/** Anonymous, inert first paint only: no app, session, company or login URL is rendered. */
function accessBootCard() {
  return createElement(
    "div",
    { id: "abrwf-boot", "aria-live": "polite" },
    createElement(AccessPendingCard, { boot: true }),
    createElement(
      "button",
      {
        id: "abrwf-boot-retry",
        type: "button",
        hidden: true,
        style: {
          marginTop: 24,
          width: "100%",
          padding: "12px 18px",
          border: 0,
          borderRadius: 11,
          background: "#154c44",
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
        },
      },
      "Recarregar a página"
    ),
    createElement("noscript", null, "Ative o JavaScript no navegador para acessar o ABRWF.")
  );
}

/** Render the public access frame with request time, retaining the pre-React recovery guard. */
export function injectAccessBoot(template: string, now = Date.now()): string {
  const start = template.indexOf(START_MARKER);
  const end = template.indexOf(END_MARKER);
  if (
    start < 0 ||
    end <= start ||
    template.indexOf(START_MARKER, start + START_MARKER.length) >= 0 ||
    template.indexOf(END_MARKER, end + END_MARKER.length) >= 0 ||
    template.split(CLOCK_MARKER).length !== 2
  ) {
    throw new Error("ABRWF access boot template markers are missing or invalid");
  }
  if (!Number.isSafeInteger(now) || !Number.isFinite(new Date(now).getTime())) {
    throw new Error("ABRWF access boot requires a valid server timestamp");
  }

  const markup = renderToStaticMarkup(
    createElement(AnniversaryAccess, { serverNow: now, children: accessBootCard() })
  );
  return (
    template.slice(0, start + START_MARKER.length) +
    markup +
    template.slice(end)
  ).replace(CLOCK_MARKER, `data-abrwf-server-now="${now}"`);
}
