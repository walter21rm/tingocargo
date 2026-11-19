"""
Gráficos del informe: radar del cuadro consolidado, resultados de los casos de
prueba por función y diagrama de Ishikawa del análisis causal.
"""

import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import FancyBboxPatch  # noqa: E402

from datos import UMBRAL  # noqa: E402

AZUL = "#1F4E79"
VERDE = "#2E7D32"
ROJO = "#C62828"
plt.rcParams["font.family"] = "DejaVu Sans"


def radar(metricas, destino: Path):
    etiquetas = [m[0] for m in metricas]
    valores = [m[1] for m in metricas]
    n = len(valores)
    angulos = [i / n * 2 * math.pi for i in range(n)]
    angulos_c = angulos + angulos[:1]
    fig = plt.figure(figsize=(7.4, 6.6), dpi=200)
    ax = plt.subplot(111, polar=True)
    ax.set_theta_offset(math.pi / 2)
    ax.set_theta_direction(-1)
    ax.set_ylim(0, 1)
    ax.set_yticks([0.2, 0.4, 0.6, 0.8, 1.0])
    ax.set_yticklabels(["0.20", "0.40", "0.60", "0.80", "1.00"], fontsize=8, color="#475569")
    ax.set_xticks(angulos)
    ax.set_xticklabels(etiquetas, fontsize=9, color="#0f172a")
    ax.tick_params(axis="x", pad=16)
    umbral = [UMBRAL] * (n + 1)
    ax.plot(angulos_c, umbral, color=ROJO, linewidth=1.6, linestyle="--", label=f"Umbral de conformidad ({UMBRAL:.2f})")
    ax.fill(angulos_c, umbral, color=ROJO, alpha=0.04)
    vals_c = valores + valores[:1]
    ax.plot(angulos_c, vals_c, color=AZUL, linewidth=2.2, marker="o", markersize=6, label="Valor obtenido")
    ax.fill(angulos_c, vals_c, color=AZUL, alpha=0.22)
    for ang, val in zip(angulos, valores):
        color = VERDE if round(val, 2) >= UMBRAL else ROJO
        ax.annotate(
            f"{val:.2f}",
            xy=(ang, val),
            xytext=(ang, min(val + 0.11, 1.07)),
            ha="center",
            va="center",
            fontsize=10,
            fontweight="bold",
            color=color,
            bbox=dict(boxstyle="round,pad=0.2", fc="white", ec=color, lw=0.8),
        )
    ax.legend(loc="upper right", bbox_to_anchor=(1.32, 1.12), fontsize=8.5, frameon=False)
    ax.set_title("Adecuación funcional de TingoCargo — ISO/IEC 25023", fontsize=11.5, color=AZUL, fontweight="bold", pad=26)
    fig.tight_layout()
    fig.savefig(destino, bbox_inches="tight")
    plt.close(fig)


def barras_funciones(por_funcion, destino: Path):
    ids = list(por_funcion)
    pasan = [por_funcion[f]["pasan"] for f in ids]
    fallan = [len(por_funcion[f]["fallidos"]) for f in ids]
    fig, ax = plt.subplots(figsize=(10.5, 4.2), dpi=200)
    x = range(len(ids))
    ax.bar(x, pasan, color=VERDE, label="Pasa", width=0.68)
    ax.bar(x, fallan, bottom=pasan, color=ROJO, label="Falla", width=0.68)
    for i, (p, f) in enumerate(zip(pasan, fallan)):
        ax.text(i, p + f + 0.12, str(p + f), ha="center", va="bottom", fontsize=7.5, color="#334155")
    ax.set_xticks(list(x))
    ax.set_xticklabels(ids, rotation=60, fontsize=8)
    ax.set_ylabel("Casos de prueba", fontsize=9)
    ax.set_ylim(0, max(p + f for p, f in zip(pasan, fallan)) + 1.4)
    separador = sum(1 for f in ids if f.startswith("RF")) - 0.5
    ax.axvline(separador, color="#94a3b8", linestyle=":", linewidth=1)
    ax.text(separador / 2, ax.get_ylim()[1] - 0.35, "Requisitos del SRS (RF)", ha="center", fontsize=8.5, color=AZUL)
    ax.text(separador + (len(ids) - separador) / 2, ax.get_ylim()[1] - 0.35, "Funciones documentadas (FD)", ha="center", fontsize=8.5, color=AZUL)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(fontsize=8.5, frameon=False, loc="upper left", bbox_to_anchor=(0.0, 0.93))
    ax.set_title("Resultado de los 90 casos de prueba por función (configuración PostgreSQL)", fontsize=10.5, color=AZUL, fontweight="bold")
    fig.tight_layout()
    fig.savefig(destino, bbox_inches="tight")
    plt.close(fig)


