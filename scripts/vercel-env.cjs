// Saves ShiftAssist's production settings in Vercel, reading secrets from .env and
// .deploy.local. Values are never printed. Run once from the project folder:
//   node scripts/vercel-env.cjs
// BETTER_AUTH_SECRET is only created if missing, so re-running never signs people out.
const fs = require("fs");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const parse = (file) =>
  Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1).trim()];
      }),
  );

const run = (args, input) =>
  spawnSync("vercel", args, {
    input,
    shell: true,
    encoding: "utf8",
    timeout: 90000,
  });

const env = parse(".env");
const deploy = parse(".deploy.local");
const existing = run(["env", "ls", "production"]).stdout || "";

const values = {
  DATABASE_URL: deploy.DATABASE_URL,
  OPENAI_API_KEY: env.OPENAI_API_KEY,
  OPENAI_BASE_URL: env.OPENAI_BASE_URL,
  AGENT_ENGINE: env.AGENT_ENGINE,
  AGENT_ENGINE_PREFER_BYO_KEY: env.AGENT_ENGINE_PREFER_BYO_KEY,
  AGENT_MODEL: "deepseek-flash",
  AUTH_REQUIRE_EMAIL_VERIFICATION: "0",
};
if (!existing.includes("BETTER_AUTH_SECRET")) {
  values.BETTER_AUTH_SECRET = crypto.randomBytes(32).toString("hex");
}

for (const [name, value] of Object.entries(values)) {
  if (!value) {
    console.log(`${name}: MISSING, not saved`);
    continue;
  }
  const result = run(["env", "add", name, "production", "--force"], value);
  console.log(`${name}: ${result.status === 0 ? "saved" : "FAILED"}`);
}
