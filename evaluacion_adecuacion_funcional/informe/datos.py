"""
Catálogos de la evaluación (requisitos, funciones documentadas, objetivos de
uso, defectos, acciones correctivas y observaciones) y cálculo de métricas
ISO/IEC 25023 a partir de los resultados de las pruebas.
"""

import json
from collections import OrderedDict
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
RESULTADOS = RAIZ / "resultados"
CAPTURAS = RAIZ / "capturas"
UMBRAL = 0.80

RF = OrderedDict(
    [
        ("RF-01", ("Consulta de estado de paquete", "Permite al cliente consultar el estado actual de su paquete sin autenticación.", "Código de seguimiento → estado actual e historial.")),
        ("RF-02", ("Registro de paquetes", "Permite registrar nuevos paquetes en el sistema.", "Remitente, cliente, operador, repartidor, sucursales, destino y descripción → confirmación y código de seguimiento.")),
        ("RF-03", ("Actualización de estado", "Permite actualizar el estado del paquete según rol.", "ID, nuevo estado y observación → valida rol/estado, registra historial.")),
        ("RF-04", ("Historial de estados", "Permite visualizar la línea de tiempo del paquete.", "ID de paquete → lista cronológica de estados.")),
        ("RF-05", ("Autenticación de usuarios", "Permite iniciar sesión con credenciales.", "Email y contraseña → token de sesión.")),
        ("RF-06", ("Gestión de usuarios", "Admin crea, edita y elimina usuarios.", "Datos de usuario, rol, teléfono, contraseña → usuario creado/actualizado/eliminado.")),
        ("RF-07", ("Gestión de roles", "Sistema asegura roles básicos.", "Nombres de roles → roles disponibles.")),
        ("RF-08", ("Gestión de clientes", "Admin/Operador registra y consulta clientes.", "Datos del cliente → valida y guarda; cliente registrado/listado.")),
        ("RF-09", ("Gestión de distribuidoras", "Admin registra y consulta distribuidoras.", "Datos de distribuidora → distribuidora registrada/listada.")),
        ("RF-10", ("Gestión de sucursales", "Admin registra y consulta sucursales.", "Nombre y dirección → sucursal registrada/listada.")),
        ("RF-11", ("Asignación de operador", "Permite asignar operador a un paquete.", "Operador seleccionado o autoasignación → valida rol y asigna.")),
        ("RF-12", ("Asignación de repartidor", "Permite asignar repartidor a un paquete.", "Repartidor seleccionado → valida rol y asigna.")),
        ("RF-13", ("Vista «Mis entregas»", "Repartidor ve solo paquetes asignados.", "Usuario logueado → filtra por repartidor_id.")),
        ("RF-14", ("Intento fallido", "Repartidor registra intento fallido.", "ID y observación → valida rol y guarda el estado.")),
        ("RF-15", ("Reportes", "Admin genera reportes CSV/XLSX.", "Formato → archivo descargable.")),
        ("RF-16", ("Llamar operador", "Permite llamar al operador asignado.", "Teléfono del operador → valida existencia; llamada iniciada.")),
        ("RF-17", ("Llamar repartidor", "Permite llamar al repartidor asignado.", "Teléfono del repartidor → valida existencia; llamada iniciada.")),
        ("RF-18", ("Llamar cliente", "Permite llamar al cliente del envío.", "Teléfono del cliente → valida existencia; llamada iniciada.")),
        ("RF-19", ("Ver ubicación en mapa", "Permite abrir la ubicación de entrega.", "Dirección destino → abre Google Maps.")),
        ("RF-20", ("Control de acceso por rol", "Restringe rutas y acciones por rol.", "Rol del usuario → acceso permitido o bloqueado.")),
    ]
)

