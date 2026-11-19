"""
Convierte las salidas de consola de la evaluación en imágenes con estilo de
terminal (evidencias de ejecución para los anexos). Genera un HTML por salida
y los captura con render_html.mjs (puppeteer-core + Chrome).

Uso: python3 capturas_terminal.py
"""

import html
import re
import json
import subprocess
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RESULTADOS = AQUI.parent / "resultados"
CAPTURAS = AQUI.parent / "capturas"
MANIFIESTO: list[dict] = []

ESTILO = """
body { margin:0; background:#e2e8f0; font-family:'DejaVu Sans Mono',monospace; }
.ventana { margin:14px; border-radius:10px; overflow:hidden; box-shadow:0 6px 18px rgba(15,23,42,.35); }
.barra { background:#1e293b; color:#cbd5e1; font:600 13px 'DejaVu Sans',sans-serif; padding:9px 14px; display:flex; align-items:center; gap:8px; }
.p { width:12px; height:12px; border-radius:50%; display:inline-block; }
pre { margin:0; background:#0f172a; color:#e2e8f0; padding:14px 18px; font-size:13px; line-height:18px; white-space:pre-wrap; word-break:break-word; }
.ok { color:#4ade80; font-weight:bold; } .ko { color:#f87171; font-weight:bold; }
.dim { color:#94a3b8; } .cmd { color:#facc15; } .titulo { color:#38bdf8; font-weight:bold; }
"""


def colorear(linea: str) -> str:
    t = html.escape(linea)
    t = re.sub(r"^(\s*)(PASA )", r"\1<span class='ok'>\2</span>", t)
    t = re.sub(r"^(\s*)(FALLA)", r"\1<span class='ko'>\2</span>", t)
    t = re.sub(r"(\s)(PASA )(\s)", r"\1<span class='ok'>\2</span>\3", t)
    t = re.sub(r"(\s)(FALLA)(\s)", r"\1<span class='ko'>\2</span>\3", t)
    t = re.sub(r"^(\$ .*)$", r"<span class='cmd'>\1</span>", t)
    t = re.sub(r"^(\s*(Esperado|Obtenido):)", r"<span class='dim'>\1</span>", t)
    t = re.sub(r"^(# (pass|tests) \d+)", r"<span class='ok'>\1</span>", t)
    t = re.sub(r"^(# fail 0)", r"<span class='ok'>\1</span>", t)
    t = re.sub(r"^(Promesa no controlada:.*)$", r"<span class='ko'>\1</span>", t)
    t = re.sub(r"^(=+|-+)$", r"<span class='dim'>\1</span>", t)
    t = re.sub(r"^( EVALUACIÓN.*)$", r"<span class='titulo'>\1</span>", t)
    return t


def renderizar(nombre: str, titulo: str, lineas: list[str], ancho: int = 1180) -> None:
    cuerpo = "\n".join(colorear(l) for l in lineas)
    documento = f"""<!doctype html><html><head><meta charset='utf-8'><style>{ESTILO}</style></head>
<body><div class='ventana'><div class='barra'><span class='p' style='background:#ef4444'></span>
<span class='p' style='background:#f59e0b'></span><span class='p' style='background:#22c55e'></span>
&nbsp;{html.escape(titulo)}</div><pre>{cuerpo}</pre></div></body></html>"""
    destino = RESULTADOS / "terminal"
    destino.mkdir(exist_ok=True)
    (destino / f"{nombre}.html").write_text(documento, encoding="utf-8")
    MANIFIESTO.append({"html": str(destino / f"{nombre}.html"), "png": str(CAPTURAS / f"{nombre}.png"), "ancho": ancho})
    print(f"html → {nombre}.html ({len(lineas)} líneas)")


def leer(nombre: str) -> list[str]:
    return (RESULTADOS / nombre).read_text(encoding="utf-8").rstrip("\n").split("\n")


def resumen_fallas(nombre: str) -> list[str]:
    lineas = leer(nombre)
    cabecera = lineas[:6]
    bloque = []
    for i, linea in enumerate(lineas):
        if linea.startswith("FALLA"):
            bloque.extend(lineas[i : i + 3])
    inicio = next(i for i, l in enumerate(lineas) if l.startswith(" Casos ejecutados"))
    return cabecera + ["", "… (se omiten los casos que pasan) …", ""] + bloque + ["", *lineas[inicio - 1 : inicio + 3]]


def matriz(nombre: str) -> list[str]:
    lineas = leer(nombre)
    inicio = next(i for i, l in enumerate(lineas) if l.startswith(" Casos ejecutados"))
    return lineas[:5] + [""] + lineas[inicio - 1 :]


def main() -> None:
    CAPTURAS.mkdir(exist_ok=True)
    suite = leer("ejecucion_suite_existente.txt")
    renderizar(
        "T01_suite_existente",
        "backend$ npm test  — suite automatizada existente (modo memoria)",
        ["$ cd backend && npm test", "…", *suite[-26:]],
        ancho=900,
    )
    renderizar(
        "T02_api_postgresql_fallas",
        "evaluacion$ node pruebas/casos_api.mjs modo=postgresql  — casos fallidos",
        resumen_fallas("ejecucion_api_postgresql.txt"),
    )
    renderizar(
        "T03_api_memoria_fallas",
        "evaluacion$ node pruebas/casos_api.mjs modo=memoria  — casos fallidos",
        resumen_fallas("ejecucion_api_memoria.txt"),
    )
    renderizar(
        "T04_api_postgresql_matriz",
        "evaluacion$ node pruebas/casos_api.mjs modo=postgresql  — resumen de los 81 casos de API",
        matriz("ejecucion_api_postgresql.txt"),
        ancho=1000,
    )
    ui = [l for l in leer("ejecucion_ui_postgresql.txt") if not l.strip().startswith("captura →")]
    renderizar("T05_ui_postgresql", "evaluacion$ node pruebas/casos_ui.mjs  — casos de interfaz (Chrome)", ui)
    log = leer("log_servidor_postgresql.txt")
    limpio = []
    for linea in log:
        texto = re.sub(r"^\d+[-:]", "", linea)
        if texto.strip().startswith(("length", "severity", "code", "detail", "hint", "position", "internal", "where", "schema", "table", "column", "data", "constraint", "file", "line", "routine", "}")):
            continue
        limpio.append(texto)
    renderizar("T06_log_servidor", "backend (PostgreSQL) — salida del servidor durante la evaluación", limpio)
    renderizar("T07_observaciones", "evaluacion$ curl … — verificación de observaciones (PostgreSQL)", leer("observaciones_postgresql.txt"))
    renderizar("T08_dni_duplicado", "evaluacion$ curl … — clientes con el mismo DNI (CP-29)", leer("evidencia_dni_duplicado.txt"), ancho=1000)
    manifiesto = RESULTADOS / "terminal" / "manifiesto.json"
    manifiesto.write_text(json.dumps(MANIFIESTO, ensure_ascii=False, indent=2), encoding="utf-8")
    subprocess.run(["node", str(AQUI / "render_html.mjs"), str(manifiesto)], check=True)


if __name__ == "__main__":
    main()
