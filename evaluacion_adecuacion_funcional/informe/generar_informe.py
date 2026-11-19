"""
Genera «Trabajo Encargado – Evaluación de Adecuación Funcional» de TingoCargo
(ISO/IEC 25010 e ISO/IEC 25023) a partir de los resultados de las pruebas
(../resultados) y las capturas (../capturas).

Uso:  cd evaluacion_adecuacion_funcional/informe && python3 generar_informe.py
Salida: /Trabajo_Encargado_Evaluacion_Adecuacion_Funcional.docx (raíz del repositorio)

El índice se calcula en dos pasadas: se genera el documento, se convierte a PDF
con LibreOffice para ubicar la página de cada título y se vuelve a generar con
esos números (Word puede actualizarlo además con F9).
"""

import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

import datos as D
import docx_utils as U
import graficos as G

AQUI = Path(__file__).resolve().parent
EVAL = AQUI.parent
REPO = EVAL.parent
GRAFICOS = EVAL / "graficos"
OPTIMIZADAS = GRAFICOS / "optimizadas"
SALIDA = REPO / "Trabajo_Encargado_Evaluacion_Adecuacion_Funcional.docx"
CAP = D.CAPTURAS

LIMA = timezone(timedelta(hours=-5))
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def fecha_lima(iso):
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(LIMA)
    return dt, f"{dt.day} de {MESES[dt.month - 1]} de {dt.year}, {dt:%H:%M} (hora de Lima, UTC−5)"


# ───────────────────────────── Estilos ─────────────────────────────


def preparar_documento():
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(3.0)
    sec.top_margin = sec.bottom_margin = Cm(2.5)
    sec.header_distance = sec.footer_distance = Cm(1.25)
    sec.different_first_page_header_footer = True

    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(11)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    lang = OxmlElement("w:lang")
    lang.set(qn("w:val"), "es-PE")
    lang.set(qn("w:eastAsia"), "es-PE")
    normal.element.rPr.append(lang)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.15

    for nombre, tam, color, antes, despues in (
        ("Heading 1", 15, U.AZUL, 18, 8),
        ("Heading 2", 12.5, U.AZUL, 14, 6),
        ("Heading 3", 11.5, U.AZUL_OSCURO, 10, 4),
    ):
        st = doc.styles[nombre]
        st.font.name = "Calibri"
        st.element.rPr.rFonts.set(qn("w:asciiTheme"), "")
        st.element.rPr.rFonts.set(qn("w:ascii"), "Calibri")
        st.element.rPr.rFonts.set(qn("w:hAnsi"), "Calibri")
        st.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
        st.font.size = Pt(tam)
        st.font.bold = True
        st.font.italic = False
        st.font.color.rgb = RGBColor.from_string(color)
        st.paragraph_format.space_before = Pt(antes)
        st.paragraph_format.space_after = Pt(despues)
        st.paragraph_format.keep_with_next = True

    cap = doc.styles["Caption"]
    cap.font.name = "Calibri"
    cap.font.size = Pt(9)
    cap.font.bold = False
    cap.font.italic = False
    cap.font.color.rgb = RGBColor.from_string("262626")

    for nivel, sangria, tam in ((1, 0, 11), (2, 0.6, 10.5)):
        st = doc.styles.add_style(f"toc {nivel}", WD_STYLE_TYPE.PARAGRAPH)
        st.base_style = doc.styles["Normal"]
        st.font.size = Pt(tam)
        st.paragraph_format.left_indent = Cm(sangria)
        st.paragraph_format.space_before = Pt(4 if nivel == 1 else 1)
        st.paragraph_format.space_after = Pt(1)

    for nombre in ("List Bullet", "List Bullet 2"):
        doc.styles[nombre].font.size = Pt(11)

    props = doc.core_properties
    props.title = "Evaluación de Adecuación Funcional — TingoCargo"
    props.subject = "Trabajo Encargado – Unidad 3 · ISO/IEC 25010 e ISO/IEC 25023"
    props.author = "Equipo TingoCargo"
    props.keywords = "ISO/IEC 25010, ISO/IEC 25023, adecuación funcional, completitud, corrección, pertinencia"
    props.language = "es-PE"
    return doc


def encabezado_y_pie(doc):
    sec = doc.sections[0]
    p = sec.header.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = p.add_run("Evaluación de Adecuación Funcional — TingoCargo  ·  ISO/IEC 25010 / ISO/IEC 25023")
    r.font.size = Pt(8.5)
    r.font.color.rgb = RGBColor.from_string("7F7F7F")
    p_pr = p._p.get_or_add_pPr()
    borde = OxmlElement("w:pBdr")
    inf = OxmlElement("w:bottom")
    for k, v in (("val", "single"), ("sz", "4"), ("space", "4"), ("color", "BFC9D6")):
        inf.set(qn(f"w:{k}"), v)
    borde.append(inf)
    p_pr.append(borde)

    f = sec.footer.paragraphs[0]
    f.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for parte in ("Página ", "PAGE", " de ", "NUMPAGES"):
        if parte in ("PAGE", "NUMPAGES"):
            for run in U.agregar_campo(f, parte):
                run.font.size = Pt(9)
                run.font.color.rgb = RGBColor.from_string("595959")
        else:
            run = f.add_run(parte)
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor.from_string("595959")


# ───────────────────────────── Portada e índice ─────────────────────────────


def portada(doc, ctx):
    for _ in range(3):
        U.espacio(doc, 12)
    for texto, tam, color in (
        ("TRABAJO ENCARGADO – UNIDAD 3", 22, U.AZUL),
        ("EVALUACIÓN DE ADECUACIÓN FUNCIONAL", 24, U.AZUL_OSCURO),
    ):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(texto)
        r.bold = True
        r.font.size = Pt(tam)
        r.font.color.rgb = RGBColor.from_string(color)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(10)
    r = p.add_run("Producto software evaluado: TingoCargo — Sistema web de transporte y logística")
    r.font.size = Pt(13)
    r.font.color.rgb = RGBColor.from_string("262626")
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Marco de referencia: ISO/IEC 25010:2023 (modelo de calidad) e ISO/IEC 25023:2016 (medición)")
    r.italic = True
    r.font.size = Pt(11)
    r.font.color.rgb = RGBColor.from_string("595959")
    for _ in range(2):
        U.espacio(doc, 14)
    filas = [
        ("Curso", "Calidad de Producto de Software"),
        ("Docente", "José Orlando Castillo Cornelio"),
        ("Integrantes", "[Completar con los nombres y apellidos de los integrantes del equipo]"),
        ("Versión evaluada", f"Repositorio TingoCargo, rama main, commit {ctx['commit']}"),
        ("Fecha de ejecución de las pruebas", ctx["fecha_ejecucion_corta"]),
        ("Fecha de presentación", "19 de noviembre de 2026"),
    ]
    t = doc.add_table(rows=len(filas), cols=2)
    U.bordes(t, color="BFC9D6")
    U.margenes_celda(t, 80, 80, 120, 120)
    for i, (k, v) in enumerate(filas):
        U.texto_celda(t.rows[i].cells[0], k, negrita=True, tam=10.5, color="FFFFFF")
        U.sombrear(t.rows[i].cells[0], U.AZUL)
        U.texto_celda(t.rows[i].cells[1], v, tam=10.5, cursiva=v.startswith("["), color="7F7F7F" if v.startswith("[") else None)
    U.anchos(t, [5.0, 10.0])
    for _ in range(4):
        U.espacio(doc, 14)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Noviembre de 2026")
    r.font.size = Pt(10.5)
    r.font.color.rgb = RGBColor.from_string("595959")
    U.salto_pagina(doc)


def pagina_indice(doc, titulos, paginas):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(12)
    r = p.add_run("ÍNDICE")
    r.bold = True
    r.font.size = Pt(15)
    r.font.color.rgb = RGBColor.from_string(U.AZUL)
    entradas = [(n, t, paginas.get(t, "")) for n, t in titulos if n <= 2]
    if not entradas:
        entradas = [(1, "Actualice el índice (clic derecho → Actualizar campo)", "")]
    U.indice(doc, entradas)
    U.salto_pagina(doc)


TITULOS = []


def h(doc, texto, nivel):
    TITULOS.append((nivel, texto))
    return doc.add_heading(texto, level=nivel)


# ───────────────────────────── Secciones ─────────────────────────────


def seccion_introduccion(doc, ctx):
    h(doc, "1. INTRODUCCIÓN", 1)
    h(doc, "1.1 Propósito", 2)
    U.parrafo(doc, "Evaluar el grado de **Adecuación Funcional** del producto software **TingoCargo**, desarrollado por el equipo, teniendo como referencia las normas **ISO/IEC 25010** (modelo de calidad del producto) e **ISO/IEC 25023** (medición de la calidad del producto).")
    h(doc, "1.2 Alcance", 2)
    m = ctx["m"]
    r = m["resumen"]
    U.parrafo(doc, f"Se evalúan las tres subcaracterísticas de la adecuación funcional definidas en ISO/IEC 25010:2023 —**completitud**, **corrección** y **pertinencia funcional**— operacionalizadas con las medidas FCp-1-G, FCr-1-G, FAp-1-G y FAp-2-G de ISO/IEC 25023:2016, identificadas en el enunciado como M1.1, M2.1, M3.1 y M3.2.")
    U.parrafo(doc, f"La evaluación se realizó sobre la versión del repositorio de la rama main (commit {ctx['commit']}) ejecutada en la **configuración de producción**: backend Node.js/Express con base de datos PostgreSQL y cifrado de datos sensibles, igual que el despliegue descrito en render.yaml. Como referencia también se ejecutaron los casos de API en el **modo de almacenamiento en memoria**, que es el que usan las pruebas automatizadas del proyecto. En total se ejecutaron **{r['pg_total']} casos de prueba** en la configuración de producción ({r['pg_api']} sobre la API REST y {r['ui']} sobre la interfaz web con Google Chrome) el {ctx['fecha_ejecucion']}.")
    h(doc, "1.3 Organización del documento", 2)
    for texto in (
        "Documentos y artefactos de entrada utilizados (especificación de requisitos y otros).",
        "Descripción del producto software evaluado.",
        "Descripción de las herramientas, el entorno, el procedimiento y los criterios de evaluación.",
        "Evaluación de las tres subcaracterísticas con sus métricas, incluida la definición de tres objetivos de uso para la pertinencia funcional.",
        "Cuadro consolidado de resultados con gráfico de radar.",
        "Análisis de resultados: análisis causal de fallas y propuesta de acciones correctivas.",
        "Conclusiones sobre la madurez funcional del producto frente a la norma.",
        "Anexos con la matriz de casos de prueba y las evidencias de ejecución y de defectos (capturas de pantalla y salidas de consola).",
    ):
        U.vineta(doc, texto)


