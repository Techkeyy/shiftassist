// Windows builds link function folders with junctions to absolute C:\ paths, which
// can't resolve on Vercel. Replaces each link with a real copy of its target.
// Run from the project folder after `NITRO_PRESET=vercel pnpm build`.
const fs = require("fs");
const path = require("path");

function fix(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.lstatSync(full).isSymbolicLink()) {
      const target = fs.realpathSync(full);
      fs.unlinkSync(full);
      fs.cpSync(target, full, { recursive: true });
      console.log(`copied ${path.relative(dir, target)} to ${entry}`);
    } else if (fs.statSync(full).isDirectory() && !entry.endsWith(".func")) {
      fix(full);
    }
  }
}

fix(path.join(".vercel", "output", "functions"));
