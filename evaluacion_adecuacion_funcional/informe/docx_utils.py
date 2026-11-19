"""
Utilidades de formato para python-docx: tablas con estilo, celdas de estado,
figuras, bloques de código, fórmulas, campos (página, índice) y secciones.
"""

import re
from pathlib import Path

from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from PIL import Image

AZUL = "1F4E79"
AZUL_OSCURO = "002060"
GRIS_TEXTO = "404040"
FILA_PAR = "F3F6FA"

ESTADOS = {
    "CONFORME": ("E8F5E9", "1B5E20"),
    "NO CONFORME": ("FDECEA", "B71C1C"),
    "Correcta": ("E8F5E9", "1B5E20"),
    "Incorrecta": ("FDECEA", "B71C1C"),
    "Faltante": ("FDECEA", "B71C1C"),
    "PASA": ("E8F5E9", "1B5E20"),
    "FALLA": ("FDECEA", "B71C1C"),
    "Sí": ("E8F5E9", "1B5E20"),
    "No": ("FDECEA", "B71C1C"),
    "Alta": ("FDECEA", "B71C1C"),
    "Media": ("FFF4E5", "8A4B00"),
    "Baja": ("F1F5F9", "334155"),
}


class Contadores:
    def __init__(self):
        self.tabla = 0
        self.figura = 0


CONT = Contadores()


def sombrear(celda, color):
    tc_pr = celda._tc.get_or_add_tcPr()
    for viejo in tc_pr.findall(qn("w:shd")):
        tc_pr.remove(viejo)
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color)
    tc_pr.append(shd)


def margenes_celda(tabla, sup=50, inf=50, izq=80, der=80):
    tbl_pr = tabla._tbl.tblPr
    mar = OxmlElement("w:tblCellMar")
    for lado, valor in (("top", sup), ("left", izq), ("bottom", inf), ("right", der)):
        el = OxmlElement(f"w:{lado}")
        el.set(qn("w:w"), str(valor))
        el.set(qn("w:type"), "dxa")
        mar.append(el)
    tbl_pr.append(mar)


def bordes(tabla, color="BFC9D6", sz=4):
    tbl_pr = tabla._tbl.tblPr
    caja = OxmlElement("w:tblBorders")
    for lado in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{lado}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(sz))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)
        caja.append(el)
    tbl_pr.append(caja)


def anchos(tabla, cms):
    tabla.autofit = False
    tbl_pr = tabla._tbl.tblPr
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    tbl_pr.append(layout)
    total = OxmlElement("w:tblW")
    total.set(qn("w:w"), str(int(sum(cms) * 567)))
    total.set(qn("w:type"), "dxa")
    for viejo in tbl_pr.findall(qn("w:tblW")):
        tbl_pr.remove(viejo)
    tbl_pr.append(total)
    grid = tabla._tbl.tblGrid
    for i, col in enumerate(grid.findall(qn("w:gridCol"))):
        if i < len(cms):
            col.set(qn("w:w"), str(int(cms[i] * 567)))
    for fila in tabla.rows:
        for i, celda in enumerate(fila.cells):
            if i < len(cms):
                celda.width = Cm(cms[i])


def encabezado_repetido(fila):
    tr_pr = fila._tr.get_or_add_trPr()
    el = OxmlElement("w:tblHeader")
    el.set(qn("w:val"), "true")
    tr_pr.append(el)


def no_dividir(fila):
    tr_pr = fila._tr.get_or_add_trPr()
    tr_pr.append(OxmlElement("w:cantSplit"))


def runs_con_formato(parrafo, texto, tam=None, color=None, negrita=False, cursiva=False, fuente=None):
    """Agrega texto con marcas simples: **negrita** y `código`."""
    partes = re.split(r"(\*\*.+?\*\*|`.+?`)", texto)
    for parte in partes:
        if not parte:
            continue
        es_negrita = parte.startswith("**") and parte.endswith("**")
        es_codigo = parte.startswith("`") and parte.endswith("`")
        contenido = parte[2:-2] if es_negrita else parte[1:-1] if es_codigo else parte
        # Corta solo las cadenas largas (rutas y nombres de archivo) en _ / . -
        contenido = re.sub(
            r"\S{22,}",
            lambda m: re.sub(r"([_/.\\-])(?=\S)", lambda n: n.group(1) + "\u200b", m.group(0)),
            contenido,
        )
        lineas = contenido.split("\n")
        for i, linea in enumerate(lineas):
            run = parrafo.add_run(linea)
            run.bold = negrita or es_negrita
            run.italic = cursiva
            if tam:
                run.font.size = Pt(tam)
            if color:
                run.font.color.rgb = RGBColor.from_string(color)
            if es_codigo or fuente:
                run.font.name = "Consolas" if es_codigo else fuente
                run._element.rPr.rFonts.set(qn("w:eastAsia"), run.font.name)
                if es_codigo and tam:
                    run.font.size = Pt(tam - 0.5)
            if i < len(lineas) - 1:
                run.add_break()
    return parrafo