def seccion_artefactos(doc, ctx):
    h(doc, "2. DOCUMENTOS Y ARTEFACTOS DE ENTRADA", 1)
    U.parrafo(doc, f"La evaluación parte de los artefactos producidos durante el desarrollo de TingoCargo, todos disponibles en el repositorio del proyecto. La Tabla {U.CONT.tabla + 1} resume cada artefacto y su uso.")
    filas = [
        ("1", "Especificación de requisitos funcionales (SRS)", "requisitos_funcionales.csv / .rtf", "20 requisitos RF-01 a RF-20 con entradas, proceso y salidas.", "Funciones especificadas (B) de M1.1 y M2.1; diseño de casos de prueba."),
        ("2", "Requisitos no funcionales", "requisitos_no_funcionales.csv", "14 requisitos RNF-01 a RNF-14.", "Criterios de apoyo: seguridad de acceso (RNF-02), integridad (RNF-04), auditoría (RNF-10)."),
        ("3", "Documentación del proyecto", "DOCUMENTACION_PROYECTO.md", "Roles, arquitectura, API REST, pantallas y flujos de envío, pago y reprogramación.", "Funciones documentadas FD-01 a FD-06; objetivos de uso; resultados esperados."),
        ("4", "Casos de prueba previos", "casos_prueba_metodos.csv y plan_pruebas_unidad.rtf", "26 casos (CP-01 a CP-26) del plan de pruebas unitarias.", "Punto de partida para los casos de esta evaluación."),
        ("5", "Suite automatizada existente", "backend/tests/*.test.js", "41 pruebas (API, concurrencia, RNF y SLA) en modo memoria.", "Línea base: 41 de 41 pasan (Anexo B)."),
        ("6", "Parametrización del negocio", "config.json", "Tarifa S/ 10 hasta 2 kg, estados, métodos de pago, países y zona horaria.", "Resultados esperados de tarifas, estados y fechas."),
        ("7", "Esquema de base de datos", "sql/schema.sql", "Tablas, llaves foráneas y restricciones.", "Base de datos PostgreSQL de evaluación."),
        ("8", "Código fuente", "frontend/, backend/ (commit " + ctx["commit"] + ")", "React 18 + Express 4 + PostgreSQL.", "Producto evaluado y análisis causal."),
        ("9", "Configuración de despliegue", "render.yaml, docker-compose.yml", "Producción con USE_DB=true (PostgreSQL / Supabase).", "Definición de la configuración de producción evaluada."),
        ("10", "Evaluación exploratoria previa", "FICHA_EVALUACION_ISO_25010.docx", "Ficha de percepción ISO/IEC 25010 (adecuación funcional 5.00/5).", "Contraste con la medición objetiva."),
        ("11", "Normas de referencia", "ISO/IEC 25010:2023, ISO/IEC 25023:2016, ISO/IEC 25040", "Modelo de calidad, medidas y proceso de evaluación.", "Definiciones, métricas y procedimiento."),
    ]
    U.tabla(doc, ["N°", "Artefacto", "Ubicación", "Contenido", "Uso en la evaluación"], filas, [0.8, 3.0, 3.4, 3.9, 3.9], titulo="Documentos y artefactos de entrada", tam=8.5, alinear=["c", None, None, None, None])

    h(doc, "2.1 Especificación de requisitos funcionales (SRS)", 2)
    U.parrafo(doc, "El SRS del proyecto define veinte requisitos funcionales. Son las **funciones especificadas** que sirven de base para medir la completitud y la corrección funcional.")
    filas = [(rid, n, d, s) for rid, (n, d, s) in D.RF.items()]
    U.tabla(doc, ["ID", "Requisito", "Descripción", "Entradas → salidas"], filas, [1.4, 3.4, 4.8, 5.4], titulo="Requisitos funcionales del SRS (RF-01 a RF-20)", tam=8.5, alinear=["c", None, None, None], fuente_nota="Fuente: requisitos_funcionales.rtf del proyecto.")

    h(doc, "2.2 Funciones documentadas fuera del SRS", 2)
    U.parrafo(doc, f"La documentación del proyecto describe funciones que forman parte del alcance del sistema —el cobro del servicio y la reprogramación de entregas figuran entre los problemas que resuelve (§1.2)— pero que **no tienen un requisito en el SRS**. Como son necesarias para los objetivos de uso, se incorporan a la evaluación de la pertinencia funcional con los identificadores FD-01 a FD-06 (Tabla {U.CONT.tabla + 1}). No se suman a la base B de M1.1 y M2.1, que corresponde estrictamente al SRS.")
    filas = [(fid, n, src, ep) for fid, (n, src, ep) in D.FD.items()]
    U.tabla(doc, ["ID", "Función documentada", "Fuente", "Endpoint / pantalla"], filas, [1.4, 5.0, 3.6, 5.0], titulo="Funciones documentadas no incluidas en el SRS (FD-01 a FD-06)", tam=8.5, alinear=["c", None, None, None])


def seccion_producto(doc, ctx):
    h(doc, "3. DESCRIPCIÓN DEL PRODUCTO SOFTWARE", 1)
    h(doc, "3.1 Descripción general", 2)
    U.parrafo(doc, "**TingoCargo** es un sistema web para gestionar el envío, el seguimiento y la entrega de paquetes de una empresa de transporte de Tingo María (Huánuco). Digitaliza el flujo logístico completo: distribuidoras y clientes registran envíos, los operadores logísticos los administran y asignan, los repartidores gestionan las entregas en campo y los destinatarios rastrean sus paquetes con un código de seguimiento (formato TM-AAAA-NNNN).")
    U.parrafo(doc, "Las principales capacidades son: registro de paquetes con cálculo automático de tarifa (S/ 10 hasta 2 kg), asignación de operador y repartidor, cambio de estado con línea de tiempo (En Almacén → En Tránsito → Entregado, o Intento fallido), reprogramación de entregas, cobro con tarjeta, Yape (Mercado Pago) o efectivo, emisión de boleta, contacto por llamada o WhatsApp, ubicación en Google Maps, reportes CSV/Excel, registro de actividad y un portal de autoservicio para clientes.")
    h(doc, "3.2 Usuarios y roles", 2)
    filas = [
        ("Administrador", "Control total: usuarios, sucursales, distribuidoras, clientes, paquetes, reportes y registro de actividad."),
        ("Operador logístico", "Registra paquetes y clientes, se autoasigna paquetes, asigna repartidores, marca salidas, asigna precios y registra pagos."),
        ("Repartidor", "Consulta «Mis entregas», confirma entregas, registra intentos fallidos y cobra en destino."),
        ("Cliente (registrado)", "Envía paquetes a otros clientes, paga sus envíos y consulta «Mis envíos»."),
        ("Visitante (sin cuenta)", "Rastrea un paquete con su código y reprograma la entrega tras un intento fallido."),
    ]
    U.tabla(doc, ["Rol", "Responsabilidades en el sistema"], filas, [3.6, 11.4], titulo="Usuarios y roles de TingoCargo", tam=9, primera_negrita=True)
    h(doc, "3.3 Arquitectura y tecnologías", 2)
    U.parrafo(doc, "El sistema sigue una arquitectura cliente-servidor de tres capas: una aplicación de página única (SPA) en React consume una API REST en Express, que persiste los datos en PostgreSQL. La capa de datos tiene dos implementaciones intercambiables con la misma interfaz: `storageDb.js` (PostgreSQL, usada en producción) y `storage.js` (memoria, usada en desarrollo y en las pruebas automatizadas). Desde el commit 8f7525a los teléfonos, documentos y direcciones se cifran con AES-256-GCM en PostgreSQL.")
    filas = [
        ("Frontend", "React / React DOM", "18.3.1", "Interfaz SPA basada en componentes"),
        ("Frontend", "React Router DOM", "^6.26.2 (instalada 6.30.3)", "Rutas y guardias de acceso por rol"),
        ("Frontend", "Tailwind CSS / Vite", "3.4 / 5.4", "Estilos responsivos; compilación y servidor de desarrollo"),
        ("Backend", "Node.js / Express", "18+ / 4.22.1", "API REST, autenticación por token y autorización por rol"),
        ("Backend", "bcryptjs, uuid, xlsx", "3.0 / 9.0 / 0.18", "Hash de contraseñas, identificadores, reportes Excel"),
        ("Datos", "PostgreSQL (Supabase) + pg", "14+ / 8.18", "Persistencia; cifrado AES-256-GCM de datos sensibles"),
        ("Integraciones", "Mercado Pago, API RENIEC, Google Maps, WhatsApp", "—", "Pagos con tarjeta/Yape, consulta de DNI, mapa y mensajería"),
        ("Despliegue", "Render (API, sitio estático, tareas cron)", "render.yaml", "Producción con USE_DB=true"),
    ]
    U.tabla(doc, ["Capa", "Tecnología", "Versión", "Uso"], filas, [2.3, 4.6, 3.3, 4.8], titulo="Tecnologías del producto", tam=8.5)
    h(doc, "3.4 Módulos funcionales", 2)
    filas = [
        ("Zona pública", "Inicio (/), Seguimiento (/seguimiento), resultado de pago", "Rastreo por código, línea de tiempo, reprogramación de la entrega."),
        ("Portal del cliente", "/cliente: registro, login, inicio, enviar paquete, mis envíos, detalle, rastrear", "Autoregistro, envío cliente → cliente, pago, seguimiento de sus envíos."),
        ("Panel administrativo", "/admin: dashboard, paquetes, detalle, usuarios, clientes, distribuidoras, sucursales, actividad", "Registro y despacho de paquetes, asignaciones, estados, pagos, contacto, mapa, catálogos, reportes y auditoría."),
    ]
    U.tabla(doc, ["Módulo", "Pantallas", "Funciones principales"], filas, [3.0, 6.0, 6.0], titulo="Módulos y pantallas del sistema", tam=8.5, primera_negrita=True)
    h(doc, "3.5 Versión y configuración evaluadas", 2)
    filas = [
        ("Repositorio", f"TingoCargo, rama main, commit {ctx['commit']} (último cambio: {ctx['fecha_commit']})"),
        ("Configuración de producción", "NODE_ENV=production, USE_DB=true, PostgreSQL 16.15 con sql/schema.sql y ajuste ensureComplianceSchema(); DATA_ENCRYPTION_KEY definida"),
        ("Configuración de referencia", "Mismo backend con USE_DB=false (almacenamiento en memoria)"),
        ("Frontend", "Vite 5.4 con VITE_API_BASE apuntando al backend con PostgreSQL"),
        ("Integraciones externas", "Sin credenciales de Mercado Pago ni de la API RENIEC: el pago con tarjeta/Yape y la consulta de DNI quedan fuera del alcance de ejecución"),
    ]
    U.tabla(doc, ["Elemento", "Detalle"], filas, [4.2, 10.8], titulo="Versión y configuración del producto evaluado", tam=9, primera_negrita=True)


