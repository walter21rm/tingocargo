/**
 * ============================================================
 * EVALUACIÓN DE ADECUACIÓN FUNCIONAL — Casos de interfaz y capturas
 * ============================================================
 * Automatiza Google Chrome (puppeteer-core) sobre el frontend de
 * TingoCargo conectado al backend con PostgreSQL. Ejecuta los casos de
 * prueba que solo existen en la interfaz (RF-06, RF-13, RF-16..RF-20) y toma
 * las capturas que se adjuntan como evidencia en los anexos.
 *
 * Requiere haber ejecutado antes casos_api.mjs (usa sus datos de prueba).
 * Uso: node casos_ui.mjs web=http://127.0.0.1:5173 api=http://127.0.0.1:4100
 * ============================================================
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.split("=");
    return [key, rest.join("=")];
  })
);
const WEB = args.web || "http://127.0.0.1:5173";
const API = args.api || "http://127.0.0.1:4100";
const CHROME = args.chrome || "/usr/local/bin/google-chrome";
const CAPTURAS = path.resolve(aqui, "../capturas");
const RESULTADOS = path.resolve(aqui, "../resultados");
const datos = JSON.parse(
  fs.readFileSync(path.join(RESULTADOS, "resultados_api_postgresql.json"), "utf8")
);
const fx = datos.fixtures;

const casos = [];
const capturas = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const digitos = (valor) => String(valor || "").replace(/\D/g, "");

fs.mkdirSync(CAPTURAS, { recursive: true });

/* ── API auxiliar para preparar datos ───────────────────────── */

const api = async (method, urlPath, { token, body } = {}) => {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, body: data };
};

const tokenDe = async (usuario, password) => {
  const res = await api("POST", "/api/auth/login", { body: { usuario, password } });
  if (res.status !== 200) throw new Error(`No se pudo iniciar sesión como ${usuario}: ${res.status}`);
  return res.body.token;
};

/* ── Utilidades de navegador ────────────────────────────────── */

let browser;

const nuevaPagina = async () => {
  const contexto = await browser.createBrowserContext();
  const page = await contexto.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1.25 });
  await page.evaluateOnNewDocument(() => {
    window.__abiertos = [];
    window.open = (url) => {
      window.__abiertos.push(String(url));
      return null;
    };
  });
  return { contexto, page };
};

const ir = async (page, ruta, espera = 1200) => {
  await page.goto(`${WEB}${ruta}`, { waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
  await sleep(espera);
};

const captura = async (page, nombre, titulo, opciones = {}) => {
  const archivo = `${nombre}.png`;
  await page.screenshot({ path: path.join(CAPTURAS, archivo), ...opciones });
  capturas.push({ archivo, titulo });
  console.log(`  captura → ${archivo}`);
};

const capturaElemento = async (page, selector, nombre, titulo, margen = 12) => {
  const caja = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
  }, selector);
  if (!caja) throw new Error(`No se encontró ${selector}`);
  await captura(page, nombre, titulo, {
    captureBeyondViewport: true,
    clip: {
      x: Math.max(caja.x - margen, 0),
      y: Math.max(caja.y - margen, 0),
      width: caja.width + margen * 2,
      height: caja.height + margen * 2
    }
  });
};

const clickTexto = async (page, texto, selector = "button, a", exacto = false) => {
  const ok = await page.evaluate(
    (t, sel, exact) => {
      const el = [...document.querySelectorAll(sel)].find((e) => {
        const txt = e.textContent.replace(/\s+/g, " ").trim();
        return (exact ? txt === t : txt.includes(t)) && e.offsetParent !== null;
      });
      if (!el) return false;
      el.scrollIntoView({ block: "center" });
      el.click();
      return true;
    },
    texto,
    selector,
    exacto
  );
  if (!ok) throw new Error(`No se encontró el control «${texto}»`);
  await sleep(700);
};

const escribir = async (page, selector, valor) => {
  await page.evaluate(
    (sel, val) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`No existe ${sel}`);
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    selector,
    valor
  );
};

