import { runMigrations } from "@agent-native/core/db";

import { migrations, MIGRATIONS_TABLE } from "../db/migrations.js";

export default runMigrations(migrations, { table: MIGRATIONS_TABLE });
