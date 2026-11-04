/**
 * Restaura el respaldo más reciente (o el archivo pasado por argumento).
 * Uso: node scripts/restore-db.js [archivo.sql]
 * Objetivo de recuperación: menos de 2 horas para el volumen operativo.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../data/backups");
const databaseUrl = process.env.DATABASE_URL;
const requested = process.argv[2];

if (!databaseUrl) {
  console.error("DATABASE_URL es requerido para restaurar");
  process.exit(1);
}

const file =
  requested ||
  fs
    .readdirSync(outDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .at(-1);

if (!file) {
  console.error("No hay respaldos en", outDir);
  process.exit(1);
}

const source = path.isAbsolute(file) ? file : path.join(outDir, file);
const sql = fs.readFileSync(source);

const child = spawn("psql", ["--dbname", databaseUrl], {
  stdio: ["pipe", "inherit", "inherit"]
});
child.on("error", () => {
  console.error(
    "psql no está instalado. Carga el archivo SQL con el cliente de PostgreSQL:",
    source
  );
  process.exit(1);
});
child.stdin.write(sql);
child.stdin.end();
child.on("close", (code) => process.exit(code || 0));
