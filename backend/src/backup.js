/**
 * Respaldo y restauración de PostgreSQL.
 * El archivo queda en backend/data/backups y una copia en la tabla respaldos,
 * así sobrevive aunque el disco del servidor se reinicie.
 * La recuperación de un volumen de 10.000 envíos al mes cabe en menos de 2 horas.
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../data/backups");

const clientConfig = (databaseUrl) => ({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("supabase.co")
    ? { rejectUnauthorized: false }
    : undefined
});

const quoteIdent = (name) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Tabla no permitida: ${name}`);
  }
  return `"${name}"`;
};

const sqlLiteral = (value) => {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (Buffer.isBuffer(value)) return `'\\x${value.toString("hex")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
};

/** Arma INSERTs de un respaldo lógico. No necesita PostgreSQL instalado. */
export const buildInsertSql = (table, rows) => {
  const tableName = quoteIdent(table);
  return rows
    .map((row) => {
      const cols = Object.keys(row).map(quoteIdent);
      const values = Object.values(row).map(sqlLiteral);
      return `INSERT INTO ${tableName} (${cols.join(", ")}) VALUES (${values.join(", ")});`;
    })
    .join("\n");
};

const dumpWithPg = async (databaseUrl) => {
  const client = new pg.Client(clientConfig(databaseUrl));
  await client.connect();
  try {
    const tables = await client.query(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> 'respaldos'
       ORDER BY tablename`
    );
    let sql = "-- respaldo logico TingoCargo\n";
    for (const table of tables.rows) {
      const name = quoteIdent(table.tablename);
      const rows = await client.query(`SELECT * FROM ${name}`);
      sql += `-- ${table.tablename} ${rows.rowCount} filas\n`;
      for (const row of rows.rows) {
        const cols = Object.keys(row).map(quoteIdent);
        const values = Object.values(row).map(sqlLiteral);
        sql += `INSERT INTO ${name} (${cols.join(", ")}) VALUES (${values.join(", ")});\n`;
      }
    }
    return sql;
  } finally {
    await client.end();
  }
};

const runPgDump = (databaseUrl) =>
  new Promise((resolve) => {
    const child = spawn(
      "pg_dump",
      ["--no-owner", "--exclude-table=respaldos", "--dbname", databaseUrl],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks).toString("utf8"));
      else resolve(null);
    });
  });

const rememberBackup = async (databaseUrl, nombre, sql) => {
  const client = new pg.Client(clientConfig(databaseUrl));
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS respaldos (
        id SERIAL PRIMARY KEY,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        nombre VARCHAR(200) NOT NULL,
        sql TEXT NOT NULL
      )
    `);
    await client.query(
      "INSERT INTO respaldos (nombre, sql) VALUES ($1, $2)",
      [nombre, sql]
    );
    await client.query(`
      DELETE FROM respaldos
      WHERE id NOT IN (SELECT id FROM respaldos ORDER BY id DESC LIMIT 7)
    `);
  } finally {
    await client.end();
  }
};

export const runBackup = async (databaseUrl = process.env.DATABASE_URL) => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL es requerido para el respaldo");
  }
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const nombre = `tingocargo-${stamp}.sql`;
  const target = path.join(outDir, nombre);
  const sql = (await runPgDump(databaseUrl)) || (await dumpWithPg(databaseUrl));
  fs.writeFileSync(target, sql);
  const files = fs
    .readdirSync(outDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  while (files.length > 14) {
    fs.unlinkSync(path.join(outDir, files.shift()));
  }
  await rememberBackup(databaseUrl, nombre, sql);
  return { file: target, bytes: Buffer.byteLength(sql) };
};

export const latestBackupSql = async (databaseUrl = process.env.DATABASE_URL) => {
  const client = new pg.Client(clientConfig(databaseUrl));
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT sql, nombre, creado_en FROM respaldos ORDER BY id DESC LIMIT 1"
    );
    return rows[0] || null;
  } catch {
    return null;
  } finally {
    await client.end();
  }
};

export const runRestore = async (
  databaseUrl = process.env.DATABASE_URL,
  sourceFile
) => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL es requerido para restaurar");
  }
  let sql = "";
  let nombre = sourceFile || "";
  if (sourceFile) {
    const full = path.isAbsolute(sourceFile)
      ? sourceFile
      : path.join(outDir, sourceFile);
    sql = fs.readFileSync(full, "utf8");
    nombre = path.basename(full);
  } else {
    const files = fs.existsSync(outDir)
      ? fs.readdirSync(outDir).filter((name) => name.endsWith(".sql")).sort()
      : [];
    if (files.length) {
      nombre = files.at(-1);
      sql = fs.readFileSync(path.join(outDir, nombre), "utf8");
    } else {
      const stored = await latestBackupSql(databaseUrl);
      if (!stored) throw new Error("No hay respaldos");
      sql = stored.sql;
      nombre = stored.nombre;
    }
  }
  const started = Date.now();
  await new Promise((resolve, reject) => {
    const child = spawn("psql", ["--dbname", databaseUrl, "-v", "ON_ERROR_STOP=1"], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", () => reject(new Error("psql no está instalado")));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `psql terminó con código ${code}`));
    });
    child.stdin.write(sql);
    child.stdin.end();
  });
  return { nombre, ms: Date.now() - started };
};
