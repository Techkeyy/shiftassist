import { defineEventHandler, getRequestIP, getRouterParam } from "h3";

import { allowPublicLookup, getPublicWeek, renderPublicWeekHtml } from "../../lib/publish.js";

const HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
};

/** Public, read-only rota page. The token in the path is the only credential. */
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? "unknown";
  if (!allowPublicLookup(ip)) {
    return new Response("Too many requests. Try again in a minute.", { status: 429, headers: HEADERS });
  }
  const token = getRouterParam(event, "token") ?? "";
  const week = await getPublicWeek(token);
  if (!week) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link not found</title><body style="font:16px system-ui;padding:24px"><h1>This link is not active</h1><p>The rota link may have been turned off. Ask your manager for a new one.</p></body>`,
      { status: 404, headers: HEADERS },
    );
  }
  return new Response(renderPublicWeekHtml(week), { status: 200, headers: HEADERS });
});