def ishikawa(destino: Path):
    fig, ax = plt.subplots(figsize=(12, 6.2), dpi=200)
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 6.2)
    ax.axis("off")
    ax.annotate("", xy=(9.35, 3.1), xytext=(0.35, 3.1), arrowprops=dict(arrowstyle="-|>", lw=2.4, color=AZUL, mutation_scale=22))
    efecto = FancyBboxPatch((9.45, 2.35), 2.45, 1.5, boxstyle="round,pad=0.06", fc=AZUL, ec=AZUL)
    ax.add_patch(efecto)
    ax.text(10.675, 3.1, "Funciones\nincorrectas\nM2.1 = 0.75\nM3.2 = 0.62", ha="center", va="center", color="white", fontsize=10.5, fontweight="bold")
    espinas = [
        ("C1 · Especificación (SRS)", 1.6, True, ["Pagos y reprogramación fuera del SRS", "Portal del cliente sin requisitos", "Sin reglas de estados ni de unicidad", "Sin criterios de aceptación"]),
        ("C2 · Reglas de negocio", 4.4, True, ["Sin máquina de estados", "Fechas de reprogramación sin validar", "Rama operadorId = null omitida", "«Efectivo» marca pagado"]),
        ("C3 · Autorización e interfaz", 7.2, True, ["Lista de exclusión (solo Repartidor)", "El portal pide lo que la API prohíbe", "Login sin destino según el rol", "Formulario de edición sin teléfono"]),
        ("C4 · Persistencia y cifrado", 1.6, False, ["getUserById sin descifrar", "Búsqueda por DNI sobre texto cifrado", "DATE devuelto como timestamp ISO"]),
        ("C5 · Manejo de errores", 4.4, False, ["Handlers async sin captura (Express 4)", "UNIQUE / FK no se traducen a 409", "Peticiones que nunca responden"]),
        ("C6 · Pruebas", 7.2, False, ["41 pruebas solo en modo memoria", "Sin casos negativos ni de pagos", "Evaluación previa exploratoria (5/5)"]),
    ]
    for titulo, x, arriba, causas in espinas:
        y0 = 5.45 if arriba else 0.75
        ax.plot([x, x + 1.45], [y0, 3.1], color="#334155", lw=1.6)
        ax.text(x - 0.15, y0 + (0.28 if arriba else -0.3), titulo, fontsize=9.5, fontweight="bold", color=AZUL, ha="left", va="center")
        for i, causa in enumerate(causas):
            t = (i + 0.7) / (len(causas) + 0.4)
            yy = y0 + (3.1 - y0) * t
            xx = x + 1.45 * t
            ax.plot([xx - 0.12, xx], [yy, yy], color="#94a3b8", lw=0.9)
            ax.text(xx - 0.16, yy, causa, fontsize=7.6, color="#1e293b", ha="right", va="center")
    ax.set_title("Diagrama de Ishikawa — causas de las fallas de adecuación funcional", fontsize=12, color=AZUL, fontweight="bold")
    fig.tight_layout()
    fig.savefig(destino, bbox_inches="tight")
    plt.close(fig)