IMPLEMENTACION = {
    "RF-01": ("GET /api/tracking/:code", "Inicio y /seguimiento"),
    "RF-02": ("POST /api/packages", "/admin/paquetes/nuevo"),
    "RF-03": ("PATCH /api/packages/:id/status", "«Marcar salida» / «Confirmar entrega»"),
    "RF-04": ("historial en /api/packages/:id y /api/tracking/:code", "Componente «Línea de tiempo»"),
    "RF-05": ("POST /api/auth/login", "/admin/login y /cliente/login"),
    "RF-06": ("GET/POST/PUT/DELETE /api/users", "/admin/usuarios (nuevo, editar, eliminar)"),
    "RF-07": ("ensureRoles() al arrancar; GET /api/roles", "Selector de rol en usuarios"),
    "RF-08": ("GET/POST /api/clients", "/admin/clientes y alta en el registro de paquete"),
    "RF-09": ("GET/POST /api/distributors", "/admin/distribuidoras"),
    "RF-10": ("GET/POST /api/branches", "/admin/sucursales"),
    "RF-11": ("PATCH /api/packages/:id/operador", "Selector y «Asignarme a este paquete»"),
    "RF-12": ("PATCH /api/packages/:id/repartidor", "Selector de repartidor en el detalle"),
    "RF-13": ("GET /api/couriers/me/packages", "Vista «Mis entregas»"),
    "RF-14": ("PATCH /status con «Intento fallido»", "Modal «Registrar intento fallido»"),
    "RF-15": ("GET /api/reports/packages?format=csv|xlsx", "«Descargar reporte» (CSV / Excel)"),
    "RF-16": ("operador.telefono en el detalle", "Botón llamar (tel:) en «Acciones»"),
    "RF-17": ("repartidor.telefono en el detalle", "Botón llamar (tel:) en «Acciones»"),
    "RF-18": ("destinatario.telefono en el detalle", "Botón llamar (tel:) en «Acciones»"),
    "RF-19": ("URL de Google Maps (maps/search, api=1)", "«Ver ubicación en mapa»"),
    "RF-20": ("Middleware de token y validaciones por rol", "Guardias RequireAuth / RequireRole / RequireClient"),
}

FD = OrderedDict(
    [
        ("FD-01", ("Registro de cliente en el portal (autoregistro)", "DOCUMENTACION_PROYECTO.md §5.2 y §6.3", "POST /api/auth/register · /cliente/registro")),
        ("FD-02", ("Envío cliente a cliente desde el portal (incluye el alta del destinatario)", "§5.3, §6.3 y flujo §7.2", "POST /api/client/packages · /cliente/enviar")),
        ("FD-03", ("Pago del envío por el cliente (tarjeta, Yape o efectivo)", "§1.2, §5.3 y flujo de pago §7.3", "PATCH /api/client/packages/:id/pagar · Mercado Pago")),
        ("FD-04", ("Registro del pago en destino (repartidor u operador)", "§5.5 y flujos §7.1 (paso 4) y §7.3", "PATCH /api/packages/:id/registrar-pago-destino")),
        ("FD-05", ("Reprogramación de la entrega tras un intento fallido", "§1.2, §5.2 y flujo §7.1 (paso 5)", "POST /api/tracking/:code/reprogramar · PATCH /api/packages/:id/reprogramar")),
        ("FD-06", ("Consulta de «Mis envíos» del cliente", "§5.3 y §6.3", "GET /api/client/me/packages · /cliente/envios")),
    ]
)

