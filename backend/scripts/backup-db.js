/**
 * Copia de seguridad diaria de PostgreSQL.
 * Escribe un SQL en backend/data/backups. La restauración con
 * restore-db.js vuelve a cargar ese archivo. En una base del tamaño
 * previsto (10.000 envíos al mes) la recuperación cabe en menos de 2 horas.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../data/backups");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL es requerido para el respaldo");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(outDir, `tingocargo-${stamp}.sql`);

const runPgDump = () =>
  new Promise((resolve) => {
    const child = spawn("pg_dump", ["--no-owner", "--dbname", databaseUrl], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks).toString("utf8"));
      else resolve(null);
    });
  });

const dumpWithPg = async () => {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("supabase.co")
      ? { rejectUnauthorized: false }
      : undefined
  });
  await client.connect();
  const tables = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  let sql = "-- respaldo logico TingoCargo\n";
  for (const table of tables.rows) {
    const name = table.tablename;
    const rows = await client.query(`SELECT * FROM ${name}`);
    sql += `-- ${name} ${rows.rowCount} filas\n`;
    for (const row of rows.rows) {
      const cols = Object.keys(row);
      const values = cols.map((col) => {
        const value = row[col];
        if (value === null || value === undefined) return "NULL";
        if (value instanceof Date) return `'${value.toISOString()}'`;
        if (typeof value === "number" || typeof value === "boolean") {
          return String(value);
        }
        return `'${String(value).replace(/'/g, "''")}'`;
      });
      sql += `INSERT INTO ${name} (${cols.join(", ")}) VALUES (${values.join(", ")});\n`;
    }
  }
  await client.end();
  return sql;
};

const sql = (await runPgDump()) || (await dumpWithPg());
fs.writeFileSync(target, sql);
const files = fs
  .readdirSync(outDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();
while (files.length > 14) {
  fs.unlinkSync(path.join(outDir, files.shift()));
}
console.log("respaldo escrito", target);
