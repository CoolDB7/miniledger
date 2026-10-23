import fs from "fs";
import path from "path";
import { pool } from "./db";

export async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "sql", "schema.sql"), "utf8");
  await pool.query(sql);
}

// Run directly: `npm run migrate`
if (require.main === module) {
  migrate()
    .then(() => console.log("Migration complete"))
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => pool.end());
}