OBJETIVOS = [
    {
        "id": "OE1",
        "x": "X1",
        "nombre": "Despachar un paquete desde su registro hasta su entrega al destinatario",
        "corto": "Despacho hasta la entrega",
        "actor": "Operador logístico y repartidor",
        "escenario": (
            "El operador inicia sesión, registra o selecciona al destinatario, registra el paquete y asigna "
            "operador y repartidor. El repartidor ve el paquete en «Mis entregas», el operador marca la salida, "
            "el repartidor ubica la dirección en el mapa, llama al cliente y confirma la entrega (o registra un "
            "intento fallido) y, si paga el destinatario, registra el cobro. La línea de tiempo deja la trazabilidad."
        ),
        "justificacion": (
            "Es el objetivo principal del sistema, equivalente al ejemplo del enunciado para un sistema de entrega "
            "de paquetes: «realizar el despacho de un producto hasta que sea entregado al cliente»."
        ),
        "funciones": [
            ("RF-05", "Operador y repartidor inician sesión"),
            ("RF-08", "Registrar o seleccionar al destinatario"),
            ("RF-02", "Registrar el paquete y obtener el código"),
            ("RF-11", "Asignar o autoasignar el operador responsable"),
            ("RF-12", "Asignar el repartidor"),
            ("RF-13", "El repartidor consulta sus paquetes"),
            ("RF-19", "Ubicar la dirección de entrega"),
            ("RF-18", "Coordinar la entrega con el destinatario"),
            ("RF-03", "Marcar la salida y confirmar la entrega"),
            ("RF-14", "Registrar la visita fallida con su motivo"),
            ("FD-04", "Cobrar al destinatario al entregar"),
            ("RF-04", "Trazabilidad del despacho"),
            ("RF-20", "Cada actor accede solo a sus acciones"),
        ],
    },
    {
        "id": "OE2",
        "x": "X2",
        "nombre": "Rastrear el envío y reprogramar la entrega cuando el destinatario no estuvo disponible",
        "corto": "Rastreo y reprogramación",
        "actor": "Destinatario o visitante (sin cuenta)",
        "escenario": (
            "El destinatario ingresa el código de seguimiento, revisa el estado actual y la línea de tiempo; si hubo "
            "un intento fallido, reprograma la fecha, el horario y la dirección de entrega y verifica la nueva programación."
        ),
        "justificacion": (
            "El seguimiento en tiempo real es la propuesta de valor visible para el cliente final y la reprogramación "
            "resuelve el caso más frecuente de entrega no concretada (DOCUMENTACION_PROYECTO.md §1.2 y §7.1)."
        ),
        "funciones": [
            ("RF-01", "Buscar el paquete por su código sin crear cuenta"),
            ("RF-04", "Ver la línea de tiempo con fechas y observaciones"),
            ("FD-05", "Reprogramar fecha, horario y dirección tras el intento fallido"),
        ],
    },
    {
        "id": "OE3",
        "x": "X3",
        "nombre": "Enviar un paquete como cliente registrado y pagar el servicio",
        "corto": "Envío y pago por el cliente",
        "actor": "Cliente remitente (portal del cliente)",
        "escenario": (
            "La persona se registra en el portal con su DNI, inicia sesión, crea un envío hacia un destinatario "
            "(existente o nuevo), paga con tarjeta, Yape o efectivo y sigue el envío en «Mis envíos» con su línea de tiempo."
        ),
        "justificacion": (
            "Corresponde a los flujos «cliente → cliente» y de pago (§7.2 y §7.3): es la vía de autoservicio que genera "
            "ingresos sin intervención del operador."
        ),
        "funciones": [
            ("FD-01", "Crear la cuenta con su DNI"),
            ("RF-05", "Iniciar sesión en el portal"),
            ("FD-02", "Registrar el envío y, si es nuevo, al destinatario"),
            ("FD-03", "Pagar el envío con el método elegido"),
            ("FD-06", "Consultar sus envíos"),
            ("RF-04", "Seguir el envío en la línea de tiempo"),
        ],
    },
]

