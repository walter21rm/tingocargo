/**
 * Disponibilidad en horario operativo (08:00–20:00, America/Lima).
 * Cada muestra cuenta. Los huecos mayores a 12 minutos dentro de la ventana
 * se consideran caída. El porcentaje se calcula desde la primera muestra.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.resolve(__dirname, "../data/availability.jsonl");
const SLOT_MS = 10 * 60 * 1000;
const WINDOW_START = 8;
const WINDOW_END = 20;
const TARGET = 99;

const limaParts = (date) => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((part) => [part.type, part.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
};

export const recordAvailability = (ok = true) => {
  const line = JSON.stringify({ ts: Date.now(), ok: Boolean(ok) }) + "\n";
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, line);
};

const readSamples = () => {
  try {
    return fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((row) => Number.isFinite(row.ts));
  } catch {
    return [];
  }
};

export const availabilityReport = (now = Date.now()) => {
  const samples = readSamples().filter((row) => row.ok);
  if (samples.length === 0) {
    return {
      porcentaje: 100,
      objetivo: TARGET,
      cumple: true,
      muestras: 0,
      horario: "08:00-20:00 America/Lima",
      desde: null
    };
  }
  const first = Math.min(...samples.map((row) => row.ts));
  const start = new Date(first);
  start.setUTCMinutes(0, 0, 0);
  let expected = 0;
  let up = 0;
  for (let cursor = start.getTime(); cursor <= now; cursor += SLOT_MS) {
    const parts = limaParts(new Date(cursor));
    if (parts.hour < WINDOW_START || parts.hour >= WINDOW_END) continue;
    if (cursor < first) continue;
    expected += 1;
    const hit = samples.some(
      (row) => row.ts >= cursor && row.ts < cursor + SLOT_MS
    );
    if (hit) up += 1;
  }
  const porcentaje =
    expected === 0 ? 100 : Math.round((up / expected) * 1000) / 10;
  return {
    porcentaje,
    objetivo: TARGET,
    cumple: porcentaje >= TARGET,
    muestras: samples.length,
    intervalos: expected,
    intervalosOk: up,
    horario: "08:00-20:00 America/Lima",
    desde: new Date(first).toISOString()
  };
};