def texto_celda(celda, texto, negrita=False, tam=9, color=None, alinear=None, cursiva=False):
    celda.text = ""
    p = celda.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.0
    if alinear == "c":
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    elif alinear == "d":
        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    else:
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    estado = ESTADOS.get(str(texto).strip())
    if estado and not negrita:
        sombrear(celda, estado[0])
        runs_con_formato(p, str(texto), tam=tam, color=estado[1], negrita=True)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    else:
        runs_con_formato(p, str(texto), tam=tam, color=color, negrita=negrita, cursiva=cursiva)
    celda.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def leyenda_tabla(doc, titulo):
    CONT.tabla += 1
    p = doc.add_paragraph(style="Caption")
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run(f"Tabla {CONT.tabla}. ")
    r.bold = True
    runs_con_formato(p, titulo)
    return CONT.tabla


def tabla(doc, encabezados, filas, cms, titulo=None, tam=9, alinear=None, fuente_nota=None, primera_negrita=False):
    if titulo:
        leyenda_tabla(doc, titulo)
    t = doc.add_table(rows=1 + len(filas), cols=len(encabezados))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    bordes(t)
    margenes_celda(t)
    for i, enc in enumerate(encabezados):
        c = t.rows[0].cells[i]
        texto_celda(c, enc, negrita=True, tam=tam, color="FFFFFF", alinear="c")
        sombrear(c, AZUL)
    encabezado_repetido(t.rows[0])
    for r, fila in enumerate(filas, start=1):
        no_dividir(t.rows[r])
        for i, valor in enumerate(fila):
            c = t.rows[r].cells[i]
            al = alinear[i] if alinear else None
            texto_celda(c, valor, tam=tam, alinear=al, negrita=(primera_negrita and i == 0))
            if r % 2 == 0 and str(valor).strip() not in ESTADOS:
                sombrear(c, FILA_PAR)
    anchos(t, cms)
    if fuente_nota:
        nota(doc, fuente_nota)
    else:
        espacio(doc, 4)
    return t


def nota(doc, texto):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(8)
    runs_con_formato(p, texto, tam=8.5, color="595959", cursiva=True)
    return p


def espacio(doc, puntos=6):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = Pt(puntos)
    return p


def parrafo(doc, texto, justificar=True, tam=None, color=None, negrita=False, cursiva=False, sangria=None, despues=6):
    p = doc.add_paragraph()
    if justificar:
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_after = Pt(despues)
    if sangria is not None:
        p.paragraph_format.left_indent = Cm(sangria)
    runs_con_formato(p, texto, tam=tam, color=color, negrita=negrita, cursiva=cursiva)
    return p


def vineta(doc, texto, nivel=0):
    p = doc.add_paragraph(style="List Bullet" if nivel == 0 else "List Bullet 2")
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.space_after = Pt(3)
    runs_con_formato(p, texto)
    return p


def numerado(doc, numero, texto, sangria=0.6):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.left_indent = Cm(sangria)
    p.paragraph_format.first_line_indent = Cm(-sangria)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(f"{numero}\t")
    r.bold = True
    p.paragraph_format.tab_stops.add_tab_stop(Cm(sangria))
    runs_con_formato(p, texto)
    return p


def imagen_optimizada(ruta: Path, carpeta: Path) -> Path:
    if ruta.suffix.lower() != ".png" or ruta.stat().st_size < 380_000:
        return ruta
    carpeta.mkdir(parents=True, exist_ok=True)
    destino = carpeta / (ruta.stem + ".jpg")
    if not destino.exists() or destino.stat().st_mtime < ruta.stat().st_mtime:
        Image.open(ruta).convert("RGB").save(destino, "JPEG", quality=86, optimize=True)
    return destino