DEFECTOS = [
    {
        "id": "D-01", "funcion": "RF-03", "severidad": "Alta", "casos": ["CP-10", "CP-11"], "config": "Ambas",
        "titulo": "Transiciones de estado sin validar",
        "descripcion": "El sistema acepta cambios de estado que contradicen el flujo En Almacén → En Tránsito → Entregado: un paquete entregado puede volver a «En Almacén» y el repartidor puede marcar «Entregado» un paquete que nunca salió del almacén.",
        "esperado": "HTTP 400/409: transición no permitida.",
        "obtenido": "HTTP 200; la línea de tiempo registra «Entregado → En Almacén» y «En Almacén → Entregado».",
        "causa": "PATCH /api/packages/:id/status (server.js, líneas 1249-1273) solo comprueba que el estado exista en config.json; no hay tabla de transiciones. La regla solo existe en la interfaz, que oculta los botones según el estado.",
        "accion": "AC-01", "evidencias": ["D04_retroceso_entregado.png", "D05_entrega_sin_transito.png"],
    },
    {
        "id": "D-02", "funcion": "RF-20", "severidad": "Alta", "casos": ["CP-69"], "config": "Ambas",
        "titulo": "Un cliente puede cambiar el estado de cualquier paquete",
        "descripcion": "Un usuario con rol Cliente marcó como «Entregado» un paquete ajeno (de otro destinatario) llamando a la API de cambio de estado.",
        "esperado": "HTTP 403: el cliente no puede modificar estados.",
        "obtenido": "HTTP 200; el seguimiento público muestra el paquete «Entregado — Marcado por un cliente».",
        "causa": "La validación de rol en PATCH /status solo restringe al Repartidor (server.js, líneas 1260-1268); el rol Cliente, añadido con el portal, hereda el permiso.",
        "accion": "AC-02", "evidencias": ["D03_seguimiento_marcado_por_cliente.png", "D02_actividad_cliente_cambia_estado.png"],
    },
    {
        "id": "D-03", "funcion": "RF-20", "severidad": "Media", "casos": ["CP-70"], "config": "Ambas",
        "titulo": "Un cliente puede registrar paquetes por el endpoint administrativo",
        "descripcion": "El cliente registró un paquete «distribuidora → cliente» eligiendo operador y repartidor mediante POST /api/packages, reservado al Administrador y al Operador según la documentación (§5.5).",
        "esperado": "HTTP 403.",
        "obtenido": "HTTP 201; el paquete queda registrado a nombre de la distribuidora.",
        "causa": "POST /api/packages solo excluye al rol Repartidor (server.js, líneas 1131-1134): autorización por lista de exclusión.",
        "accion": "AC-02", "evidencias": ["D02_actividad_cliente_cambia_estado.png"],
    },
    {
        "id": "D-04", "funcion": "RF-20", "severidad": "Media", "casos": ["CP-71"], "config": "Ambas (interfaz)",
        "titulo": "El repartidor queda en una pantalla vacía al iniciar sesión",
        "descripcion": "Tras iniciar sesión, el repartidor es enviado a /admin, vista reservada a Administrador y Operador; el guardián de ruta lo redirige a la misma ruta y el área principal queda en blanco hasta que elige «Paquetes» en el menú.",
        "esperado": "Llegar a una vista permitida para su rol («Mis entregas»).",
        "obtenido": "Ruta /admin con el área principal vacía.",
        "causa": "AdminLogin.jsx (líneas 40-44) envía a todo usuario interno a /admin y RequireRole (App.jsx, líneas 65-72 y 189-196) redirige a esa misma ruta.",
        "accion": "AC-08", "evidencias": ["D01_repartidor_pantalla_vacia.png"],
    },
    {
        "id": "D-05", "funcion": "RF-06", "severidad": "Alta", "casos": ["CP-22"], "config": "PostgreSQL: sin respuesta · Memoria: duplica",
        "titulo": "Alta de usuario con email ya registrado",
        "descripcion": "El alta de un usuario con un email existente no se valida. En PostgreSQL la petición nunca responde y el formulario queda en «Guardando...»; en memoria se crea un segundo usuario con el mismo email.",
        "esperado": "HTTP 400/409 con el mensaje «email ya registrado».",
        "obtenido": "PostgreSQL: sin respuesta tras 6 s. Memoria: HTTP 201 con usuario duplicado.",
        "causa": "POST /api/users (server.js, líneas 1460-1493) no verifica el email y la excepción de la restricción UNIQUE no se captura en el manejador async de Express 4 («Promesa no controlada» en el log).",
        "accion": "AC-03, AC-04", "evidencias": ["D08_usuario_email_duplicado.png", "T06_log_servidor.png"],
    },
    {
        "id": "D-06", "funcion": "RF-06", "severidad": "Alta", "casos": ["CP-24"], "config": "PostgreSQL: sin respuesta · Memoria: datos huérfanos",
        "titulo": "Eliminación de un repartidor con paquetes asignados",
        "descripcion": "Eliminar a un repartidor que tiene paquetes asignados no tiene tratamiento: en PostgreSQL la petición queda colgada (el modal permanece en «Eliminando...») y en memoria el usuario se borra y el paquete queda con un repartidor inexistente.",
        "esperado": "Respuesta controlada (HTTP 409 con mensaje o desactivación del usuario).",
        "obtenido": "PostgreSQL: sin respuesta. Memoria: HTTP 200 y paquete con repartidor «inexistente».",
        "causa": "DELETE /api/users/:id (server.js, líneas 1538-1546) no verifica dependencias; la llave foránea paquetes_repartidor_id_fkey lanza una excepción no controlada.",
        "accion": "AC-04, AC-10", "evidencias": ["D09_eliminar_repartidor_con_paquetes.png", "T06_log_servidor.png"],
    },
    {
        "id": "D-07", "funcion": "RF-06", "severidad": "Media", "casos": ["CP-19", "CP-20"], "config": "CP-20 ambas · CP-19 PostgreSQL",
        "titulo": "La edición de usuarios no precarga el teléfono",
        "descripcion": "El formulario «Editar usuario» muestra el teléfono vacío, por lo que el administrador debe volver a digitarlo para guardar cualquier cambio; en PostgreSQL la API además devuelve el teléfono cifrado («enc:v1:…»).",
        "esperado": "Teléfono legible (E.164) y precargado en el formulario.",
        "obtenido": "Campo vacío; GET /api/users/:id devuelve «enc:v1:…» en PostgreSQL.",
        "causa": "AdminUserEdit.jsx (línea 57) expande splitPhoneValue(), que devuelve {countryIso, number}, pero el formulario usa telefonoPais/telefonoNumero; getUserById (storageDb.js, líneas 362-365) no descifra.",
        "accion": "AC-05, AC-08", "evidencias": ["D07_edicion_usuario_telefono.png", "D07b_edicion_usuario_error.png"],
    },
    {
        "id": "D-08", "funcion": "RF-08", "severidad": "Media", "casos": ["CP-29"], "config": "Ambas",
        "titulo": "Clientes duplicados con el mismo DNI",
        "descripcion": "Se registró un segundo cliente con un DNI que ya pertenecía a otro cliente.",
        "esperado": "HTTP 400/409: el documento ya está registrado.",
        "obtenido": "HTTP 201; dos clientes con el mismo DNI.",
        "causa": "POST /api/clients (server.js, líneas 961-989) no valida unicidad y la tabla clientes no tiene restricción UNIQUE (el cifrado con IV aleatorio impide crearla sobre la columna).",
        "accion": "AC-03", "evidencias": ["T08_dni_duplicado.png"],
    },
    {
        "id": "D-09", "funcion": "RF-11", "severidad": "Media", "casos": ["CP-43"], "config": "Ambas",
        "titulo": "Un operador puede desasignar el paquete de otro operador",
        "descripcion": "El Operador B quitó la asignación de un paquete que pertenecía al Operador A enviando operadorId = null.",
        "esperado": "HTTP 403: un operador solo puede autoasignarse paquetes sin operador.",
        "obtenido": "HTTP 200; el paquete queda sin operador.",
        "causa": "PATCH /api/packages/:id/operador (server.js, líneas 1075-1079) valida al operador solo cuando operadorId tiene valor; la rama null y la reasignación de paquetes ajenos no se contemplaron.",
        "accion": "AC-09", "evidencias": ["D06_operador_desasignado.png"],
    },
    {
        "id": "D-10", "funcion": "FD-01", "severidad": "Media", "casos": ["CP-74"], "config": "Solo PostgreSQL",
        "titulo": "El autoregistro con DNI existente no vincula al cliente",
        "descripcion": "Un destinatario que ya había recibido envíos se registró en el portal con su DNI: el sistema creó otro cliente y «Mis envíos» quedó vacío.",
        "esperado": "La cuenta se vincula al cliente existente y muestra sus paquetes.",
        "obtenido": "Se creó un cliente nuevo; «Mis envíos» muestra 0 paquetes.",
        "causa": "getClientByDocumento (storageDb.js, líneas 260-271) aplica regexp_replace sobre el documento cifrado, por lo que nunca coincide (regresión del cifrado, commit 8f7525a).",
        "accion": "AC-03, AC-05", "evidencias": ["D12_destinatario_sin_envios.png"],
    },
    {
        "id": "D-11", "funcion": "FD-02", "severidad": "Alta", "casos": ["CP-76"], "config": "Ambas",
        "titulo": "El portal ofrece agregar destinatarios, pero la API lo prohíbe",
        "descripcion": "En «Enviar paquete», el botón «+ Agregar nuevo» permite completar los datos del destinatario, pero al guardar el servidor responde «No autorizado»; el cliente solo puede elegir de la lista global de clientes.",
        "esperado": "HTTP 201: el destinatario queda disponible para el envío.",
        "obtenido": "HTTP 403 «No autorizado».",
        "causa": "ClientPackageNew.jsx (líneas 163-191) usa POST /api/clients, restringido a Administrador y Operador (server.js, líneas 961-964).",
        "accion": "AC-02", "evidencias": ["D10_portal_agregar_destinatario.png"],
    },
    {
        "id": "D-12", "funcion": "FD-03", "severidad": "Alta", "casos": ["CP-80"], "config": "Ambas",
        "titulo": "«Efectivo» en el portal registra el envío como pagado sin cobro",
        "descripcion": "Al elegir «Efectivo» («Pagarás en efectivo al momento de la entrega»), el envío queda como pagado aunque no se cobró; luego el repartidor ya no puede registrar el cobro.",
        "esperado": "El envío queda pendiente de cobro (pagado = false) hasta que el repartidor reciba el dinero.",
        "obtenido": "pagado = true y método «efectivo»; el panel muestra «Pagado (efectivo)».",
        "causa": "PATCH /api/client/packages/:id/pagar marca pagado para el método efectivo (server.js, líneas 702-709); ClientPackageDetail.jsx (líneas 79-95) llama a ese endpoint al confirmar.",
        "accion": "AC-06", "evidencias": ["D11a_portal_efectivo_mensaje.png", "D11b_portal_efectivo_pagado.png", "D11c_panel_pago_registrado.png"],
    },
    {
        "id": "D-13", "funcion": "FD-05", "severidad": "Media", "casos": ["CP-86", "CP-87"], "config": "Ambas",
        "titulo": "La reprogramación acepta fechas pasadas y horarios invertidos",
        "descripcion": "La entrega se reprogramó para el día anterior y con la ventana 15:00–09:00; en ambos casos el paquete vuelve a «En Tránsito».",
        "esperado": "HTTP 400: fecha u horario inválidos.",
        "obtenido": "HTTP 200 en ambos casos.",
        "causa": "Los endpoints de reprogramación (server.js, líneas 1276-1311 y 1316-1344) solo verifican que los campos existan; el mínimo del selector de fecha usa la fecha UTC.",
        "accion": "AC-07", "evidencias": ["D13_reprogramacion_fecha_pasada.png"],
    },
    {
        "id": "D-14", "funcion": "FD-05", "severidad": "Media", "casos": ["CP-88"], "config": "Solo PostgreSQL",
        "titulo": "La fecha reprogramada se muestra como «Invalid Date»",
        "descripcion": "En producción, «Próxima entrega programada» muestra «Invalid Date» en el seguimiento público y en el panel.",
        "esperado": "Fecha legible (día, mes y año) con la ventana horaria.",
        "obtenido": "«Invalid Date • 09:00 — 12:00».",
        "causa": "PostgreSQL devuelve la columna DATE como objeto Date, serializado como «2026-11-19T00:00:00.000Z» (storageDb.js, línea 88), y el frontend le concatena «T12:00:00» (Tracking.jsx, línea 248; AdminPackageDetail.jsx, línea 755).",
        "accion": "AC-05", "evidencias": ["D14_fecha_reprogramada_invalida.png"],
    },
]