def seccion_herramientas(doc, ctx):
    h(doc, "4. DESCRIPCIÓN DE LAS HERRAMIENTAS DE EVALUACIÓN", 1)
    h(doc, "4.1 Normas y modelo de referencia", 2)
    U.parrafo(doc, "**ISO/IEC 25010:2023** define la adecuación funcional como la capacidad de un producto para proporcionar funciones que satisfacen las necesidades declaradas e implícitas de los usuarios previstos cuando se usa en condiciones especificadas, y la descompone en completitud, corrección y pertinencia funcional. **ISO/IEC 25023:2016** operacionaliza esas subcaracterísticas en medidas cuantitativas con funciones de medición X = f(A, B). **ISO/IEC 25040** aporta el proceso de evaluación (establecer requisitos, especificar, diseñar, ejecutar y concluir).")
    h(doc, "4.2 Herramientas utilizadas", 2)
    filas = [
        ("Node.js + fetch", "22.23.4", "Ejecución de pruebas", "Ejecutor de los 81 casos de caja negra contra la API REST (casos_api.mjs), con tiempo límite de 6 s para detectar peticiones sin respuesta."),
        ("Google Chrome (sin interfaz) + puppeteer-core", "156 / 24.43", "Pruebas de interfaz", "Ejecución de los 9 casos de interfaz y captura de las evidencias de pantalla (casos_ui.mjs)."),
        ("PostgreSQL", "16.15", "Entorno", "Base de datos equivalente a la de producción (Supabase / PostgreSQL) creada con sql/schema.sql."),
        ("node:test", "Node 22", "Línea base", "Ejecución de la suite existente del proyecto (41 pruebas, npm test)."),
        ("curl", "8.x", "Verificación puntual", "Comprobación manual de endpoints para las observaciones del Anexo D."),
        ("Vite", "5.4.21", "Entorno", "Servidor del frontend conectado al backend con PostgreSQL."),
        ("Python + matplotlib", "3.12 / 3.11", "Análisis", "Cálculo de métricas, gráfico de radar, gráfico por función y diagrama de Ishikawa."),
        ("python-docx + LibreOffice", "1.2 / 24.2", "Informe", "Generación y verificación de este documento."),
        ("Git", "2.x", "Trazabilidad", "Identificación de la versión evaluada y del commit que introdujo el cifrado."),
    ]
    U.tabla(doc, ["Herramienta", "Versión", "Tipo", "Uso en la evaluación"], filas, [3.6, 2.0, 2.4, 7.0], titulo="Herramientas de evaluación", tam=8.5, primera_negrita=True)
    h(doc, "4.3 Instrumentos de evaluación", 2)
    filas = [
        ("Matriz de trazabilidad", "Relaciona cada función (RF/FD) con sus casos de prueba y con los objetivos de uso (secciones 5.1 a 5.3 y Anexo A)."),
        ("Catálogo de casos de prueba", "90 casos CP-01 a CP-90 con entrada, resultado esperado, resultado obtenido y veredicto (Anexo A)."),
        ("Fichas de defecto", "14 defectos D-01 a D-14 con severidad, evidencia, causa técnica y acción correctiva (Anexo C)."),
        ("Escenarios de objetivos de uso", "Tres escenarios (OE1, OE2, OE3) con las funciones requeridas para cada uno (sección 5.3)."),
        ("Scripts de evaluación", "evaluacion_adecuacion_funcional/: pruebas, resultados JSON, capturas y generador del informe."),
    ]
    U.tabla(doc, ["Instrumento", "Descripción"], filas, [4.2, 10.8], titulo="Instrumentos de evaluación", tam=9, primera_negrita=True)
    h(doc, "4.4 Entorno de evaluación", 2)
    filas = [
        ("Sistema operativo", "Ubuntu 24.04 LTS (máquina virtual de evaluación)"),
        ("Backend (producción)", "http://localhost:4100 — NODE_ENV=production, USE_DB=true, PostgreSQL 16.15"),
        ("Backend (referencia)", "http://localhost:4101 — NODE_ENV=production, USE_DB=false (memoria)"),
        ("Frontend", "http://127.0.0.1:5173 — Vite 5.4, VITE_API_BASE=http://127.0.0.1:4100"),
        ("Navegador", "Google Chrome 156 sin interfaz, ventana de 1280 × 800"),
        ("Datos de prueba", "Generados en cada ejecución por la API (sucursales, distribuidoras, clientes, usuarios por rol y paquetes); base de datos limpia antes de la corrida final"),
        ("Fecha de ejecución", ctx["fecha_ejecucion"]),
    ]
    U.tabla(doc, ["Elemento", "Detalle"], filas, [4.2, 10.8], titulo="Entorno de evaluación", tam=9, primera_negrita=True)
    h(doc, "4.5 Procedimiento de evaluación", 2)
    filas = [
        ("1. Establecer los requisitos de la evaluación", "Propósito, alcance (adecuación funcional), producto y configuración de producción.", "Secciones 1 a 3"),
        ("2. Especificar la evaluación", "Selección de medidas ISO/IEC 25023 (FCp-1-G, FCr-1-G, FAp-1-G, FAp-2-G) y criterios de decisión.", "Secciones 4.6 y 5"),
        ("3. Diseñar la evaluación", "Casos positivos y negativos por función derivados del SRS, la documentación, config.json y las reglas visibles en la interfaz; definición de tres objetivos de uso.", "Anexo A, sección 5.3"),
        ("4. Ejecutar la evaluación", "Ejecución automatizada en PostgreSQL y en memoria, pruebas de interfaz con Chrome y registro de evidencias.", "Anexos B y C"),
        ("5. Concluir la evaluación", "Cálculo de métricas, cuadro consolidado, análisis causal y acciones correctivas.", "Secciones 6 a 8"),
    ]
    U.tabla(doc, ["Etapa (ISO/IEC 25040)", "Actividades realizadas", "Producto"], filas, [4.6, 7.4, 3.0], titulo="Procedimiento de evaluación", tam=8.5)
    h(doc, "4.6 Criterios de decisión", 2)
    U.parrafo(doc, f"Antes de ejecutar las pruebas se fijó el criterio de conformidad para todas las métricas: **una métrica es CONFORME si X ≥ {D.UMBRAL:.2f}** y NO CONFORME en caso contrario. La Tabla {U.CONT.tabla + 1} detalla la escala de interpretación.")
    filas = [
        ("0.90 ≤ X ≤ 1.00", "Excelente", "Supera el nivel requerido", "CONFORME"),
        ("0.80 ≤ X < 0.90", "Aceptable", "Dentro del rango objetivo", "CONFORME"),
        ("0.50 ≤ X < 0.80", "Insuficiente", "Mínimamente aceptable; requiere acciones correctivas", "NO CONFORME"),
        ("0.00 ≤ X < 0.50", "Inaceptable", "Requiere rediseño de las funciones afectadas", "NO CONFORME"),
    ]
    U.tabla(doc, ["Rango", "Nivel", "Interpretación", "Estado"], filas, [3.2, 2.6, 6.2, 3.0], titulo="Escala de interpretación y umbral de conformidad", tam=9, alinear=["c", "c", None, "c"])
    U.parrafo(doc, "Reglas aplicadas a cada función:")
    U.vineta(doc, "**Implementada / faltante (M1.1):** una función está implementada si existe en la API y es accesible desde la interfaz para el rol previsto.")
    U.vineta(doc, "**Correcta / incorrecta (M2.1, M3.1):** una función es incorrecta si al menos uno de sus casos de prueba falla en la configuración de producción. El resultado esperado de cada caso se deriva del SRS, de la documentación del proyecto, de config.json o de las reglas que la propia interfaz aplica.")
    U.vineta(doc, "**Severidad de los defectos:** Alta (afecta datos, dinero o permisos, o deja la operación sin respuesta), Media (resultado incorrecto con alternativa manual) y Baja (detalle menor). Los hallazgos fuera del alcance funcional o de severidad baja se registran como **observaciones** (Anexo D) y no se contabilizan.")


