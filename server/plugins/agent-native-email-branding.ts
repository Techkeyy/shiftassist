import { defineAppConfig } from "@agent-native/core/server";

export default defineAppConfig({
  app: {
    // This name appears in transactional emails. Change it to your product name.
    name: "ShiftAssist",
    // The source template keeps a renamed app from inheriting first-party email branding.
    sourceTemplate: "chat",
    // Keep the template's authenticated entry explicit after renaming the app.
    homePath: "/board",
    // Optional: use your own absolute HTTPS logo URL in transactional emails.
    // logoUrl: "https://example.com/logo.png",
  },
  agent: {
    // Model used when the browser's model picker sends none (a brand-new account). Without this
    // a fresh sign-up falls through to the engine default (gpt-6-luna), which the DeepSeek
    // endpoint rejects. AGENT_MODEL in the host environment overrides it.
    model: "deepseek-flash",
  },
});