ACCIONES = [
    ("AC-01", "D-01", "Implementar una máquina de estados en el backend: un mapa de transiciones permitidas (En Almacén → En Tránsito; En Tránsito → Entregado / Intento fallido; Intento fallido → En Tránsito) validado en PATCH /status con HTTP 409, parametrizable en config.json y cubierto por pruebas unitarias por transición.", "Alta", "RF-03 · OE1"),
    ("AC-02", "D-02, D-03, D-11", "Reemplazar las verificaciones por exclusión por un middleware de lista de permitidos (permitirRoles) aplicado a cada ruta; crear un endpoint para que el cliente registre destinatarios (POST /api/client/recipients) y mantener una única matriz rol × acción compartida por el frontend y el backend.", "Alta", "RF-20, FD-02 · OE1, OE3"),
    ("AC-03", "D-05, D-08, D-10", "Validar unicidad antes de insertar (email → 409) y, para el documento cifrado, agregar la columna documento_hash = HMAC-SHA256(documento normalizado) con índice UNIQUE; buscar por ese hash en getClientByDocumento.", "Alta", "RF-06, RF-08, FD-01 · OE1, OE3"),
    ("AC-04", "D-05, D-06, OB-05", "Centralizar el manejo de errores asíncronos: envolver los manejadores con asyncHandler (o migrar a Express 5) y traducir los códigos de PostgreSQL 23505 → 409, 23503 → 409 y 22P02 → 400 en el middleware de errores.", "Alta", "RF-06"),
    ("AC-05", "D-07, D-10, D-14, OB-06", "Completar la capa de cifrado: descifrar en getUserById y getOperatorPhone, devolver DATE como «AAAA-MM-DD» (pg.types.setTypeParser(1082)) y añadir pruebas de contrato que comparen las respuestas en memoria y en PostgreSQL.", "Alta", "RF-06, FD-01, FD-05 · OE2, OE3"),
    ("AC-06", "D-12", "Separar el pago contra entrega del pago confirmado: con efectivo el portal registra el método y deja el cobro pendiente (pagado = false); solo el repartidor u operador lo confirma con registrar-pago-destino. Ajustar los textos de la interfaz.", "Alta", "FD-03 · OE3"),
    ("AC-07", "D-13", "Validar en los dos endpoints de reprogramación que la fecha sea válida y ≥ hoy en America/Lima, que horaFin > horaInicio y que la ventana esté en el horario operativo; calcular el mínimo del selector con la zona de Lima.", "Media", "FD-05 · OE2"),
    ("AC-08", "D-04, D-07", "Frontend: redirigir tras el login según el rol (Repartidor → /admin/paquetes), dar a RequireRole una ruta de respaldo por rol y corregir AdminUserEdit para asignar countryIso/number a telefonoPais/telefonoNumero.", "Media", "RF-20, RF-06 · OE1"),
    ("AC-09", "D-09", "En PATCH /operador, si quien llama es Operador, aceptar solo operadorId igual a su propio id y solo cuando el paquete no tenga operador; rechazar null. La reasignación queda reservada al Administrador.", "Media", "RF-11 · OE1"),
    ("AC-10", "D-06", "Al eliminar un usuario con paquetes asignados, responder 409 «tiene paquetes asignados» y ofrecer la desactivación (activo = false) o la reasignación previa.", "Media", "RF-06"),
    ("AC-11", "Causa C1", "Actualizar el SRS: incorporar FD-01 a FD-06 como requisitos con criterios de aceptación (Dado / Cuando / Entonces) y explicitar las reglas de negocio de estados, unicidad de email y documento, pagos y reprogramación, con trazabilidad requisito ↔ caso de prueba.", "Alta", "Todas"),
    ("AC-12", "Causa C6", "Ejecutar la suite en memoria y en PostgreSQL en integración continua (GitHub Actions con servicio postgres:16), incorporar los 90 casos de esta evaluación como pruebas de regresión y añadir pruebas negativas de autorización y de transiciones.", "Alta", "Todas"),
]