def tabla_metrica(doc, titulo, fila):
    U.tabla(doc, ["ID", "Nombre", "Descripción", "Función de medición"], [fila], [1.8, 3.2, 4.4, 5.6], titulo=titulo, tam=9, alinear=["c", None, None, None], primera_negrita=True)


def seccion_evaluacion(doc, ctx):
    m = ctx["m"]
    pf = m["por_funcion"]
    h(doc, "5. EVALUACIÓN DE LAS SUBCARACTERÍSTICAS DE ADECUACIÓN FUNCIONAL", 1)
    U.parrafo(doc, "El núcleo del documento es la evaluación de las tres subcaracterísticas definidas en ISO/IEC 25010 y operacionalizadas según ISO/IEC 25023: completitud funcional, corrección funcional y pertinencia funcional.")

    # 5.1 Completitud
    h(doc, "5.1 Completitud funcional", 2)
    U.parrafo(doc, "**Definición (ISO/IEC 25010:2023).** Capacidad del producto para proporcionar un conjunto de funciones que cubre todas las tareas y objetivos especificados de los usuarios previstos.")
    tabla_metrica(doc, "Métrica M1.1 — Functional coverage (ISO/IEC 25023)", ("FCp-1-G", "Functional coverage (cobertura funcional)", "¿Qué proporción de las funciones especificadas ha sido implementada?", "X = 1 − A/B\nA = número de funciones faltantes\nB = número de funciones especificadas"))
    U.parrafo(doc, "**Procedimiento.** Para cada requisito del SRS se verificó la existencia del endpoint en el backend y de la pantalla o control que lo expone al rol previsto; la verificación se confirmó con la ejecución de sus casos de prueba (Anexo A).")
    filas = []
    for rid, (nombre, _, _) in D.RF.items():
        api, ui = D.IMPLEMENTACION[rid]
        filas.append((rid, nombre, api, ui, "Sí" if pf[rid]["implementada"] else "No"))
    U.tabla(doc, ["ID", "Requisito", "Implementación en la API", "Implementación en la interfaz", "Estado"], filas, [1.3, 3.2, 4.4, 4.6, 1.5], titulo="Verificación de implementación de los requisitos del SRS", tam=8.5, alinear=["c", None, None, None, "c"])
    a, b = len(m["faltantes"]), len(D.RF)
    U.formula(doc, f"A = {a}   B = {b}\nX = 1 − A/B = 1 − {a}/{b} = {m['m11']:.2f}  ({m['m11']:.0%})  →  {D.estado(m['m11'])}")
    U.parrafo(doc, f"**Resultado.** Los {b} requisitos especificados están implementados (A = {a}), por lo que M1.1 = {D.fmt(m['m11'])}, valor **{D.estado(m['m11'])}**. El producto cubre todas las funciones que exige su SRS. Cabe notar que el SRS no incluye funciones que sí forman parte del alcance documentado (sección 2.2); esas funciones se evalúan en la pertinencia funcional.")

    # 5.2 Corrección
    h(doc, "5.2 Corrección funcional", 2)
    U.parrafo(doc, "**Definición (ISO/IEC 25010:2023).** Capacidad del producto para proporcionar resultados precisos cuando lo utilizan los usuarios previstos.")
    tabla_metrica(doc, "Métrica M2.1 — Functional correctness (ISO/IEC 25023)", ("FCr-1-G", "Functional correctness (corrección funcional)", "¿Qué proporción de funciones proporciona el resultado correcto?", "X = 1 − A/B\nA = número de funciones incorrectas\nB = número de funciones consideradas"))
    r = m["resumen"]
    casos_rf = [c for c in ctx["casos"] if c["funcion"].startswith("RF")]
    U.parrafo(doc, f"**Procedimiento.** Se diseñaron casos de prueba positivos y negativos para cada requisito ({len(casos_rf)} casos para los 20 RF) y se ejecutaron en la configuración de producción. Cada caso compara el resultado obtenido con el esperado; una función es incorrecta si falla al menos uno de sus casos. La Tabla {U.CONT.tabla + 1} resume la ejecución y la Tabla {U.CONT.tabla + 2} los resultados por función.")
    filas = [
        ("PostgreSQL (producción)", str(r["pg_api"]), str(r["ui"]), str(r["pg_total"]), str(r["pg_pasan"]), str(r["pg_fallan"])),
        ("Memoria (referencia)", str(r["mem_total"]), "—", str(r["mem_total"]), str(r["mem_pasan"]), str(r["mem_fallan"])),
    ]
    U.tabla(doc, ["Configuración", "Casos API", "Casos interfaz", "Total", "Pasan", "Fallan"], filas, [4.4, 2.1, 2.3, 2.0, 2.1, 2.1], titulo="Resumen de la ejecución de los casos de prueba", tam=9, alinear=[None, "c", "c", "c", "c", "c"], primera_negrita=True)
    filas = []
    for rid, (nombre, _, _) in D.RF.items():
        d = pf[rid]
        filas.append((rid, nombre, D.rango(d["ids"]), str(len(d["ids"])), str(d["pasan"]), str(len(d["fallidos"])), ", ".join(d["fallidos"]) or "—", d["estado"]))
    U.tabla(doc, ["ID", "Requisito", "Casos", "N°", "Pasan", "Fallan", "Casos fallidos", "Resultado"], filas, [1.2, 3.3, 2.5, 0.9, 1.1, 1.1, 2.6, 2.3], titulo="Resultado de los casos de prueba por requisito (configuración de producción)", tam=8, alinear=["c", None, "c", "c", "c", "c", "c", "c"])
    U.figura(doc, GRAFICOS / "casos_por_funcion.png", "Casos de prueba que pasan y fallan por función (RF y FD) en la configuración de producción.", ancho_max=15.0, borde=False)
    filas = []
    for dft in D.DEFECTOS:
        if dft["funcion"].startswith("RF"):
            filas.append((dft["id"], dft["funcion"], dft["titulo"], ", ".join(dft["casos"]), dft["severidad"]))
    U.tabla(doc, ["Defecto", "Función", "Descripción", "Casos", "Severidad"], filas, [1.6, 1.5, 7.6, 2.3, 2.0], titulo="Defectos que hacen incorrectas a las funciones del SRS", tam=8.5, alinear=["c", "c", None, "c", "c"], fuente_nota="El detalle de cada defecto, con sus evidencias, está en el Anexo C.")
    a = len(m["incorrectas"])
    U.formula(doc, f"A = {a}  ({', '.join(m['incorrectas'])})   B = 20\nX = 1 − A/B = 1 − {a}/20 = {m['m21']:.2f}  ({m['m21']:.0%})  →  {D.estado(m['m21'])}")
    U.parrafo(doc, f"**Resultado.** Quince de los veinte requisitos producen resultados correctos en todos sus casos; cinco son incorrectos, por lo que M2.1 = {D.fmt(m['m21'])}, valor **{D.estado(m['m21'])}** (umbral {D.UMBRAL:.2f}). Las fallas no están en el flujo principal —registrar, despachar y entregar funcionan— sino en las reglas de negocio, los permisos y el tratamiento de datos duplicados o relacionados. En el modo memoria fallan los mismos cinco requisitos, de modo que M2.1 también sería 0.75; la diferencia es que en PostgreSQL varias de esas fallas dejan la petición sin respuesta en lugar de crear datos inconsistentes.")

    # 5.3 Pertinencia
    h(doc, "5.3 Pertinencia funcional", 2)
    U.parrafo(doc, "**Definición.** Capacidad del producto software para proporcionar un conjunto de funciones que facilitan la consecución de tareas y objetivos de usuario especificados.")
    U.parrafo(doc, "**¿Cómo evaluarlo?** Con las medidas M3.1 y M3.2 de ISO/IEC 25023: primero se calcula la pertinencia de cada objetivo de uso y luego la del sistema como promedio de los objetivos.")
    tabla_metrica(doc, "Métrica M3.1 — Functional appropriateness of usage objective (ISO/IEC 25023)", ("FAp-1-G", "Functional appropriateness of usage objective", "¿Qué proporción de las funciones requeridas por el usuario proporciona un resultado apropiado para alcanzar un objetivo de uso específico?", "X = 1 − A/B\nA = número de funciones faltantes o incorrectas entre las requeridas para el objetivo de uso\nB = número de funciones requeridas para el objetivo de uso"))
    U.nota(doc, "Nota 1 (ISO/IEC 25023): la medida se aplica a los objetivos de uso más importantes o frecuentes; se calcula para cada objetivo y luego se obtiene FAp-2-G para el sistema. Nota 2: puede complementarse con la proporción de objetivos de usuario que son alcanzables.")
    tabla_metrica(doc, "Métrica M3.2 — Functional appropriateness of system (ISO/IEC 25023)", ("FAp-2-G", "Functional appropriateness of system", "¿Qué proporción de las funciones requeridas por los usuarios para alcanzar sus objetivos proporciona un resultado apropiado?", "X = Σ Aᵢ / n   (i = 1 … n)\nAᵢ = puntaje de pertinencia del objetivo de uso i (valor de FAp-1-G)\nn = número de objetivos de uso"))

    h(doc, "5.3.1 Definición de los objetivos de uso específicos", 3)
    U.parrafo(doc, "Siguiendo el criterio del enunciado —por ejemplo, en un sistema de entrega de paquetes el objetivo de uso principal es realizar el despacho de un producto hasta que sea entregado al cliente—, se identificaron **tres objetivos de uso** propios de TingoCargo, alineados con su propósito y no con tareas administrativas secundarias (como registrar empleados o sucursales):")
    filas = [(oe["id"], oe["nombre"], oe["actor"], oe["justificacion"]) for oe in D.OBJETIVOS]
    U.tabla(doc, ["ID", "Objetivo de uso", "Actor", "Justificación"], filas, [1.2, 4.6, 3.0, 6.2], titulo="Objetivos de uso específicos de TingoCargo", tam=8.5, alinear=["c", None, None, None], primera_negrita=True)

    h(doc, "5.3.2 M3.1 Functional appropriateness of usage objective", 3)
    U.parrafo(doc, "Para cada objetivo se describió el escenario de uso, se identificaron las funciones requeridas para completarlo (del SRS y de la documentación) y se tomó el estado de cada función de la ejecución de sus casos de prueba.")
    for o in m["objetivos"]:
        p = U.parrafo(doc, f"**{o['id']} — {o['nombre']}.** Actor: {o['actor']}. Escenario: {o['escenario']}", despues=4)
        p.paragraph_format.keep_with_next = True
        filas = []
        for i, (fid, uso) in enumerate(o["funciones"], start=1):
            nombre = D.RF[fid][0] if fid in D.RF else D.FD[fid][0]
            d = pf[fid]
            filas.append((str(i), f"{fid} {nombre}", uso, ", ".join(d["fallidos"]) or "Ninguno", d["estado"]))
        U.tabla(doc, ["N°", "Función requerida", "Uso en el escenario", "Casos fallidos", "Estado"], filas, [0.8, 4.4, 5.0, 2.5, 2.3], titulo=f"Funciones requeridas para {o['id']} ({o['corto']})", tam=8.5, alinear=["c", None, None, "c", "c"])
        U.formula(doc, f"{o['x']} = Puntaje de {o['id']}:   A = {o['A']}   B = {o['B']}\n{o['x']} = 1 − {o['A']}/{o['B']} = {o['valor']:.2f}  ({o['valor']:.0%})  →  {D.estado(o['valor'])}")
    o1, o2, o3 = m["objetivos"]
    U.parrafo(doc, "Resumen de M3.1 por objetivo de uso:")
    for o in m["objetivos"]:
        U.vineta(doc, f"**{o['x']} = Puntaje de {o['id']} = {o['valor']:.2f}** — {o['nombre']} ({o['A']} de {o['B']} funciones requeridas son incorrectas: {', '.join(o['malas'])}).")

    h(doc, "5.3.3 M3.2 Functional appropriateness of system", 3)
    U.parrafo(doc, "La pertinencia funcional del sistema es el promedio de los puntajes de los tres objetivos de uso:")
    U.formula(doc, (
        f"X1 = Puntaje de OE1 = {o1['valor']:.2f}\n"
        f"X2 = Puntaje de OE2 = {o2['valor']:.2f}\n"
        f"X3 = Puntaje de OE3 = {o3['valor']:.2f}\n"
        f"X = (X1 + X2 + X3) / 3\n"
        f"X = ({o1['valor']:.2f} + {o2['valor']:.2f} + {o3['valor']:.2f}) / 3 = {m['m32']:.2f}  ({m['m32']:.0%})  →  {D.estado(m['m32'])}"
    ))
    U.parrafo(doc, f"**Resultado.** M3.2 = {D.fmt(m['m32'])}, valor **{D.estado(m['m32'])}**. Ninguno de los tres objetivos alcanza el umbral: el sistema permite completar los escenarios en su camino principal, pero entre 1 y 4 de las funciones requeridas en cada objetivo producen resultados inapropiados. El objetivo más afectado es OE3 (envío y pago por el cliente), cuyas funciones no están especificadas en el SRS.")