def figura(doc, ruta: Path, titulo, ancho_max=15.0, alto_max=19.5, carpeta_opt=None, borde=True):
    ruta = imagen_optimizada(ruta, carpeta_opt) if carpeta_opt else ruta
    with Image.open(ruta) as im:
        w, h = im.size
    ancho = ancho_max
    if ancho * h / w > alto_max:
        ancho = alto_max * w / h
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.keep_with_next = True
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run()
    imagen = run.add_picture(str(ruta), width=Cm(ancho))
    if borde:
        pic = imagen._inline.graphic.graphicData.pic
        sp_pr = pic.spPr
        ln = OxmlElement("a:ln")
        ln.set("w", "6350")
        relleno = OxmlElement("a:solidFill")
        color = OxmlElement("a:srgbClr")
        color.set("val", "BFC9D6")
        relleno.append(color)
        ln.append(relleno)
        sp_pr.append(ln)
    CONT.figura += 1
    c = doc.add_paragraph(style="Caption")
    c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    c.paragraph_format.space_after = Pt(10)
    r = c.add_run(f"Figura {CONT.figura}. ")
    r.bold = True
    runs_con_formato(c, titulo)
    return CONT.figura


def bloque(doc, texto, fondo="F4F6F8", fuente="Consolas", tam=8.5, color="1E293B", centrado=False, borde="D0D7DE"):
    t = doc.add_table(rows=1, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    bordes(t, color=borde, sz=4)
    margenes_celda(t, 90, 90, 140, 140)
    c = t.rows[0].cells[0]
    sombrear(c, fondo)
    c.text = ""
    p = c.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if centrado else WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.0
    lineas = texto.split("\n")
    for i, linea in enumerate(lineas):
        run = p.add_run(linea)
        run.font.name = fuente
        run._element.rPr.rFonts.set(qn("w:eastAsia"), fuente)
        run.font.size = Pt(tam)
        run.font.color.rgb = RGBColor.from_string(color)
        if i < len(lineas) - 1:
            run.add_break()
    anchos(t, [15.0])
    no_dividir(t.rows[0])
    espacio(doc, 6)
    return t


def formula(doc, texto):
    return bloque(doc, texto, fondo="EAF1FB", fuente="Cambria Math", tam=12, color=AZUL_OSCURO, centrado=True, borde="9DB7D5")


def salto_pagina(doc):
    p = doc.add_paragraph()
    p.add_run().add_break(WD_BREAK.PAGE)


def agregar_campo(parrafo, instruccion, texto="1"):
    r1 = parrafo.add_run()
    f1 = OxmlElement("w:fldChar")
    f1.set(qn("w:fldCharType"), "begin")
    r1._r.append(f1)
    r2 = parrafo.add_run()
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = f" {instruccion} "
    r2._r.append(instr)
    r3 = parrafo.add_run()
    f3 = OxmlElement("w:fldChar")
    f3.set(qn("w:fldCharType"), "separate")
    r3._r.append(f3)
    r4 = parrafo.add_run(texto)
    r5 = parrafo.add_run()
    f5 = OxmlElement("w:fldChar")
    f5.set(qn("w:fldCharType"), "end")
    r5._r.append(f5)
    return [r1, r2, r3, r4, r5]


def indice(doc, entradas, ancho_cm=15.0):
    """Inserta un campo TOC con su resultado precalculado (nivel, texto, página)."""
    for i, (nivel, texto, pagina) in enumerate(entradas):
        p = doc.add_paragraph(style=f"toc {nivel}")
        p.paragraph_format.tab_stops.add_tab_stop(Cm(ancho_cm), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
        if i == 0:
            for tipo, contenido in (("begin", None), ("instr", ' TOC \\o "1-2" \\h \\z \\u '), ("separate", None)):
                run = p.add_run()
                if tipo == "instr":
                    el = OxmlElement("w:instrText")
                    el.set(qn("xml:space"), "preserve")
                    el.text = contenido
                else:
                    el = OxmlElement("w:fldChar")
                    el.set(qn("w:fldCharType"), tipo)
                run._r.append(el)
        r = p.add_run(texto)
        r.bold = nivel == 1
        p.add_run("\t")
        p.add_run(str(pagina))
        if i == len(entradas) - 1:
            run = p.add_run()
            el = OxmlElement("w:fldChar")
            el.set(qn("w:fldCharType"), "end")
            run._r.append(el)


def nueva_seccion(doc, horizontal: bool):
    seccion = doc.add_section(WD_SECTION.NEW_PAGE)
    ancho, alto = Cm(21.0), Cm(29.7)
    if horizontal:
        seccion.orientation = WD_ORIENT.LANDSCAPE
        seccion.page_width, seccion.page_height = alto, ancho
        seccion.left_margin = seccion.right_margin = Cm(2.0)
        seccion.top_margin = seccion.bottom_margin = Cm(2.0)
    else:
        seccion.orientation = WD_ORIENT.PORTRAIT
        seccion.page_width, seccion.page_height = ancho, alto
        seccion.left_margin = seccion.right_margin = Cm(3.0)
        seccion.top_margin = seccion.bottom_margin = Cm(2.5)
    return seccion