const loginPanel = async (page, email, password) => {
  await ir(page, "/admin/login", 800);
  await page.type('input[placeholder="correo@empresa.com"]', email);
  await page.type('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname !== "/admin/login", { timeout: 15000 });
  await sleep(1500);
};

const loginCliente = async (page, email, password) => {
  await ir(page, "/cliente/login", 800);
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => location.pathname.startsWith("/cliente") && location.pathname !== "/cliente/login", { timeout: 15000 });
  await sleep(1200);
};

const caso = async (def, ejecutar) => {
  let r;
  try {
    r = await ejecutar();
  } catch (err) {
    r = { pasa: false, obtenido: `Error en la ejecución: ${err.message}` };
  }
  casos.push({ ...def, modo: "postgresql", pasa: r.pasa, obtenido: r.obtenido, nota: r.nota || "" });
  console.log(`${r.pasa ? "PASA " : "FALLA"} ${def.id} [${def.funcion}] ${def.titulo}`);
  console.log(`       Esperado: ${def.esperado}`);
  console.log(`       Obtenido: ${r.obtenido}`);
};

const paso = async (descripcion, fn) => {
  try {
    await fn();
  } catch (err) {
    console.log(`  (aviso) ${descripcion}: ${err.message}`);
  }
};

/* ── Preparación de paquetes para la interfaz ───────────────── */

const prepararPaquetes = async (tokens) => {
  const base = {
    remitenteId: fx.distribuidora.id,
    destinatarioId: fx.clienteC1.id,
    sucursalOrigenId: fx.sucursalOrigen.id,
    sucursalDestinoId: fx.sucursalDestino.id,
    destinoTexto: "Jr. Callao 456, Tingo María",
    descripcion: "Caja de medicamentos (antibióticos)",
    operadorId: fx.operadorA.id,
    repartidorId: fx.repartidorA.id,
    pesoKg: 1.5
  };
  const crear = async (extra) => {
    const res = await api("POST", "/api/packages", { token: tokens.opA, body: { ...base, ...extra } });
    if (res.status !== 201) throw new Error(`No se pudo crear paquete de interfaz: ${res.status}`);
    return res.body;
  };
  const detalle = await crear({});
  await api("PATCH", `/api/packages/${detalle.id}/status`, {
    token: tokens.opA,
    body: { estado: "En Tránsito", observacion: "Salida registrada" }
  });
  const mapa = await crear({ destinoTexto: "Jr. Los Pinos 145", descripcion: "Paquete con dirección sin ciudad" });
  const transito = await crear({ descripcion: "Paquete para intento fallido" });
  await api("PATCH", `/api/packages/${transito.id}/status`, {
    token: tokens.opA,
    body: { estado: "En Tránsito", observacion: "Salida registrada" }
  });
  const pagoCliente = await api("POST", "/api/client/packages", {
    token: tokens.cliente,
    body: {
      destinatarioId: fx.clienteC2.id,
      sucursalOrigenId: fx.sucursalOrigen.id,
      sucursalDestinoId: fx.sucursalDestino.id,
      destinoTexto: "Jr. Callao 456, Tingo María",
      descripcion: "Encomienda familiar",
      pesoKg: 1,
      quienPaga: "remitente"
    }
  });
  if (pagoCliente.status !== 201) throw new Error("No se pudo crear el envío del cliente");
  return { detalle, mapa, transito, pagoCliente: pagoCliente.body };
};

/* ── Ejecución ──────────────────────────────────────────────── */