def seccion_consolidado(doc, ctx):
    m = ctx["m"]
    h(doc, "6. CUADRO CONSOLIDADO DE RESULTADOS", 1)
    U.parrafo(doc, "Como resultado de la evaluación se presenta el cuadro consolidado con la estructura base solicitada:")
    o1, o2, o3 = m["objetivos"]
    filas = [
        ("Completitud Funcional", "M1.1 Functional coverage", D.fmt(m["m11"]), D.estado(m["m11"])),
        ("Corrección Funcional", "M2.1 Functional correctness", D.fmt(m["m21"]), D.estado(m["m21"])),
        ("Pertinencia Funcional", f"M3.1 Functional appropriateness of usage objective — {o1['id']}: {o1['corto']} (X1)", D.fmt(o1["valor"]), D.estado(o1["valor"])),
        ("", f"M3.1 Functional appropriateness of usage objective — {o2['id']}: {o2['corto']} (X2)", D.fmt(o2["valor"]), D.estado(o2["valor"])),
        ("", f"M3.1 Functional appropriateness of usage objective — {o3['id']}: {o3['corto']} (X3)", D.fmt(o3["valor"]), D.estado(o3["valor"])),
        ("", "M3.2 Functional appropriateness of system", D.fmt(m["m32"]), D.estado(m["m32"])),
    ]
    t = U.tabla(doc, ["Subcaracterística", "Métrica ISO 25023", "Valor Obtenido", "Estado (Conforme / No Conforme)"], filas, [3.4, 6.4, 2.4, 2.8], titulo="Cuadro consolidado de resultados de la adecuación funcional", tam=9.5, alinear=[None, None, "c", "c"], primera_negrita=True, fuente_nota=f"Umbral de conformidad: X ≥ {D.UMBRAL:.2f}. Valores calculados con los {m['resumen']['pg_total']} casos ejecutados en la configuración de producción.")
    celda = t.cell(3, 0).merge(t.cell(6, 0))
    U.texto_celda(celda, "Pertinencia Funcional", negrita=True, tam=9.5)
    U.sombrear(celda, "FFFFFF")
    U.figura(doc, GRAFICOS / "radar.png", "Gráfico de radar de las métricas de adecuación funcional frente al umbral de conformidad (0.80).", ancho_max=13.0, borde=False)
    U.parrafo(doc, "El gráfico muestra que solo la completitud funcional supera el umbral; la corrección y los tres objetivos de pertinencia quedan dentro de la línea roja, con OE3 como el punto más bajo. La forma del polígono resume el diagnóstico: el producto tiene todas las funciones especificadas, pero no todas producen resultados correctos y apropiados.")


