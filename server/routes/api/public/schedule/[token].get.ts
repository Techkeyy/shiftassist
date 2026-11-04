import { defineEventHandler, getRequestIP, getRouterParam } from "h3";

import { allowPublicLookup, getPublicWeek } from "../../../../lib/publish.js";

const HEADERS = { "content-type": "application/json", "cache-control": "no-store" };

/** Public JSON for the same read-only rota. Names, shifts and reasons only. */
export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? "unknown";
  if (!allowPublicLookup(ip)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429, headers: HEADERS });
  }
  const week = await getPublicWeek(getRouterParam(event, "token") ?? "");
  if (!week) {
    return new Response(JSON.stringify({ error: "This link is not active" }), { status: 404, headers: HEADERS });
  }
  return new Response(JSON.stringify(week), { status: 200, headers: HEADERS });
});