OBSERVACIONES = [
    ("OB-01", "RF-01", "El seguimiento distingue mayúsculas: «tm-2026-…» responde 404 aunque el código exista.", "Normalizar el código (trim y mayúsculas) antes de buscar.", "T07_observaciones.png"),
    ("OB-02", "Seguridad*", "El seguimiento público, sin autenticación, devuelve DNI, teléfono, email y dirección del destinatario, y teléfono y email del operador y del repartidor; con códigos de 4 dígitos (9 000 por año) es posible enumerarlos.", "Devolver solo estado, historial y datos no sensibles; usar códigos no predecibles.", "T07_observaciones.png"),
    ("OB-03", "RF-16 a RF-18", "Los botones de llamada generan «tel:51…» sin el prefijo «+» (RFC 3966 lo exige para números globales); según el dispositivo u operador la llamada podría no conectarse.", "Usar el valor E.164 completo: «tel:+51…».", "E07_acciones_llamar.png"),
    ("OB-04", "RF-02", "El código TM-AAAA-NNNN usa 4 dígitos aleatorios: solo 9 000 códigos por año; en PostgreSQL el registro falla tras 5 colisiones y en memoria el reintento no termina si se agotan.", "Usar una secuencia o un código más largo.", "—"),
    ("OB-05", "Fiabilidad*", "Un identificador no numérico (p. ej. /api/packages/abc) deja la petición colgada en PostgreSQL (mismo origen que D-05 y D-06).", "AC-04.", "T07_observaciones.png"),
    ("OB-06", "RF-16", "GET /api/operators/phone (documentado en §5.5) devuelve el teléfono cifrado; la interfaz no lo usa.", "AC-05.", "T07_observaciones.png"),
    ("OB-07", "RF-15", "En envíos cliente → cliente el reporte coloca al remitente en las columnas «Distribuidora» y no incluye precio, estado de pago, operador ni repartidor.", "Renombrar las columnas de remitente y agregar los datos de cobro y asignación.", "—"),
    ("OB-08", "Seguridad*", "config.json define el acceso administrativo por defecto «admin / admin123», activo si no se definen ADMIN_USER y ADMIN_PASS (render.yaml no los establece).", "Eliminar las credenciales por defecto y exigir variables de entorno.", "—"),
]