def seccion_analisis(doc, ctx):
    m = ctx["m"]
    h(doc, "7. ANÁLISIS DE RESULTADOS", 1)
    h(doc, "7.1 Análisis causal de fallas", 2)
    U.parrafo(doc, "A continuación se explica técnicamente por qué fallaron las métricas no conformes. Las referencias a archivos y líneas corresponden al commit evaluado.")
    U.parrafo(doc, f"**M2.1 Corrección funcional ({m['m21']:.2f}).** Cinco requisitos del SRS fallan por las siguientes causas:", despues=4)
    for texto in (
        "**RF-03 Actualización de estado (D-01).** PATCH /api/packages/:id/status (server.js, líneas 1249-1273) solo comprueba que el estado exista en config.json y, para el repartidor, que sea «Entregado» o «Intento fallido». No existe una tabla de transiciones válidas: es una **rama lógica no implementada**. La regla de negocio vive solo en la interfaz, que oculta los botones según el estado, y se evade llamando a la API.",
        "**RF-06 Gestión de usuarios (D-05, D-06, D-07).** POST /api/users no verifica emails duplicados y DELETE /api/users/:id no revisa dependencias. En PostgreSQL las restricciones UNIQUE y de llave foránea lanzan excepciones que los manejadores async de Express 4 no capturan («Promesa no controlada» en el log del servidor): la petición nunca responde. Además, AdminUserEdit.jsx (línea 57) expande el resultado de splitPhoneValue() —que devuelve {countryIso, number}— sobre un formulario que usa telefonoPais/telefonoNumero, por lo que el teléfono nunca se precarga; y getUserById (storageDb.js, líneas 362-365) no descifra el teléfono.",
        "**RF-08 Gestión de clientes (D-08).** POST /api/clients (server.js, líneas 961-989) no valida que el documento sea único y la tabla clientes no tiene restricción UNIQUE; con el cifrado AES-GCM de IV aleatorio, dos cifrados del mismo DNI son distintos, por lo que la base de datos tampoco puede impedir el duplicado.",
        "**RF-11 Asignación de operador (D-09).** La validación del operador solo se ejecuta cuando operadorId tiene valor (server.js, líneas 1075-1079); la rama operadorId = null y la reasignación de un paquete ajeno no se contemplaron.",
        "**RF-20 Control de acceso por rol (D-02, D-03, D-04).** La autorización se implementó como **lista de exclusión**: POST /api/packages solo rechaza al Repartidor (líneas 1131-1134) y PATCH /status solo restringe al Repartidor (líneas 1260-1268). Cuando se agregó el rol Cliente con el portal, heredó esos permisos. En el frontend, AdminLogin.jsx (líneas 40-44) envía a todo usuario interno a /admin y RequireRole (App.jsx, líneas 65-72) redirige a esa misma ruta, por lo que el repartidor ve una pantalla vacía.",
    ):
        U.vineta(doc, texto)
    o1, o2, o3 = m["objetivos"]
    U.parrafo(doc, f"**M3.1 y M3.2 Pertinencia funcional ({m['m32']:.2f}).** Las fallas de los objetivos de uso se explican así:", despues=4)
    for texto in (
        f"**OE1 ({o1['valor']:.2f}).** El camino feliz del despacho funciona, pero 4 de las 13 funciones requeridas (RF-03, RF-08, RF-11 y RF-20) no garantizan un resultado apropiado: un paquete puede entregarse sin salir del almacén o volver atrás después de entregado, cualquier cliente puede marcarlo como entregado, un operador puede desasignar a otro y el repartidor inicia sesión en una pantalla vacía.",
        f"**OE2 ({o2['valor']:.2f}).** La reprogramación (FD-05) no valida la fecha ni el rango horario (server.js, líneas 1276-1311 y 1316-1344) y, en producción, la fecha programada se muestra como «Invalid Date» porque PostgreSQL devuelve la columna DATE como marca de tiempo ISO (storageDb.js, línea 88) y el frontend le concatena «T12:00:00» (Tracking.jsx, línea 248).",
        f"**OE3 ({o3['valor']:.2f}).** Tres de las seis funciones del autoservicio fallan: el autoregistro no vincula al cliente existente porque getClientByDocumento compara regexp_replace sobre el texto cifrado (storageDb.js, líneas 260-271); el portal invoca POST /api/clients para agregar destinatarios, endpoint reservado a Administrador y Operador (server.js, líneas 961-964); y el pago en efectivo marca el envío como pagado sin cobro (server.js, líneas 702-709). Son funciones sin requisito en el SRS y sin pruebas: **falta de pruebas en la lógica de pagos**.",
    ):
        U.vineta(doc, texto)
    U.parrafo(doc, f"Las causas anteriores se agrupan en seis causas raíz (Tabla {U.CONT.tabla + 1} y Figura {U.CONT.figura + 1}):")
    filas = [
        ("C1", "Requisitos incompletos o mal especificados en el SRS", "El SRS no especifica pagos, reprogramación, autoregistro ni envíos cliente → cliente, ni reglas de transición de estados, unicidad de email/documento o criterios de aceptación.", "D-01, D-08, D-10 a D-14"),
        ("C2", "Reglas de negocio y ramas lógicas no implementadas", "Sin máquina de estados (server.js 1249-1273), sin validación de fechas (1276-1344), rama operadorId = null omitida (1075-1079) y efectivo marcado como pagado (702-709).", "D-01, D-09, D-12, D-13"),
        ("C3", "Autorización por lista de exclusión e inconsistencia frontend-backend", "Las rutas bloquean solo al Repartidor; el portal ofrece acciones que la API prohíbe y el login no redirige según el rol.", "D-02, D-03, D-04, D-07, D-11"),
        ("C4", "Regresión del cifrado en la capa PostgreSQL", "El commit 8f7525a cifró datos sensibles, pero getUserById, getClientByDocumento y getOperatorPhone no se adaptaron y DATE se serializa como timestamp.", "D-07, D-10, D-14"),
        ("C5", "Manejo de errores asíncronos ausente", "Express 4.22 no captura promesas rechazadas en manejadores async; los errores UNIQUE/FK de PostgreSQL no se traducen a 409.", "D-05, D-06"),
        ("C6", "Estrategia de pruebas insuficiente", "Las 41 pruebas automatizadas se ejecutan solo en memoria, sin casos negativos de permisos o transiciones ni pruebas de pagos; pasan al 100 % sin detectar ningún defecto.", "Todos"),
    ]
    U.tabla(doc, ["ID", "Causa raíz", "Evidencia técnica", "Defectos"], filas, [1.0, 3.8, 7.4, 2.8], titulo="Causas raíz de las fallas", tam=8.5, alinear=["c", None, None, "c"], primera_negrita=True)
    U.figura(doc, GRAFICOS / "ishikawa.png", "Diagrama de Ishikawa de las causas de las fallas de adecuación funcional.", ancho_max=15.5, borde=False)
    U.parrafo(doc, "La causa C6 explica por qué los defectos llegaron a la versión evaluada: la suite del proyecto pasa 41 de 41 pruebas (Anexo B) y la ficha exploratoria previa calificó la adecuación funcional con 5.00/5, pero ninguna de las dos ejecutaba el sistema en la configuración de producción ni probaba los caminos negativos. La medición con ISO/IEC 25023 y casos derivados de la especificación es la que hace visibles las fallas.")

    h(doc, "7.2 Propuesta de acciones correctivas", 2)
    U.parrafo(doc, "Se proponen las siguientes acciones técnicas de refactorización y mejora, priorizadas según la severidad de los defectos que corrigen:")
    U.tabla(doc, ["ID", "Corrige", "Acción correctiva", "Prioridad", "Mejora"], [list(a) for a in D.ACCIONES], [1.2, 2.2, 7.6, 1.7, 2.3], titulo="Acciones correctivas propuestas", tam=8.5, alinear=["c", "c", None, "c", None], primera_negrita=True)
    U.parrafo(doc, "Fragmentos de referencia para las acciones de mayor impacto:", despues=4)
    U.parrafo(doc, "**AC-01 — Máquina de estados en PATCH /api/packages/:id/status (server.js):**", despues=2)
    U.bloque(doc, 'const TRANSICIONES = {\n  "En Almacén": ["En Tránsito"],\n  "En Tránsito": ["Entregado", "Intento fallido"],\n  "Intento fallido": ["En Tránsito"],\n  "Entregado": []\n};\nconst actual = existing.estadoActual || existing.estado_actual;\nif (!TRANSICIONES[actual]?.includes(estado)) {\n  return res.status(409).json({ error: `No se puede pasar de «${actual}» a «${estado}»` });\n}')
    U.parrafo(doc, "**AC-02 — Autorización por lista de permitidos:**", despues=2)
    U.bloque(doc, 'const permitirRoles = (...roles) => (req, res, next) =>\n  roles.includes(req.authUser?.roleName)\n    ? next()\n    : res.status(403).json({ error: "No autorizado para esta acción" });\n\napp.post("/api/packages", permitirRoles("Administrador", "Operador logístico"), crearPaquete);\napp.patch("/api/packages/:id/status",\n  permitirRoles("Administrador", "Operador logístico", "Repartidor"), cambiarEstado);')
    U.parrafo(doc, "**AC-04 — Errores asíncronos y traducción de errores de PostgreSQL:**", despues=2)
    U.bloque(doc, 'const asyncHandler = (fn) => (req, res, next) =>\n  Promise.resolve(fn(req, res, next)).catch(next);\n\napp.use((err, req, res, _next) => {\n  if (err.code === "23505") return res.status(409).json({ error: "El registro ya existe" });\n  if (err.code === "23503") return res.status(409).json({ error: "Tiene registros relacionados" });\n  if (err.code === "22P02") return res.status(400).json({ error: "Identificador inválido" });\n  res.status(500).json({ error: "Error interno del servidor" });\n});')
    U.parrafo(doc, "**AC-05 y AC-08 — Capa de datos y frontend:**", despues=2)
    U.bloque(doc, '// storageDb.js: DATE como "AAAA-MM-DD" y teléfono descifrado\npg.types.setTypeParser(1082, (valor) => valor);\nexport const getUserById = async (id) => {\n  const { rows } = await query("SELECT * FROM usuarios WHERE id = $1", [id]);\n  return rows[0] ? { ...rows[0], telefono: decryptField(rows[0].telefono) } : null;\n};\n\n// AdminUserEdit.jsx: asignar el teléfono a los campos del formulario\nconst { countryIso, number } = splitPhoneValue(userData.telefono || "");\nsetForm((prev) => ({ ...prev, telefonoPais: countryIso, telefonoNumero: number }));')
    U.parrafo(doc, "**Impacto esperado.** Las acciones AC-01 a AC-10 son cambios localizados en el backend y en tres pantallas; corrigen los 14 defectos que hacen incorrectas a las nueve funciones afectadas. Tras aplicarlas y volver a ejecutar los 90 casos como pruebas de regresión, las cuatro métricas podrían alcanzar 1.00. AC-11 y AC-12 atacan las causas raíz C1 y C6 para que estos defectos no reaparezcan en versiones futuras.")


