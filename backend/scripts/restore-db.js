/**
 * Restaura el respaldo más reciente, un archivo, o la copia guardada en la base.
 * Uso: node scripts/restore-db.js [archivo.sql]
 * Objetivo de recuperación: menos de 2 horas.
 */
import { runRestore } from "../src/backup.js";

const result = await runRestore(process.env.DATABASE_URL, process.argv[2]);
console.log(`restaurado ${result.nombre} en ${result.ms} ms`);