def cargar():
    pg = json.loads((RESULTADOS / "resultados_api_postgresql.json").read_text(encoding="utf-8"))
    memoria = json.loads((RESULTADOS / "resultados_api_memoria.json").read_text(encoding="utf-8"))
    ui = json.loads((RESULTADOS / "resultados_ui_postgresql.json").read_text(encoding="utf-8"))
    casos = sorted(pg["casos"] + ui["casos"], key=lambda c: c["id"])
    ids_ui = {c["id"] for c in ui["casos"]}
    for c in casos:
        c["tipo"] = "Interfaz" if c["id"] in ids_ui else "API"
    estado_memoria = {c["id"]: c["pasa"] for c in memoria["casos"]}
    return {"pg": pg, "memoria": memoria, "ui": ui, "casos": casos, "estado_memoria": estado_memoria}


def rango(ids):
    return f"{ids[0]} a {ids[-1]}" if len(ids) > 2 else ", ".join(ids)


def calcular(datos):
    casos = datos["casos"]
    por_funcion = OrderedDict()
    for fid in list(RF) + list(FD):
        lista = [c for c in casos if c["funcion"] == fid]
        fallidos = [c["id"] for c in lista if not c["pasa"]]
        por_funcion[fid] = {
            "casos": lista,
            "ids": [c["id"] for c in lista],
            "fallidos": fallidos,
            "pasan": len(lista) - len(fallidos),
            "estado": "Incorrecta" if fallidos else "Correcta",
            "implementada": len(lista) > 0,
        }
    faltantes = [f for f in RF if not por_funcion[f]["implementada"]]
    incorrectas = [f for f in RF if por_funcion[f]["estado"] == "Incorrecta"]
    m11 = 1 - len(faltantes) / len(RF)
    m21 = 1 - len(incorrectas) / len(RF)
    objetivos = []
    for oe in OBJETIVOS:
        requeridas = [f for f, _ in oe["funciones"]]
        malas = [f for f in requeridas if por_funcion[f]["estado"] == "Incorrecta" or not por_funcion[f]["implementada"]]
        valor = 1 - len(malas) / len(requeridas)
        objetivos.append({**oe, "A": len(malas), "B": len(requeridas), "malas": malas, "valor": valor})
    m32 = sum(o["valor"] for o in objetivos) / len(objetivos)
    resumen = {
        "pg_total": len(datos["pg"]["casos"]) + len(datos["ui"]["casos"]),
        "pg_api": len(datos["pg"]["casos"]),
        "ui": len(datos["ui"]["casos"]),
        "pg_pasan": sum(c["pasa"] for c in casos),
        "mem_total": len(datos["memoria"]["casos"]),
        "mem_pasan": sum(c["pasa"] for c in datos["memoria"]["casos"]),
    }
    resumen["pg_fallan"] = resumen["pg_total"] - resumen["pg_pasan"]
    resumen["mem_fallan"] = resumen["mem_total"] - resumen["mem_pasan"]
    return {
        "por_funcion": por_funcion,
        "faltantes": faltantes,
        "incorrectas": incorrectas,
        "m11": m11,
        "m21": m21,
        "objetivos": objetivos,
        "m32": m32,
        "resumen": resumen,
    }


def estado(valor):
    return "CONFORME" if round(valor, 2) >= UMBRAL else "NO CONFORME"


def fmt(valor):
    return f"{valor:.2f} ({round(valor * 100):.0f}%)"