def seccion_conclusiones(doc, ctx):
    m = ctx["m"]
    o1, o2, o3 = m["objetivos"]
    h(doc, "8. CONCLUSIONES", 1)
    puntos = [
        f"**Completitud funcional — CONFORME ({m['m11']:.2f}).** Los 20 requisitos del SRS están implementados en la API y son accesibles desde la interfaz para el rol previsto: TingoCargo ofrece todas las funciones que especifica.",
        f"**Corrección funcional — NO CONFORME ({m['m21']:.2f}).** {m['resumen']['pg_fallan']} de los {m['resumen']['pg_total']} casos de prueba fallan y 5 de los 20 requisitos (RF-03, RF-06, RF-08, RF-11 y RF-20) producen resultados incorrectos en al menos un escenario. Los errores se concentran en reglas de negocio, permisos por rol y manejo de datos duplicados o relacionados, no en el camino principal.",
        f"**Pertinencia funcional — NO CONFORME.** X1 = {o1['valor']:.2f} (despacho hasta la entrega), X2 = {o2['valor']:.2f} (rastreo y reprogramación) y X3 = {o3['valor']:.2f} (envío y pago por el cliente); la pertinencia del sistema es M3.2 = {m['m32']:.2f}. El producto facilita las tareas principales, pero sus defectos comprometen la confiabilidad del resultado, sobre todo en el autoservicio del cliente.",
        "**Origen de las fallas.** Las causas son técnicas y corregibles: un SRS que omite pagos, reprogramación y el portal del cliente; reglas de negocio que solo existen en la interfaz; autorización por lista de exclusión; una regresión del cifrado en PostgreSQL y una estrategia de pruebas limitada al modo memoria, que pasaba al 100 % sin detectar ningún defecto.",
        "**Balance de madurez funcional frente a la norma.** TingoCargo se encuentra en un nivel de madurez funcional **intermedio**: es funcionalmente completo respecto de su especificación, pero todavía no alcanza el grado de corrección ni de pertinencia que ISO/IEC 25010 espera de un producto listo para producción. Con las acciones correctivas propuestas —en su mayoría cambios localizados— y la incorporación de los 90 casos como pruebas de regresión en ambas configuraciones, el producto puede alcanzar la conformidad en una nueva evaluación.",
        "**Valor de la medición.** El contraste con la ficha exploratoria previa (5.00/5 en adecuación funcional) muestra que la percepción del equipo sobrestimaba la calidad funcional; las medidas de ISO/IEC 25023, basadas en funciones especificadas, objetivos de uso y casos de prueba ejecutados, ofrecen un diagnóstico objetivo y verificable.",
    ]
    for i, texto in enumerate(puntos, start=1):
        U.numerado(doc, f"{i}.", texto)


def seccion_referencias(doc):
    h(doc, "9. REFERENCIAS", 1)
    for ref in (
        "ISO/IEC 25010:2023. Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model. Ginebra: ISO.",
        "ISO/IEC 25023:2016. Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Measurement of system and software product quality. Ginebra: ISO.",
        "ISO/IEC 25040:2011. Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Evaluation process. Ginebra: ISO.",
        "Schulzrinne, H. (2004). RFC 3966: The tel URI for Telephone Numbers. IETF.",
        "OpenJS Foundation. Express — Error handling (Guía de Express 4 y 5). https://expressjs.com/en/guide/error-handling.html",
        "Equipo TingoCargo (2026). DOCUMENTACION_PROYECTO.md, requisitos_funcionales.rtf, requisitos_no_funcionales.csv, casos_prueba_metodos.csv y código fuente del repositorio.",
    ):
        p = U.parrafo(doc, ref, despues=4)
        p.paragraph_format.left_indent = Cm(0.8)
        p.paragraph_format.first_line_indent = Cm(-0.8)


# ───────────────────────────── Anexos ─────────────────────────────


def anexo_matriz(doc, ctx):
    U.nueva_seccion(doc, horizontal=True)
    h(doc, "ANEXO A. MATRIZ DE CASOS DE PRUEBA Y RESULTADOS", 1)
    U.parrafo(doc, "Resultado de los 90 casos de prueba. «PG» es la configuración de producción (PostgreSQL) y «Mem.» el modo memoria (solo casos de API; «—» indica un caso de interfaz). El resultado obtenido corresponde a PostgreSQL.")
    filas = []
    for c in ctx["casos"]:
        mem = ctx["estado_memoria"].get(c["id"])
        obt = c["obtenido"] + (f" ({c['nota']})" if c.get("nota") else "")
        filas.append((c["id"], c["funcion"], c["tipo"], c["titulo"], c["esperado"], obt, "PASA" if c["pasa"] else "FALLA", "—" if mem is None else ("PASA" if mem else "FALLA")))
    U.tabla(doc, ["ID", "Función", "Tipo", "Caso de prueba", "Resultado esperado", "Resultado obtenido (PostgreSQL)", "PG", "Mem."], filas, [1.3, 1.3, 1.5, 5.0, 5.6, 7.0, 1.5, 1.5], titulo="Matriz de casos de prueba (CP-01 a CP-90)", tam=7.5, alinear=["c", "c", "c", None, None, None, "c", "c"])
    U.nueva_seccion(doc, horizontal=False)


def anexo_ejecucion(doc, ctx):
    h(doc, "ANEXO B. EVIDENCIAS DE EJECUCIÓN", 1)
    h(doc, "B.1 Ejecución automatizada de las pruebas", 2)
    U.parrafo(doc, "Salidas reales de consola de la ejecución (capturadas como imagen). Los archivos de texto completos están en evaluacion_adecuacion_funcional/resultados/.")
    for archivo, titulo in (
        ("T04_api_postgresql_matriz.png", "Ejecución de los 81 casos de API en la configuración de producción (PostgreSQL): resumen de veredictos."),
        ("T05_ui_postgresql.png", "Ejecución de los 9 casos de interfaz con Google Chrome sobre el backend con PostgreSQL."),
        ("T02_api_postgresql_fallas.png", "Casos de API que fallan en PostgreSQL, con resultado esperado y obtenido."),
        ("T03_api_memoria_fallas.png", "Casos de API que fallan en el modo memoria (configuración de referencia)."),
        ("T01_suite_existente.png", "Suite automatizada existente del proyecto (npm test): 41 de 41 pruebas pasan en modo memoria sin detectar los defectos."),
    ):
        U.figura(doc, CAP / archivo, titulo, carpeta_opt=OPTIMIZADAS, alto_max=17.2)
    h(doc, "B.2 Capturas de funcionamiento por función", 2)
    U.parrafo(doc, "Capturas de la interfaz tomadas durante la ejecución que evidencian el funcionamiento correcto de las funciones evaluadas.")
    titulos = {c["archivo"]: c["titulo"] for c in ctx["ui"]["capturas"]}
    for archivo in (
        "E01_inicio_publico.png", "E02_seguimiento_publico.png", "E03_login_panel.png", "E04_dashboard_operador.png",
        "E05_registro_paquete_formulario.png", "E05b_registro_paquete_creado.png", "E06_detalle_paquete.png", "E07_acciones_llamar.png",
        "E10_google_maps.png", "E08_intento_fallido_modal.png", "E08b_intento_fallido_registrado.png", "E09_mis_entregas_repartidor.png",
        "E11_paquetes_reporte.png", "E12_usuarios.png", "E13_clientes.png", "E14_distribuidoras.png", "E15_sucursales.png",
        "E16_portal_mis_envios.png", "E17_portal_enviar_paquete.png", "E18a_seguimiento_intento_fallido.png", "E18_reprogramar_modal.png",
    ):
        ancho = 9.0 if archivo == "E07_acciones_llamar.png" else 15.0
        U.figura(doc, CAP / archivo, titulos.get(archivo, archivo), ancho_max=ancho, carpeta_opt=OPTIMIZADAS)


def anexo_defectos(doc, ctx):
    h(doc, "ANEXO C. EVIDENCIAS DE DEFECTOS ENCONTRADOS", 1)
    U.parrafo(doc, f"Se registraron {len(D.DEFECTOS)} defectos. Cada ficha resume el defecto y se acompaña de capturas de pantalla o salidas de consola obtenidas en la ejecución.")
    resumen = [(d["id"], d["funcion"], d["titulo"], ", ".join(d["casos"]), d["config"], d["severidad"]) for d in D.DEFECTOS]
    U.tabla(doc, ["ID", "Función", "Defecto", "Casos", "Configuración", "Severidad"], resumen, [1.3, 1.4, 5.4, 1.9, 3.1, 1.9], titulo="Resumen de defectos encontrados", tam=8, alinear=["c", "c", None, "c", None, "c"])
    titulos = {c["archivo"]: c["titulo"] for c in ctx["ui"]["capturas"]}
    titulos.update({
        "T06_log_servidor.png": "Log del servidor con PostgreSQL: las excepciones UNIQUE y de llave foránea quedan como «Promesa no controlada» y la petición nunca responde.",
        "T08_dni_duplicado.png": "Dos clientes registrados con el mismo DNI (CP-29).",
    })
    for d in D.DEFECTOS:
        doc.add_heading(f"{d['id']} · {d['titulo']} ({d['funcion']})", level=3)
        filas = [
            ("Función afectada", f"{d['funcion']} — {D.RF[d['funcion']][0] if d['funcion'] in D.RF else D.FD[d['funcion']][0]}"),
            ("Severidad", d["severidad"]),
            ("Casos de prueba", ", ".join(d["casos"])),
            ("Configuración", d["config"]),
            ("Descripción", d["descripcion"]),
            ("Resultado esperado", d["esperado"]),
            ("Resultado obtenido", d["obtenido"]),
            ("Causa técnica", d["causa"]),
            ("Acción correctiva", d["accion"]),
        ]
        t = doc.add_table(rows=len(filas), cols=2)
        U.bordes(t)
        U.margenes_celda(t)
        for i, (k, v) in enumerate(filas):
            U.texto_celda(t.rows[i].cells[0], k, negrita=True, tam=8.5, color="FFFFFF")
            U.sombrear(t.rows[i].cells[0], U.AZUL)
            U.texto_celda(t.rows[i].cells[1], v, tam=8.5)
            U.no_dividir(t.rows[i])
        U.anchos(t, [3.4, 11.6])
        for archivo in d["evidencias"]:
            ancho = 7.0 if archivo in ("D04_retroceso_entregado.png", "D05_entrega_sin_transito.png", "D11c_panel_pago_registrado.png") else 14.0
            if archivo == "D14_fecha_reprogramada_invalida.png":
                ancho = 11.0
            U.figura(doc, CAP / archivo, titulos.get(archivo, archivo), ancho_max=ancho, carpeta_opt=OPTIMIZADAS, alto_max=17.5)