const main = async () => {
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--lang=es-PE"]
  });

  const tokens = {
    opA: await tokenDe(fx.operadorA.email, fx.operadorA.password),
    admin: await tokenDe(fx.admin.usuario, fx.admin.password),
    cliente: await tokenDe(fx.clientePortal.email, fx.clientePortal.password)
  };
  const pk = await prepararPaquetes(tokens);
  console.log("Paquetes de interfaz preparados:", pk.detalle.codigoSeguimiento, pk.mapa.codigoSeguimiento, pk.transito.codigoSeguimiento);

  /* Público: inicio y seguimiento */
  {
    const { contexto, page } = await nuevaPagina();
    await ir(page, "/", 1500);
    await captura(page, "E01_inicio_publico", "Página de inicio pública con el buscador de seguimiento (RF-01)");
    await ir(page, `/seguimiento?code=${encodeURIComponent(fx.paquetes.p5.codigo)}`, 1800);
    await captura(page, "E02_seguimiento_publico", `Seguimiento público del paquete ${fx.paquetes.p5.codigo}: estado, datos y línea de tiempo (RF-01, RF-04, FD-05)`, { fullPage: true });
    await caso(
      {
        id: "CP-88",
        funcion: "FD-05",
        titulo: "La fecha de la entrega reprogramada se muestra en el seguimiento",
        entrada: `Seguimiento de ${fx.paquetes.p5.codigo}, reprogramado para mañana (CP-84)`,
        esperado: "«Próxima entrega programada» muestra la fecha (día, mes y año) y la ventana horaria"
      },
      async () => {
        const texto = await page.evaluate(() => {
          const caja = [...document.querySelectorAll("div")].find(
            (d) => d.firstElementChild?.innerText === "Próxima entrega programada"
          );
          return caja ? caja.innerText.replace(/\s+/g, " ").trim() : "";
        });
        await paso("captura fecha reprogramada", async () => {
          await page.evaluate(() => {
            const caja = [...document.querySelectorAll("div")].find(
              (d) => d.firstElementChild?.innerText === "Próxima entrega programada"
            );
            caja?.setAttribute("id", "caja-reprogramacion");
          });
          await capturaElemento(page, "#caja-reprogramacion", "D14_fecha_reprogramada_invalida", `«Próxima entrega programada» del paquete ${fx.paquetes.p5.codigo} muestra «Invalid Date» (CP-88)`, 16);
        });
        return {
          pasa: Boolean(texto) && !/Invalid Date/i.test(texto) && /\d{4}/.test(texto),
          obtenido: texto ? `Se muestra «${texto}»` : "No aparece el bloque de entrega programada"
        };
      }
    );
    await ir(page, `/seguimiento?code=${encodeURIComponent(fx.paquetes.p8.codigo)}`, 1800);
    await captura(page, "D03_seguimiento_marcado_por_cliente", `El paquete ${fx.paquetes.p8.codigo} figura «Entregado» porque un usuario con rol Cliente cambió su estado (CP-69)`, { fullPage: true });
    await contexto.close();
  }

  /* Repartidor: pantalla tras iniciar sesión, «Mis entregas» e intento fallido */
  {
    const { contexto, page } = await nuevaPagina();
    await ir(page, "/admin/login", 1500);
    await captura(page, "E03_login_panel", "Inicio de sesión del panel administrativo (RF-05)");
    await page.type('input[placeholder="correo@empresa.com"]', fx.repartidorA.email);
    await page.type('input[type="password"]', fx.repartidorA.password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => location.pathname !== "/admin/login", { timeout: 15000 }).catch(() => {});
    await sleep(2000);

    await caso(
      {
        id: "CP-71",
        funcion: "RF-20",
        titulo: "Repartidor inicia sesión en el panel",
        entrada: `Credenciales de ${fx.repartidorA.nombre}`,
        esperado: "Llega a una vista permitida para su rol (por ejemplo «Mis entregas»)"
      },
      async () => {
        const estado = await page.evaluate(() => {
          const interno = document.querySelector("main main") || document.querySelector("main");
          return {
            ruta: location.pathname,
            titulo: interno?.querySelector("h1")?.innerText || "",
            largo: interno?.innerText.trim().length || 0
          };
        });
        await captura(page, "D01_repartidor_pantalla_vacia", "Tras iniciar sesión, el repartidor queda en /admin con el área principal vacía (CP-71)");
        return {
          pasa: Boolean(estado.titulo),
          obtenido: estado.titulo
            ? `Ruta ${estado.ruta}, muestra «${estado.titulo}»`
            : `Ruta ${estado.ruta}: el guardián de ruta redirige a la misma ruta y el área principal queda vacía`
        };
      }
    );

    await caso(
      {
        id: "CP-50",
        funcion: "RF-13",
        titulo: "Repartidor abre «Mis entregas» desde el menú",
        entrada: "Menú lateral → Paquetes",
        esperado: "Título «Mis entregas» y solo paquetes asignados al repartidor"
      },
      async () => {
        await clickTexto(page, "Paquetes", "a");
        await sleep(1500);
        const info = await page.evaluate(() => ({
          titulo: document.querySelector("main main h1")?.innerText || "",
          texto: document.querySelector("main main")?.innerText || ""
        }));
        await captura(page, "E09_mis_entregas_repartidor", "Vista «Mis entregas» del repartidor: solo sus paquetes asignados (RF-13)");
        const propio = info.texto.includes(fx.paquetes.p1.codigo);
        const ajeno = info.texto.includes(fx.paquetes.p4.codigo);
        return {
          pasa: info.titulo === "Mis entregas" && propio && !ajeno,
          obtenido: `Título «${info.titulo}»; ${propio ? "incluye" : "no incluye"} ${fx.paquetes.p1.codigo} (propio) y ${ajeno ? "incluye" : "no incluye"} ${fx.paquetes.p4.codigo} (de otro repartidor)`
        };
      }
    );

    await paso("intento fallido en la interfaz", async () => {
      await ir(page, `/admin/paquetes/${pk.transito.id}`, 1800);
      await clickTexto(page, "Registrar intento fallido");
      await escribir(page, "textarea", "Cliente ausente; se dejó aviso en la puerta");
      await sleep(400);
      await captura(page, "E08_intento_fallido_modal", "El repartidor registra un intento fallido con su observación (RF-14)");
      await clickTexto(page, "Registrar", "div.fixed button", true);
      await sleep(1800);
      await page.evaluate(() => window.scrollTo(0, 0));
      await captura(page, "E08b_intento_fallido_registrado", "Paquete con estado «Intento fallido» y la observación del repartidor en la línea de tiempo (RF-14, RF-04)", { fullPage: true });
    });
    await contexto.close();
  }

  /* Operador: detalle del paquete, botones de llamada y mapa */
  {
    const { contexto, page } = await nuevaPagina();
    await loginPanel(page, fx.operadorA.email, fx.operadorA.password);
    await captura(page, "E04_dashboard_operador", "Dashboard del operador logístico con indicadores y últimos paquetes");
    await ir(page, `/admin/paquetes/${pk.detalle.id}`, 1800);
    await captura(page, "E06_detalle_paquete", `Detalle del paquete ${pk.detalle.codigoSeguimiento}: remitente, operador, repartidor, cliente, acciones y línea de tiempo (RF-04, RF-11, RF-12, RF-16 a RF-19)`, { fullPage: true });

    const enlaces = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="tel:"]')].map((a) => ({ href: a.getAttribute("href"), titulo: a.title }))
    );
    const buscar = (nombre) => enlaces.find((e) => e.titulo.includes(nombre));
    const llamada = async (id, funcion, rol, nombre, telefono) =>
      caso(
        {
          id,
          funcion,
          titulo: `Botón «Llamar» del ${rol} en el detalle del paquete`,
          entrada: `Detalle de ${pk.detalle.codigoSeguimiento} con ${rol} ${nombre}`,
          esperado: `Enlace de llamada (tel:) al teléfono del ${rol} asignado (${telefono})`
        },
        async () => {
          const e = buscar(nombre);
          const correcto = e && digitos(e.href) === digitos(telefono);
          return {
            pasa: Boolean(correcto),
            obtenido: e ? `Enlace ${e.href} («${e.titulo}»)` : "No hay enlace de llamada",
            nota: e && !e.href.startsWith("tel:+") ? "El enlace omite el prefijo «+» del formato internacional (ver observación OB-03)" : ""
          };
        }
      );
    await llamada("CP-58", "RF-16", "operador", datos.fixtures.operadorA.nombre, (await api("GET", `/api/packages/${pk.detalle.id}`, { token: tokens.opA })).body.operador.telefono);
    const det = (await api("GET", `/api/packages/${pk.detalle.id}`, { token: tokens.opA })).body;
    await llamada("CP-60", "RF-17", "repartidor", det.repartidor.nombre, det.repartidor.telefono);
    await llamada("CP-62", "RF-18", "cliente", det.destinatario.nombre, det.destinatario.telefono);
    await paso("captura acciones", async () => {
      await capturaElemento(page, "div.text-center", "E07_acciones_llamar", "Tarjeta «Acciones»: WhatsApp, llamada y copia del teléfono del operador, repartidor y cliente (RF-16, RF-17, RF-18)");
    });

    await caso(
      {
        id: "CP-63",
        funcion: "RF-19",
        titulo: "«Ver ubicación en mapa» con dirección completa",
        entrada: `Destino «${det.destinoTexto}»`,
        esperado: "Abre Google Maps (maps/search, api=1) con la dirección de entrega"
      },
      async () => {
        await page.evaluate(() => {
          window.__abiertos = [];
        });
        await clickTexto(page, "Ver ubicación en mapa");
        const url = (await page.evaluate(() => window.__abiertos.at(-1))) || "";
        const consulta = decodeURIComponent(url.split("query=")[1] || "");
        return {
          pasa: url.startsWith("https://www.google.com/maps/search/?api=1&query=") && consulta.includes(det.destinoTexto),
          obtenido: url ? `Abre ${url}` : "No se abrió ninguna URL"
        };
      }
    );

    const urlMapa = await page.evaluate(() => window.__abiertos.at(-1));
    await paso("captura Google Maps", async () => {
      const mapa = await (await page.browserContext()).newPage();
      await mapa.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1.25 });
      await mapa.goto(urlMapa, { waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
      await sleep(3500);
      await captura(mapa, "E10_google_maps", "Google Maps abierto desde «Ver ubicación en mapa» con la dirección de entrega (RF-19)");
      await mapa.close();
    });

    await caso(
      {
        id: "CP-64",
        funcion: "RF-19",
        titulo: "«Ver ubicación en mapa» con dirección sin ciudad",
        entrada: `Destino «Jr. Los Pinos 145» (sucursal destino: ${fx.sucursalDestino.direccion})`,
        esperado: "La consulta se completa con la dirección de la sucursal de destino"
      },
      async () => {
        await ir(page, `/admin/paquetes/${pk.mapa.id}`, 1600);
        await page.evaluate(() => {
          window.__abiertos = [];
        });
        await clickTexto(page, "Ver ubicación en mapa");
        const url = (await page.evaluate(() => window.__abiertos.at(-1))) || "";
        const consulta = decodeURIComponent(url.split("query=")[1] || "");
        return {
          pasa: consulta.includes("Jr. Los Pinos 145") && consulta.includes(fx.sucursalDestino.direccion),
          obtenido: url ? `Consulta «${consulta}»` : "No se abrió ninguna URL"
        };
      }
    );

    await paso("registro de paquete", async () => {
      await ir(page, "/admin/paquetes/nuevo", 1800);
      await page.select('select[name="remitenteId"]', String(fx.distribuidora.id)).catch(() => {});
      await page.select('select[name="repartidorId"]', String(fx.repartidorA.id)).catch(() => {});
      await page.select('select[name="destinatarioId"]', String(fx.clienteC1.id)).catch(() => {});
      await page.select('select[name="sucursalOrigenId"]', String(fx.sucursalOrigen.id)).catch(() => {});
      await page.select('select[name="sucursalDestinoId"]', String(fx.sucursalDestino.id)).catch(() => {});
      await sleep(400);
      await escribir(page, 'input[name="destinoTexto"]', "Jr. Callao 456, Tingo María");
      await escribir(page, 'textarea[name="descripcion"], input[name="descripcion"]', "Antibióticos y analgésicos");
      await escribir(page, 'input[name="pesoKg"]', "1.5");
      await sleep(500);
      await captura(page, "E05_registro_paquete_formulario", "Formulario de registro de paquete completado por el operador (RF-02)", { fullPage: true });
      await clickTexto(page, "Registrar paquete");
      await page.waitForFunction(() => /\/admin\/paquetes\/[^/]+$/.test(location.pathname) && !location.pathname.endsWith("nuevo"), { timeout: 10000 });
      await sleep(1500);
      await captura(page, "E05b_registro_paquete_creado", "Paquete registrado: el sistema genera el código de seguimiento y el estado «En Almacén» (RF-02)");
    });
    await contexto.close();
  }

  /* Administrador: catálogos, reportes y evidencias de defectos */
  {
    const { contexto, page } = await nuevaPagina();
    await loginPanel(page, fx.admin.usuario, fx.admin.password);
    await ir(page, "/admin/paquetes", 1500);
    await captura(page, "E11_paquetes_reporte", "Listado de paquetes con filtro por estado y descarga de reporte CSV / Excel (RF-15)");
    await ir(page, "/admin/usuarios", 1500);
    await captura(page, "E12_usuarios", "Gestión de usuarios: alta, edición y eliminación (RF-06)");
    await ir(page, "/admin/clientes", 1500);
    await captura(page, "E13_clientes", "Gestión de clientes (RF-08)");
    await ir(page, "/admin/distribuidoras", 1500);
    await captura(page, "E14_distribuidoras", "Gestión de distribuidoras (RF-09)");
    await ir(page, "/admin/sucursales", 1500);
    await captura(page, "E15_sucursales", "Gestión de sucursales (RF-10)");

    await ir(page, `/admin/paquetes/${fx.paquetes.p1.id}`, 1800);
    await paso("timeline retroceso", async () => {
      await capturaElemento(page, "ol", "D04_retroceso_entregado", `Línea de tiempo de ${fx.paquetes.p1.codigo}: el paquete «Entregado» volvió a «En Almacén» (CP-10)`, 24);
    });
    await ir(page, `/admin/paquetes/${fx.paquetes.p2.id}`, 1800);
    await paso("timeline sin tránsito", async () => {
      await capturaElemento(page, "ol", "D05_entrega_sin_transito", `Línea de tiempo de ${fx.paquetes.p2.codigo}: pasa de «En Almacén» a «Entregado» sin salir del almacén (CP-11)`, 24);
    });
    await ir(page, `/admin/paquetes/${fx.paquetes.p3.id}`, 1800);
    await captura(page, "D06_operador_desasignado", `Paquete ${fx.paquetes.p3.codigo} sin operador después de que el Operador B quitó la asignación del Operador A (CP-43)`);

    await paso("registro de actividad", async () => {
      await ir(page, "/admin/actividad", 1800);
      const nombreCliente = await api("GET", "/api/users", { token: tokens.admin }).then(
        (r) => (r.body || []).find((u) => u.email === fx.clientePortal.email)?.nombre || ""
      );
      const resaltadas = await page.evaluate((nombre) => {
        const filas = [...document.querySelectorAll("tbody tr")].filter(
          (tr) => tr.innerText.includes(nombre) && !/Inicio de sesión/.test(tr.innerText)
        );
        filas.forEach((tr) => {
          tr.style.outline = "3px solid #dc2626";
          tr.style.background = "#fef2f2";
        });
        filas[0]?.scrollIntoView({ block: "center" });
        return filas.length;
      }, nombreCliente);
      await sleep(500);
      await captura(page, "D02_actividad_cliente_cambia_estado", `Registro de actividad (filas resaltadas): el usuario Cliente «${nombreCliente}» cambió el estado de un paquete ajeno y registró un paquete por el endpoint administrativo (CP-69, CP-70) — ${resaltadas} acciones`);
    });

    await caso(
      {
        id: "CP-20",
        funcion: "RF-06",
        titulo: "El formulario de edición precarga el teléfono del usuario",
        entrada: `Editar usuario ${fx.repartidorA.nombre}`,
        esperado: "El campo teléfono muestra el número registrado (9 dígitos) y el país"
      },
      async () => {
        await ir(page, `/admin/usuarios/${fx.repartidorA.id}/editar`, 1800);
        const valor = await page.$eval('input[name="telefonoNumero"]', (el) => el.value).catch(() => null);
        await captura(page, "D07_edicion_usuario_telefono", "Formulario «Editar usuario»: el campo teléfono aparece vacío aunque el usuario tiene un número registrado (CP-20)");
        await clickTexto(page, "Guardar cambios");
        await sleep(1000);
        await captura(page, "D07b_edicion_usuario_error", "Para guardar cualquier cambio el administrador debe volver a digitar el teléfono (CP-20)");
        return {
          pasa: digitos(valor).length === 9,
          obtenido: valor ? `Campo teléfono = «${valor}»` : "Campo teléfono vacío: el número registrado no se precarga"
        };
      }
    );

    await paso("usuario con email duplicado", async () => {
      await ir(page, "/admin/usuarios/nuevo", 1800);
      await escribir(page, 'input[name="nombre"]', "Operador Duplicado");
      await escribir(page, 'input[name="email"]', fx.operadorA.email);
      await escribir(page, 'input[name="telefonoNumero"]', "912345678");
      await escribir(page, 'input[name="password"]', "Clave2026");
      await page.select('select[name="rolId"]', String(fx.roles.operador)).catch(() => {});
      await page.select('select[name="sucursalId"]', String(fx.sucursalOrigen.id)).catch(() => {});
      await sleep(300);
      await clickTexto(page, "Guardar usuario");
      await sleep(8000);
      await captura(page, "D08_usuario_email_duplicado", "Alta de usuario con email ya registrado: tras 8 s el botón sigue en «Guardando...» porque el servidor nunca responde (CP-22)", { fullPage: true });
    });

    await paso("eliminar repartidor con paquetes", async () => {
      await ir(page, "/admin/usuarios", 1800);
      await page.evaluate((nombre) => {
        const fila = [...document.querySelectorAll("main main div")].find(
          (d) => d.innerText.includes(nombre) && d.querySelectorAll("button").length >= 2 && d.innerText.length < 400
        );
        const botones = fila ? [...fila.querySelectorAll("button")] : [];
        botones.at(-1)?.click();
      }, fx.repartidorA.nombre);
      await sleep(800);
      await clickTexto(page, "Sí, eliminar");
      await sleep(8000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(300);
      await captura(page, "D09_eliminar_repartidor_con_paquetes", "Eliminación de un repartidor con paquetes asignados: el modal queda en «Eliminando...» sin respuesta (CP-24)");
    });
    await contexto.close();
  }

  /* Portal del cliente: mis envíos, alta de destinatario y pago en efectivo */
  {
    const { contexto, page } = await nuevaPagina();
    await loginCliente(page, fx.clientePortal.email, fx.clientePortal.password);
    await ir(page, "/cliente/envios", 1500);
    await captura(page, "E16_portal_mis_envios", "Portal del cliente: «Mis envíos» como remitente o destinatario (FD-06)");
    await ir(page, "/cliente/enviar", 1500);
    await captura(page, "E17_portal_enviar_paquete", "Portal del cliente: formulario «Enviar paquete» con cálculo de tarifa (FD-02)", { fullPage: true });

    await paso("alta de destinatario desde el portal", async () => {
      await clickTexto(page, "+ Agregar nuevo");
      await escribir(page, 'form input[name="documento"]', "45678912");
      await sleep(900);
      await escribir(page, 'form input[name="nombre"]', "Jorge Paredes Ruiz");
      await escribir(page, 'form input[name="email"]', "jorge.paredes@correo.pe");
      await escribir(page, 'form input[name="telefonoNumero"]', "987123456");
      await escribir(page, 'form input[name="direccion"]', "Jr. Prado 55, Tingo María");
      await sleep(300);
      await clickTexto(page, "Agregar", "form button[type=submit]");
      await sleep(1500);
      await captura(page, "D10_portal_agregar_destinatario", "El portal ofrece «+ Agregar nuevo» destinatario, pero el servidor lo rechaza con «No autorizado» (CP-76)");
    });

    await paso("pago en efectivo desde el portal", async () => {
      await ir(page, `/cliente/envios/${pk.pagoCliente.id}`, 1600);
      await clickTexto(page, "Pagar ahora");
      await clickTexto(page, "Efectivo");
      await sleep(400);
      await captura(page, "D11a_portal_efectivo_mensaje", "El portal indica «Pagarás en efectivo al momento de la entrega» (CP-80)");
      await clickTexto(page, "Confirmar pago");
      await sleep(1500);
      await captura(page, "D11b_portal_efectivo_pagado", "Sin haberse cobrado, el envío queda como «Envío pagado» (CP-80)");
    });
    await contexto.close();
  }

  /* Panel: el paquete «pagado» en efectivo ya no permite registrar el cobro */
  {
    const { contexto, page } = await nuevaPagina();
    await loginPanel(page, fx.admin.usuario, fx.admin.password);
    await paso("pago visto desde el panel", async () => {
      await ir(page, `/admin/paquetes/${pk.pagoCliente.id}`, 1800);
      await capturaElemento(page, "div.text-center", "D11c_panel_pago_registrado", "En el panel el envío figura «Pagado (efectivo)» y desaparece «Registrar pago» para el repartidor (CP-80)");
    });
    await contexto.close();
  }

  /* Destinatario registrado con su DNI: «Mis envíos» vacío en PostgreSQL */
  if (fx.clienteC1Portal) {
    const { contexto, page } = await nuevaPagina();
    await paso("mis envíos del destinatario registrado", async () => {
      await loginCliente(page, fx.clienteC1Portal.email, fx.clienteC1Portal.password);
      await ir(page, "/cliente/envios", 1500);
      await captura(page, "D12_destinatario_sin_envios", `${fx.clienteC1.nombre} se registró con su DNI, pero «Mis envíos» no muestra los paquetes que ya tenía (CP-74)`);
    });
    await contexto.close();
  }

  /* Seguimiento público: reprogramar con fecha pasada */
  {
    const { contexto, page } = await nuevaPagina();
    await paso("reprogramación con fecha pasada", async () => {
      await ir(page, `/seguimiento?code=${encodeURIComponent(pk.transito.codigoSeguimiento)}`, 1800);
      await captura(page, "E18a_seguimiento_intento_fallido", `Seguimiento público de ${pk.transito.codigoSeguimiento} con «Intento fallido» y el botón «Reprogramar envío» (RF-01, FD-05)`, { fullPage: true });
      await clickTexto(page, "Reprogramar envío");
      await sleep(500);
      await captura(page, "E18_reprogramar_modal", "El destinatario reprograma la entrega desde el seguimiento público (FD-05)");
      const ayer = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date(Date.now() - 86400000));
      await escribir(page, 'input[name="fecha"]', ayer);
      await sleep(300);
      await clickTexto(page, "Reprogramar", "div.fixed button", true);
      await sleep(1800);
      await captura(page, "D13_reprogramacion_fecha_pasada", `La entrega quedó reprogramada para ${ayer} (fecha pasada) y el paquete vuelve a «En Tránsito» (CP-86)`, { fullPage: true });
    });
    await contexto.close();
  }

  await browser.close();

  fs.writeFileSync(
    path.join(RESULTADOS, "resultados_ui_postgresql.json"),
    JSON.stringify({ modo: "postgresql", web: WEB, api: API, fecha: new Date().toISOString(), casos, capturas }, null, 2)
  );
  const pasan = casos.filter((c) => c.pasa).length;
  console.log(`\nCasos de interfaz: ${casos.length}   Pasan: ${pasan}   Fallan: ${casos.length - pasan}`);
  console.log(`Capturas: ${capturas.length}`);
};

main().catch(async (err) => {
  console.error("La evaluación de interfaz no pudo completarse:", err);
  await browser?.close();
  process.exit(1);
});