def anexo_observaciones(doc, ctx):
    h(doc, "ANEXO D. OBSERVACIONES ADICIONALES (NO CONTABILIZADAS)", 1)
    U.parrafo(doc, "Hallazgos de severidad baja o que pertenecen a otras características de ISO/IEC 25010 (marcadas con *). No modifican las métricas de adecuación funcional, pero se recomienda atenderlos.")
    filas = [(o[0], o[1], o[2], o[3]) for o in D.OBSERVACIONES]
    U.tabla(doc, ["ID", "Ámbito", "Observación", "Recomendación"], filas, [1.3, 2.2, 7.3, 4.2], titulo="Observaciones adicionales", tam=8.5, alinear=["c", "c", None, None])
    U.figura(doc, CAP / "T07_observaciones.png", "Verificación con curl de las observaciones OB-01, OB-02, OB-05 y OB-06 en la configuración de producción.", carpeta_opt=OPTIMIZADAS)


def anexo_reproduccion(doc, ctx):
    h(doc, "ANEXO E. REPRODUCCIÓN DE LA EVALUACIÓN", 1)
    U.parrafo(doc, "Todos los artefactos de la evaluación están versionados en la carpeta evaluacion_adecuacion_funcional/ del repositorio:")
    filas = [
        ("pruebas/casos_api.mjs", "81 casos de prueba de caja negra contra la API (CP-01 a CP-90, excepto los de interfaz)."),
        ("pruebas/casos_ui.mjs", "9 casos de interfaz con Chrome y captura de evidencias."),
        ("pruebas/capturas_terminal.py, render_html.mjs", "Conversión de las salidas de consola en imágenes."),
        ("resultados/*.json, *.txt", "Resultados por caso (JSON) y salidas completas de consola."),
        ("capturas/*.png", "Capturas de pantalla y de consola usadas en los anexos."),
        ("informe/*.py, graficos/", "Cálculo de métricas, gráficos y generación de este documento."),
    ]
    U.tabla(doc, ["Archivo", "Contenido"], filas, [5.4, 9.6], titulo="Artefactos de la evaluación", tam=8.5, primera_negrita=True)
    U.parrafo(doc, "Comandos para repetir la evaluación (Ubuntu con Node.js 22, PostgreSQL 16 y Google Chrome):", despues=3)
    U.bloque(doc, "# 1. Base de datos equivalente a producción\nsudo service postgresql start\ncreatedb tingocargo_eval\npsql -d tingocargo_eval -f sql/schema.sql\n\n# 2. Backend con PostgreSQL (puerto 4100)\ncd backend && npm install\nNODE_ENV=production PORT=4100 USE_DB=true \\\n  DATABASE_URL=postgresql://usuario:clave@127.0.0.1:5432/tingocargo_eval \\\n  DATA_ENCRYPTION_KEY=clave-evaluacion \\\n  node src/server.js\n\n# 3. Backend en memoria (puerto 4101), en otra terminal\nNODE_ENV=production PORT=4101 USE_DB=false \\\n  node src/server.js\n\n# 4. Frontend conectado al backend con PostgreSQL\ncd frontend && npm install\nVITE_API_BASE=http://127.0.0.1:4100 \\\n  npx vite --port 5173\n\n# 5. Ejecución de la evaluación y generación del informe\ncd evaluacion_adecuacion_funcional && npm install\nnpm run api:memoria\nnpm run api:postgresql\nnpm run ui\npython3 pruebas/capturas_terminal.py\ncd informe && python3 generar_informe.py")


# ───────────────────────────── Construcción y paginación ─────────────────────────────


def construir(ctx, paginas):
    TITULOS.clear()
    U.CONT.tabla = 0
    U.CONT.figura = 0
    doc = preparar_documento()
    encabezado_y_pie(doc)
    portada(doc, ctx)
    pagina_indice(doc, ctx.get("titulos_previos", []), paginas)
    seccion_introduccion(doc, ctx)
    seccion_artefactos(doc, ctx)
    seccion_producto(doc, ctx)
    seccion_herramientas(doc, ctx)
    seccion_evaluacion(doc, ctx)
    seccion_consolidado(doc, ctx)
    seccion_analisis(doc, ctx)
    seccion_conclusiones(doc, ctx)
    seccion_referencias(doc)
    anexo_matriz(doc, ctx)
    anexo_ejecucion(doc, ctx)
    anexo_defectos(doc, ctx)
    anexo_observaciones(doc, ctx)
    anexo_reproduccion(doc, ctx)
    settings = doc.settings.element
    actualizar = OxmlElement("w:updateFields")
    actualizar.set(qn("w:val"), "true")
    settings.append(actualizar)
    return doc


def a_pdf(docx: Path, carpeta: Path) -> Path:
    subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(carpeta), str(docx)], check=True, capture_output=True, timeout=300)
    return carpeta / (docx.stem + ".pdf")


def paginas_de_titulos(pdf: Path, titulos):
    texto = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], check=True, capture_output=True, text=True).stdout
    paginas = texto.split("\f")
    norm = lambda s: re.sub(r"\s+", " ", s).strip()
    lineas = [[norm(l) for l in pag.split("\n")] for pag in paginas]
    inicio = next(i for i, ls in enumerate(lineas) if "1. INTRODUCCIÓN" in ls)
    resultado, desde = {}, inicio
    for _, titulo in titulos:
        objetivo = norm(titulo)
        for i in range(desde, len(lineas)):
            if objetivo in lineas[i] or any(l.startswith(objetivo) for l in lineas[i] if len(l) <= len(objetivo) + 2):
                resultado[titulo] = i + 1
                desde = i
                break
            texto_pagina = " ".join(lineas[i])
            if len(objetivo) > 40 and objetivo in texto_pagina:
                resultado[titulo] = i + 1
                desde = i
                break
    return resultado, len(paginas) - (1 if not paginas[-1].strip() else 0)


def main():
    datos = D.cargar()
    m = D.calcular(datos)
    esperadas = {"RF-03", "RF-06", "RF-08", "RF-11", "RF-20"}
    if set(m["incorrectas"]) != esperadas:
        sys.exit(f"Los resultados cambiaron ({m['incorrectas']}); revise el texto del análisis antes de generar.")
    commit = subprocess.run(["git", "-C", str(REPO), "log", "-1", "--format=%h|%cd", "--date=format:%d/%m/%Y"], capture_output=True, text=True).stdout.strip()
    sha, fecha_commit = (commit.split("|") + [""])[:2]
    base = subprocess.run(["git", "-C", str(REPO), "rev-parse", "--short", "0f66c6e"], capture_output=True, text=True).stdout.strip() or sha
    _, fecha_ejec = fecha_lima(datos["ui"]["fecha"])
    dt, _ = fecha_lima(datos["pg"]["fecha"])
    ctx = {
        "m": m,
        "casos": datos["casos"],
        "ui": datos["ui"],
        "estado_memoria": datos["estado_memoria"],
        "commit": base,
        "fecha_commit": "18/11/2026",
        "fecha_ejecucion": fecha_ejec,
        "fecha_ejecucion_corta": f"{dt.day} de {MESES[dt.month - 1]} de {dt.year}",
    }
    GRAFICOS.mkdir(exist_ok=True)
    o = m["objetivos"]
    metricas = [("M1.1\nCompletitud", m["m11"]), ("M2.1\nCorrección", m["m21"])] + [(f"M3.1 · {x['id']}\n{x['corto']}", x["valor"]) for x in o] + [("M3.2\nPertinencia\ndel sistema", m["m32"])]
    G.radar(metricas, GRAFICOS / "radar.png")
    G.barras_funciones(m["por_funcion"], GRAFICOS / "casos_por_funcion.png")
    G.ishikawa(GRAFICOS / "ishikawa.png")

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        doc = construir(ctx, {})
        ctx["titulos_previos"] = list(TITULOS)
        borrador = tmp / "borrador.docx"
        construir(ctx, {t: 0 for _, t in TITULOS}).save(borrador)
        paginas, total = paginas_de_titulos(a_pdf(borrador, tmp), ctx["titulos_previos"])
        doc = construir(ctx, paginas)
        doc.save(SALIDA)
        final_pdf = a_pdf(SALIDA, tmp)
        paginas2, total2 = paginas_de_titulos(final_pdf, ctx["titulos_previos"])
        if paginas2 != paginas:
            doc = construir(ctx, paginas2)
            doc.save(SALIDA)
            final_pdf = a_pdf(SALIDA, tmp)
            paginas2, total2 = paginas_de_titulos(final_pdf, ctx["titulos_previos"])
        shutil.copy(final_pdf, EVAL / "resultados" / "vista_previa_informe.pdf")
    faltan = [t for _, t in ctx["titulos_previos"] if t not in paginas2]
    print(f"Documento: {SALIDA.relative_to(REPO)}  ({total2} páginas en LibreOffice)")
    print(f"M1.1={m['m11']:.2f} M2.1={m['m21']:.2f} " + " ".join(f"{x['id']}={x['valor']:.2f}" for x in o) + f" M3.2={m['m32']:.2f}")
    if faltan:
        print("Títulos no ubicados en el PDF:", faltan)


if __name__ == "__main__":
    main()
