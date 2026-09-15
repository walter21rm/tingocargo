# DOCUMENTACIÓN DEL PROYECTO — TingoCargo

## Sistema de Transporte y Logística

---

## 1. INTRODUCCIÓN

### 1.1 ¿Qué es TingoCargo?

TingoCargo es un sistema web diseñado para gestionar el envío, seguimiento y entrega de paquetes. Permite que distribuidoras y clientes registren envíos, que operadores logísticos los administren, que repartidores gestionen las entregas, y que los destinatarios rastreen sus paquetes en tiempo real.

### 1.2 ¿Qué problema resuelve?

El sistema digitaliza todo el flujo logístico de una empresa de transporte:

- **Registro de envíos** desde distribuidoras o entre clientes particulares.
- **Asignación de operadores y repartidores** a cada paquete.
- **Seguimiento en tiempo real** del estado del paquete (En Almacén → En Tránsito → Entregado).
- **Cobro y registro de pagos** con múltiples métodos (tarjeta, Yape, efectivo).
- **Reprogramación de entregas** cuando el destinatario no está disponible.
- **Generación de reportes** de paquetes en formato CSV o Excel.

### 1.3 ¿Quiénes lo usan?

El sistema tiene **5 roles de usuario**, cada uno con distintas capacidades:

| Rol | Descripción |
|-----|-------------|
| **Administrador** | Control total: gestiona usuarios, sucursales, distribuidoras, paquetes y reportes. |
| **Operador logístico** | Crea paquetes, asigna repartidores, registra pagos, gestiona clientes. |
| **Repartidor** | Ve sus paquetes asignados, cambia estados a "Entregado" o "Intento fallido", cobra en destino. |
| **Cliente** (registrado) | Envía paquetes a otros clientes, paga sus envíos, rastrea sus paquetes. |
| **Visitante** (sin cuenta) | Rastrea un paquete usando el código de seguimiento desde la página pública. |

---

## 2. TECNOLOGÍAS UTILIZADAS

### 2.1 Frontend (lo que ve el usuario)

| Tecnología | Versión | ¿Para qué se usa? |
|------------|---------|--------------------|
| **React** | 18.3.1 | Librería principal para construir la interfaz de usuario con componentes reutilizables. |
| **React Router** | 6.26.2 | Manejo de navegación y rutas (URLs) dentro de la aplicación sin recargar la página. |
| **Tailwind CSS** | 3.4.11 | Framework de estilos para diseñar la interfaz de forma rápida y responsiva. |
| **Vite** | 5.4.8 | Herramienta de desarrollo que compila el proyecto y proporciona un servidor de desarrollo rápido. |

### 2.2 Backend (la lógica del servidor)

| Tecnología | Versión | ¿Para qué se usa? |
|------------|---------|--------------------|
| **Node.js** | 18+ | Entorno de ejecución de JavaScript en el servidor. |
| **Express** | 4.19.2 | Framework web que facilita crear la API REST (las rutas del servidor). |
| **PostgreSQL** | 14+ | Base de datos relacional donde se almacenan todos los datos del sistema. |
| **pg** | 8.11.5 | Librería que conecta Node.js con la base de datos PostgreSQL. |
| **bcryptjs** | 3.0.3 | Cifrado de contraseñas para almacenarlas de forma segura (nunca en texto plano). |
| **dotenv** | 16.4.5 | Carga variables de configuración sensibles desde un archivo `.env`. |
| **xlsx** | 0.18.5 | Genera archivos Excel (.xlsx) para los reportes de paquetes. |
| **uuid** | 9.0.1 | Genera identificadores únicos para tokens de autenticación. |

### 2.3 Base de datos

Se utiliza **Supabase** (PostgreSQL gestionado en la nube) como base de datos principal en producción. En desarrollo, el sistema puede funcionar en **modo memoria** (sin base de datos) para facilitar las pruebas.

---

## 3. ARQUITECTURA DEL SISTEMA

### 3.1 Estructura de carpetas

```
transporte y logistica/
│
├── frontend/                   ← Aplicación web (lo que ve el usuario)
│   ├── src/
│   │   ├── components/         ← Componentes reutilizables (Navbar, Footer, etc.)
│   │   ├── pages/              ← Páginas completas (una por cada vista)
│   │   ├── services/           ← Comunicación con el backend (llamadas API)
│   │   ├── utils/              ← Funciones auxiliares (validación de teléfono)
│   │   └── App.jsx             ← Configuración de rutas
│   ├── public/                 ← Archivos estáticos (imágenes)
│   └── package.json            ← Dependencias del frontend
│
├── backend/                    ← API del servidor
│   ├── src/
│   │   ├── server.js           ← Punto de entrada: rutas, middlewares, lógica
│   │   ├── storageDb.js        ← Funciones que acceden a PostgreSQL
│   │   └── storage.js          ← Funciones en memoria (para pruebas sin BD)
│   ├── .env                    ← Variables de entorno (credenciales, configuración)
│   └── package.json            ← Dependencias del backend
│
├── sql/                        ← Scripts de base de datos
│   ├── schema.sql              ← Creación de tablas
│   └── supabase_migration.sql  ← Migración para Supabase
│
├── config.json                 ← Configuración y parametrización centralizada
└── README.md                   ← Guía rápida de inicio
```

### 3.2 ¿Cómo se comunican las partes?

El sistema sigue una arquitectura **cliente-servidor** de tres capas:

```
┌──────────────────────┐
│     USUARIO           │  ← Navegador web (Chrome, Firefox, etc.)
│  (React + Tailwind)   │
└──────────┬───────────┘
           │ Peticiones HTTP (fetch)
           ▼
┌──────────────────────┐
│     SERVIDOR          │  ← Node.js + Express (API REST)
│   (API en Express)    │
└──────────┬───────────┘
           │ Consultas SQL
           ▼
┌──────────────────────┐
│   BASE DE DATOS       │  ← PostgreSQL (Supabase)
│   (PostgreSQL)        │
└──────────────────────┘
```

**Flujo de una operación típica (ejemplo: crear un paquete):**

1. El usuario llena el formulario en el **frontend** (React).
2. El frontend envía los datos al **backend** mediante una petición HTTP POST a `/api/packages`.
3. El backend valida los datos, verifica los permisos del usuario y guarda el paquete en la **base de datos**.
4. La base de datos confirma la operación y el backend responde con el paquete creado.
5. El frontend muestra el resultado al usuario.

### 3.3 Principio de abstracción en el almacenamiento

El backend implementa un patrón de **abstracción** que permite cambiar entre dos modos de almacenamiento sin modificar la lógica del servidor:

```
server.js  →  ¿USE_DB=true?  →  Sí  →  storageDb.js (PostgreSQL)
                               →  No  →  storage.js   (Memoria RAM)
```

Ambos archivos (`storageDb.js` y `storage.js`) exponen **exactamente las mismas funciones** con los mismos nombres y parámetros. El servidor simplemente elige cuál usar según la configuración. Esto es lo que se conoce como una **interfaz por convención**: ambos módulos cumplen el mismo "contrato" aunque JavaScript no tenga interfaces formales.

---

## 4. BASE DE DATOS

### 4.1 Diagrama de tablas

El sistema usa **6 tablas principales** y **1 tabla de historial**:

```
┌───────────┐     ┌──────────────┐     ┌─────────────┐
│   roles   │     │  sucursales  │     │distribuidoras│
│───────────│     │──────────────│     │─────────────│
│ id        │     │ id           │     │ id          │
│ nombre    │     │ nombre       │     │ nombre      │
└─────┬─────┘     │ direccion    │     │ razon_social│
      │           └──────┬───────┘     │ telefono    │
      │                  │             │ direccion   │
      ▼                  ▼             └──────┬──────┘
┌──────────────────────────────┐              │
│          usuarios            │              │
│──────────────────────────────│              │
│ id                           │              │
│ nombre, email, telefono      │              │
│ rol_id → roles               │              │
│ sucursal_id → sucursales     │              │
│ cliente_id → clientes        │              │
│ password_hash                │              │
│ placa, vehiculo (repartidor) │              │
│ activo                       │              │
└──────────┬───────────────────┘              │
           │                                  │
           ▼                                  ▼
┌──────────────────────────────────────────────────────┐
│                     paquetes                         │
│──────────────────────────────────────────────────────│
│ id, codigo_seguimiento                               │
│ tipo_envio (distribuidora_cliente / cliente_cliente)  │
│ remitente_id → distribuidoras                        │
│ remitente_cliente_id → clientes                      │
│ destinatario_id → clientes                           │
│ operador_id → usuarios                               │
│ repartidor_id → usuarios                             │
│ sucursal_origen_id, sucursal_destino_id → sucursales │
│ destino_texto, descripcion                           │
│ estado_actual, peso_kg, precio_envio                 │
│ quien_paga (remitente / destinatario)                │
│ pagado, metodo_pago                                  │
│ reprogramacion_fecha, hora_inicio, hora_fin, dir.    │
└──────────────────┬───────────────────────────────────┘
                   │
                   ▼
         ┌────────────────────┐
         │ historial_estados  │
         │────────────────────│
         │ id                 │
         │ paquete_id         │
         │ estado             │
         │ fecha_hora         │
         │ observacion        │
         └────────────────────┘

┌──────────────┐
│   clientes   │
│──────────────│
│ id           │
│ tipo         │
│ nombre       │
│ documento    │
│ telefono     │
│ email        │
│ direccion    │
└──────────────┘
```

### 4.2 Descripción de cada tabla

**roles** — Los 5 roles del sistema (Administrador, Operador logístico, Repartidor, Cliente, Visitante).

**sucursales** — Puntos físicos donde se reciben y despachan paquetes (nombre y dirección).

**distribuidoras** — Empresas que envían paquetes a través de TingoCargo (razón social, teléfono, dirección).

**clientes** — Personas o empresas que envían o reciben paquetes. Pueden ser de tipo "persona" o "empresa". Tienen documento (DNI/RUC), teléfono y dirección.

**usuarios** — Cuentas del sistema. Cada usuario tiene un rol, una sucursal asignada y una contraseña cifrada. Los repartidores además tienen placa y nombre de vehículo. Los usuarios con rol "Cliente" se vinculan a un registro en la tabla `clientes` mediante `cliente_id`.

**paquetes** — Núcleo del sistema. Cada paquete tiene un código de seguimiento único (ej: `TM-2026-0001`), un remitente (distribuidora o cliente), un destinatario, sucursales de origen/destino, estado actual, peso, precio, información de pago y datos de reprogramación si aplica.

**historial_estados** — Registra cada cambio de estado de un paquete con fecha y observación, formando la línea de tiempo (timeline) que el usuario ve al rastrear.

---

## 5. API REST (BACKEND)

### 5.1 ¿Qué es la API REST?

La API (Application Programming Interface) es el conjunto de rutas HTTP que el frontend usa para comunicarse con el servidor. Cada ruta tiene un **método** (GET, POST, PUT, PATCH, DELETE), una **URL** y permisos de acceso.

### 5.2 Rutas públicas (sin autenticación)

Estas rutas son accesibles por cualquier persona, sin necesidad de iniciar sesión:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/health` | Verifica que el servidor esté activo. Retorna `{ status: "ok" }`. |
| `POST` | `/api/auth/login` | Inicio de sesión. Recibe email y contraseña, retorna un token y los datos del usuario. |
| `POST` | `/api/auth/register` | Registro de nuevos clientes. Crea un cliente y su usuario asociado. |
| `GET` | `/api/tracking/:code` | Seguimiento público. Recibe un código (ej: `TM-2026-0001`) y retorna el estado del paquete con su historial. |
| `POST` | `/api/tracking/:code/reprogramar` | Permite al destinatario reprogramar la fecha y hora de entrega. |
| `GET` | `/api/dni/:dni` | Consulta datos de una persona en RENIEC a través de una API externa. |

### 5.3 Rutas del cliente (requiere rol Cliente)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/client/me/packages` | Lista los paquetes del cliente autenticado (donde es remitente o destinatario). |
| `POST` | `/api/client/packages` | Crea un envío de cliente a cliente. |
| `PATCH` | `/api/client/packages/:id/pagar` | Paga un paquete seleccionando método de pago (tarjeta, Yape, efectivo). |

### 5.4 Rutas del repartidor

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/couriers/me/packages` | Lista los paquetes asignados al repartidor autenticado. |

### 5.5 Rutas administrativas (requiere autenticación)

#### Gestión de paquetes

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| `GET` | `/api/packages` | Todos los autenticados | Lista paquetes (filtro por estado). |
| `GET` | `/api/packages/expanded` | Todos (filtrado por rol) | Lista paquetes con datos completos (nombres de remitente, destinatario, operador, etc.). |
| `GET` | `/api/packages/:id` | Todos los autenticados | Detalle completo de un paquete con historial. |
| `POST` | `/api/packages` | Admin, Operador | Crea un paquete nuevo (distribuidora → cliente). |
| `PATCH` | `/api/packages/:id/status` | Todos (Repartidor solo Entregado/Intento fallido) | Cambia el estado de un paquete. |
| `PATCH` | `/api/packages/:id/precio` | Admin, Operador | Asigna el precio de envío. |
| `PATCH` | `/api/packages/:id/operador` | Admin, Operador | Asigna un operador logístico. |
| `PATCH` | `/api/packages/:id/repartidor` | Admin, Operador | Asigna un repartidor. |
| `PATCH` | `/api/packages/:id/reprogramar` | Todos los autenticados | Reprograma fecha/hora de entrega. |
| `PATCH` | `/api/packages/:id/registrar-pago-destino` | Admin, Operador, Repartidor | Registra el pago en destino con método de pago. |

#### Gestión de usuarios

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| `GET` | `/api/users` | Solo Administrador | Lista todos los usuarios del sistema. |
| `GET` | `/api/users/:id` | Solo Administrador | Obtiene los datos de un usuario específico. |
| `POST` | `/api/users` | Solo Administrador | Crea un nuevo usuario (cualquier rol). |
| `PUT` | `/api/users/:id` | Solo Administrador | Actualiza los datos de un usuario. |
| `DELETE` | `/api/users/:id` | Solo Administrador | Elimina un usuario. |

#### Catálogos y recursos

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| `GET` | `/api/clients` | Todos los autenticados | Lista clientes registrados. |
| `POST` | `/api/clients` | Todos los autenticados | Crea un nuevo cliente. |
| `GET` | `/api/operators` | Todos los autenticados | Lista operadores logísticos. |
| `GET` | `/api/operators/phone` | Todos los autenticados | Obtiene el teléfono del operador (para contacto). |
| `GET` | `/api/couriers` | Todos los autenticados | Lista repartidores disponibles. |
| `GET` | `/api/roles` | Todos los autenticados | Lista los roles del sistema. |
| `GET` | `/api/branches` | Todos los autenticados | Lista sucursales. |
| `POST` | `/api/branches` | Todos los autenticados | Crea una sucursal. |
| `GET` | `/api/statuses` | Todos los autenticados | Lista los estados posibles de un paquete. |
| `GET` | `/api/distributors` | Todos los autenticados | Lista distribuidoras. |
| `POST` | `/api/distributors` | Todos los autenticados | Crea una distribuidora. |
| `GET` | `/api/reports/packages` | Todos los autenticados | Descarga reporte de paquetes en CSV o Excel. |

---

## 6. FRONTEND (INTERFAZ DE USUARIO)

### 6.1 Componentes reutilizables

Estos componentes se usan en múltiples páginas del sistema:

| Componente | Descripción |
|------------|-------------|
| **Navbar** | Barra superior de navegación con logo, enlaces a login, registro y panel admin. En móvil muestra un menú hamburguesa. |
| **Footer** | Pie de página con el nombre de la empresa y año. |
| **PhoneField** | Campo de teléfono inteligente con selector de país (bandera y código), validación automática según la cantidad de dígitos del país seleccionado. |
| **Timeline** | Línea de tiempo visual que muestra los estados por los que ha pasado un paquete, con fechas y observaciones. |
| **StatCard** | Tarjeta de estadística usada en el dashboard (muestra un número, una etiqueta y un ícono con colores personalizados). |

### 6.2 Páginas públicas

| Página | Ruta | Descripción |
|--------|------|-------------|
| **Home** | `/` | Página de inicio con un formulario para rastrear paquetes ingresando el código de seguimiento. |
| **Tracking** | `/seguimiento` | Página de seguimiento público. Muestra la línea de tiempo del paquete, datos del envío, y permite reprogramar la entrega. |

### 6.3 Portal del cliente

| Página | Ruta | Descripción |
|--------|------|-------------|
| **ClientRegister** | `/cliente/registro` | Formulario de registro para nuevos clientes. Permite consultar DNI automáticamente, ingresar datos personales y teléfono. |
| **ClientLogin** | `/cliente/login` | Inicio de sesión para clientes registrados. |
| **ClientDashboard** | `/cliente` | Panel principal del cliente con accesos directos a enviar paquetes, rastrear y ver historial. |
| **ClientPackageNew** | `/cliente/enviar` | Formulario para crear un envío de cliente a cliente. Incluye peso, selección de quién paga y cálculo de precio. |
| **ClientPackages** | `/cliente/envios` | Lista de todos los envíos del cliente (como remitente o destinatario) con estado actual. |
| **ClientPackageDetail** | `/cliente/envios/:id` | Detalle de un envío con línea de tiempo y opción de pago (tarjeta, Yape, efectivo). |
| **ClientTracking** | `/cliente/rastrear` | Buscador de paquetes por código dentro del portal del cliente. |

### 6.4 Panel administrativo

| Página | Ruta | Descripción |
|--------|------|-------------|
| **AdminLogin** | `/admin/login` | Inicio de sesión para personal interno (admin, operador, repartidor). Incluye un carrusel visual. |
| **AdminDashboard** | `/admin` | Dashboard con 4 tarjetas de estadísticas (ingresados, en almacén, en tránsito, entregados) y tabla de últimos paquetes. |
| **AdminPackages** | `/admin/paquetes` | Lista completa de paquetes con filtros por estado y descarga de reportes. Los repartidores solo ven sus paquetes asignados. |
| **AdminPackageNew** | `/admin/paquetes/nuevo` | Formulario para crear paquetes. Incluye selección de remitente (distribuidora), destinatario, sucursales, operador, repartidor, peso y quién paga. |
| **AdminPackageDetail** | `/admin/paquetes/:id` | Vista completa del paquete: línea de tiempo, cambio de estado, reprogramación, asignación de precio/operador/repartidor, y registro de pago con modal de métodos de pago. |
| **AdminClients** | `/admin/clientes` | Lista de clientes registrados con opción de crear nuevos. |
| **AdminClientNew** | `/admin/clientes/nuevo` | Formulario para registrar clientes (persona o empresa). |
| **AdminUsers** | `/admin/usuarios` | Lista de usuarios del sistema con opciones de editar y eliminar (con modal de confirmación estilizado). |
| **AdminUserNew** | `/admin/usuarios/nuevo` | Formulario para crear usuarios. Al seleccionar rol "Repartidor" aparecen campos adicionales de placa y vehículo. |
| **AdminUserEdit** | `/admin/usuarios/:id/editar` | Formulario para editar un usuario existente con todos sus campos. |
| **AdminDistributors** | `/admin/distribuidoras` | Lista de distribuidoras con opción de crear nuevas. |
| **AdminDistributorNew** | `/admin/distribuidoras/nuevo` | Formulario para crear distribuidoras (nombre, razón social, teléfono, dirección). |
| **AdminBranches** | `/admin/sucursales` | Lista de sucursales. |
| **AdminBranchNew** | `/admin/sucursales/nuevo` | Formulario para crear sucursales (nombre y dirección). |

### 6.5 Control de acceso en el frontend

El frontend implementa 3 guardias de ruta que protegen las páginas según el rol del usuario:

- **RequireAuth** — Verifica que exista un token de sesión activo. Si no, redirige a `/admin/login`.
- **RequireRole** — Verifica que el rol del usuario esté dentro de los roles permitidos. Si no, redirige a `/admin`.
- **RequireClient** — Verifica que el usuario sea un cliente autenticado. Si no, redirige a `/cliente/login`.

---

## 7. FLUJOS PRINCIPALES DEL SISTEMA

### 7.1 Flujo de un envío (distribuidora → cliente)

```
1. El operador logístico crea el paquete
   → Selecciona distribuidora remitente
   → Selecciona o crea el cliente destinatario
   → Ingresa peso, sucursal, descripción
   → El sistema genera código de seguimiento (TM-YYYY-XXXX)
   → El sistema calcula precio (S/10 si peso ≤ 2kg)

2. Asignación
   → El operador asigna un repartidor al paquete
   → Estado: "En Almacén"

3. Tránsito
   → El repartidor cambia estado a "En Tránsito"
   → El destinatario puede rastrear con su código

4. Entrega
   → El repartidor llega al destino
   → Si el destinatario paga: el repartidor registra el pago
     (selecciona método: tarjeta, Yape o efectivo)
   → Cambia estado a "Entregado"

5. Intento fallido (alternativa)
   → El destinatario no está disponible
   → El repartidor marca "Intento fallido"
   → El destinatario puede reprogramar fecha y hora
```

### 7.2 Flujo de un envío (cliente → cliente)

```
1. El cliente remitente inicia sesión en el portal
2. Crea un envío ingresando datos del destinatario, sucursal y peso
3. Selecciona quién paga: remitente o destinatario
4. Si paga el remitente → paga al crear el envío (tarjeta, Yape, efectivo)
5. Si paga el destinatario → el pago se cobra al entregar
6. El operador asigna repartidor
7. El repartidor gestiona la entrega (igual que el flujo anterior)
```

### 7.3 Flujo de pago

```
┌─────────────────┐
│ ¿Quién paga?    │
├─────────────────┤
│                 │
▼                 ▼
Remitente         Destinatario
│                 │
│ Paga al crear   │ Paga al recibir
│ el envío        │ la entrega
│                 │
▼                 ▼
Selecciona        El repartidor u operador
método de pago:   registra el pago en destino:
- Tarjeta         - Tarjeta
- Yape            - Yape
- Efectivo        - Efectivo
│                 │
▼                 ▼
paquete.pagado = true
paquete.metodo_pago = "tarjeta|yape|efectivo"
```

---

## 8. SEGURIDAD

### 8.1 Autenticación

El sistema usa **autenticación basada en tokens**:

1. El usuario envía su email y contraseña al endpoint `/api/auth/login`.
2. El backend verifica la contraseña usando **bcrypt** (compara el hash almacenado con la contraseña ingresada).
3. Si es correcta, genera un **token único** (UUID) y lo almacena en un mapa en memoria del servidor.
4. El frontend guarda el token en `localStorage` y lo envía en cada petición HTTP mediante el header `Authorization: Bearer <token>`.
5. El backend verifica el token en cada ruta protegida usando un middleware (`requireAuth`).

### 8.2 Autorización por roles

Cada ruta del backend verifica el rol del usuario autenticado:

- `requireAdmin` — Solo permite acceso al rol "Administrador".
- `requireAdminOrOperator` — Permite "Administrador" u "Operador logístico".
- `requireAuth` — Permite cualquier usuario autenticado.

### 8.3 Cifrado de contraseñas

Las contraseñas nunca se almacenan en texto plano. Se usa **bcrypt** con un factor de costo de 10 rondas para generar un hash irreversible antes de guardar en la base de datos.

---

## 9. CONFIGURACIÓN Y PARAMETRIZACIÓN

### 9.1 Variables de entorno (`.env`)

El archivo `backend/.env` contiene configuraciones sensibles que no deben subirse al repositorio:

| Variable | Descripción |
|----------|-------------|
| `USE_DB` | `true` para usar PostgreSQL, `false` para modo memoria. |
| `DATABASE_URL` | URL de conexión a PostgreSQL (host, puerto, usuario, contraseña, base de datos). |
| `DNI_API_URL` | URL de la API externa de RENIEC para consultar DNI. |
| `DNI_API_TOKEN` | Token de autenticación para la API de DNI. |
| `PORT` | Puerto del servidor (por defecto: 4000). |
| `ADMIN_USER` | Usuario del login administrativo inicial. |
| `ADMIN_PASS` | Contraseña del login administrativo inicial. |
| `ADMIN_SEED_NAME` | Nombre del administrador semilla (creado al iniciar). |
| `ADMIN_SEED_EMAIL` | Email del administrador semilla. |
| `ADMIN_SEED_PASS` | Contraseña del administrador semilla. |

### 9.2 Archivo `config.json`

Centraliza la configuración técnica y las reglas de negocio en un solo lugar:

**Configuración técnica (cómo funciona el sistema):**
- Puerto del servidor, zona horaria.
- URL de la base de datos.
- URLs de APIs externas.
- Credenciales del administrador inicial.

**Parametrización de negocio (reglas que pueden cambiar):**
- Tarifa estándar: S/10 para paquetes de hasta 2 kg.
- Estados posibles del paquete: En Almacén, En Tránsito, Entregado, Intento fallido.
- Prefijo de código de seguimiento: `TM-`.
- Métodos de pago aceptados: tarjeta, Yape, efectivo.
- Países habilitados para teléfonos con sus códigos y longitudes.

---

## 10. CAPA DE DATOS (STORAGE)

### 10.1 Funciones disponibles

Tanto `storageDb.js` (PostgreSQL) como `storage.js` (memoria) exponen las mismas funciones:

#### Clientes
| Función | Descripción |
|---------|-------------|
| `listClients()` | Retorna todos los clientes. |
| `createClient(data)` | Crea un nuevo cliente. |
| `updateClient(id, data)` | Actualiza datos de un cliente. |
| `getClientById(id)` | Obtiene un cliente por su ID. |
| `getClientByDocumento(doc)` | Busca un cliente por número de documento. |

#### Usuarios
| Función | Descripción |
|---------|-------------|
| `listUsers()` | Retorna todos los usuarios con nombre de rol y sucursal. |
| `getUserById(id)` | Obtiene un usuario por ID. |
| `getUserByEmail(email)` | Busca un usuario por email (usado en login). |
| `createUser(data)` | Crea un usuario nuevo. |
| `updateUser(id, data)` | Actualiza un usuario. |
| `deleteUser(id)` | Elimina un usuario. |
| `listOperators()` | Lista usuarios con rol "Operador logístico". |
| `listCouriers()` | Lista usuarios con rol "Repartidor" (incluye placa y vehículo). |
| `getOperatorPhone()` | Retorna el teléfono del primer operador encontrado. |

#### Paquetes
| Función | Descripción |
|---------|-------------|
| `listPackages(estado)` | Lista paquetes, filtrados opcionalmente por estado. |
| `listPackagesDetailed(estado)` | Lista paquetes con datos expandidos (nombres de personas, no solo IDs). |
| `listPackagesByCourier(courierId)` | Paquetes asignados a un repartidor específico. |
| `listPackagesByClient(clienteId)` | Paquetes donde el cliente es remitente o destinatario. |
| `createPackage(data)` | Crea un paquete nuevo con código de seguimiento. |
| `getPackageById(id)` | Obtiene un paquete por ID. |
| `getPackageDetailsById(id)` | Paquete completo con historial de estados. |
| `updatePackageStatus(id, estado, obs)` | Cambia el estado y registra en historial. |
| `updatePackagePrecio(id, precio)` | Asigna el precio de envío. |
| `updatePackageOperador(id, operadorId)` | Asigna un operador. |
| `updatePackageRepartidor(id, repartidorId)` | Asigna un repartidor. |
| `markPackagePagado(id, metodoPago)` | Marca como pagado y registra el método. |
| `updatePackageReprogramar(id, data)` | Guarda fecha, hora y dirección de reprogramación. |
| `getTrackingByCode(code)` | Busca un paquete por código de seguimiento (uso público). |

#### Catálogos
| Función | Descripción |
|---------|-------------|
| `listRoles()` | Lista roles del sistema. |
| `listBranches()` | Lista sucursales. |
| `createBranch(data)` | Crea una sucursal. |
| `listStatuses()` | Retorna los estados posibles de un paquete. |
| `listDistributors()` | Lista distribuidoras. |
| `createDistributor(data)` | Crea una distribuidora. |

---

## 11. SERVICIOS DEL FRONTEND (api.js)

El archivo `frontend/src/services/api.js` centraliza **todas** las llamadas HTTP al backend. Ninguna página del frontend llama directamente a `fetch()`; todas usan las funciones de este archivo.

### 11.1 Autenticación y sesión

| Función | Descripción |
|---------|-------------|
| `getToken()` | Lee el token del `localStorage`. |
| `setToken(token)` | Guarda el token en `localStorage`. |
| `getUser()` | Lee y parsea los datos del usuario desde `localStorage`. |
| `setUser(user)` | Guarda los datos del usuario en `localStorage`. |
| `clearToken()` | Elimina token y usuario (cierre de sesión). |
| `login(data)` | Envía credenciales y retorna token + datos del usuario. |
| `register(data)` | Registra un nuevo cliente. |

### 11.2 Paquetes y pagos

| Función | Descripción |
|---------|-------------|
| `listPackages()` | Lista paquetes expandidos. |
| `listCourierPackages()` | Lista paquetes del repartidor autenticado. |
| `listClientPackages()` | Lista paquetes del cliente autenticado. |
| `getPackageById(id)` | Detalle de un paquete. |
| `createPackage(data)` | Crea un paquete (admin/operador). |
| `createClientPackage(data)` | Crea un paquete (cliente a cliente). |
| `updatePackageStatus(id, data)` | Cambia estado. |
| `updatePackagePrecio(id, precio)` | Asigna precio. |
| `updatePackageOperador(id, opId)` | Asigna operador. |
| `updatePackageRepartidor(id, repId)` | Asigna repartidor. |
| `reprogramarPackage(id, data)` | Reprograma entrega. |
| `payClientPackage(id, metodo)` | Paga paquete como cliente. |
| `registrarPagoDestino(id, metodo)` | Registra pago en destino (operador/repartidor). |

### 11.3 Catálogos y consultas

| Función | Descripción |
|---------|-------------|
| `listClients()` | Lista clientes. |
| `createClient(data)` | Crea cliente. |
| `getDniData(dni)` | Consulta datos de RENIEC por DNI. |
| `listUsers()` | Lista usuarios. |
| `getUserById(id)` | Datos de un usuario. |
| `createUser(data)` | Crea usuario. |
| `updateUser(id, data)` | Actualiza usuario. |
| `deleteUser(id)` | Elimina usuario. |
| `listRoles()` | Lista roles. |
| `listOperators()` | Lista operadores. |
| `listCouriers()` | Lista repartidores. |
| `listBranches()` | Lista sucursales. |
| `createBranch(data)` | Crea sucursal. |
| `listStatuses()` | Lista estados. |
| `listDistributors()` | Lista distribuidoras. |
| `createDistributor(data)` | Crea distribuidora. |
| `getOperatorPhone()` | Teléfono del operador. |
| `getTracking(code)` | Seguimiento público. |
| `reprogramarTracking(code, data)` | Reprogramar desde seguimiento público. |
| `downloadPackagesReport(params)` | Descarga reporte CSV/XLSX. |
| `getHealth()` | Verifica estado del servidor. |

---

## 12. UTILIDADES

### 12.1 Validación de teléfonos (`phone.js`)

El módulo `frontend/src/utils/phone.js` proporciona:

- **`PHONE_COUNTRIES`** — Lista de 9 países soportados (PE, CL, CO, EC, MX, US, BO, AR, BR) con su bandera, código de discado y cantidad de dígitos esperados.
- **`validatePhone(number, countryIso)`** — Valida que un número tenga la cantidad correcta de dígitos según el país.
- **`buildPhoneValue(number, countryIso)`** — Construye el número en formato E.164 internacional (ej: `+51987654321`).
- **`splitPhoneValue(e164)`** — Separa un número E.164 en código de país y número local.

---

## 13. DISEÑO RESPONSIVO

Toda la aplicación está diseñada para funcionar correctamente en:

- **Escritorio** (1024px+): Layout con sidebar lateral, tablas completas, formularios anchos.
- **Tablet** (768px–1023px): Sidebar colapsable, tablas con scroll horizontal.
- **Móvil** (< 768px): Menú hamburguesa, formularios en columna, tarjetas apiladas, botones de ancho completo.

Se utiliza Tailwind CSS con sus breakpoints responsivos (`sm:`, `md:`, `lg:`) para adaptar cada componente según el tamaño de pantalla.

---

## 14. CÓMO EJECUTAR EL PROYECTO

### 14.1 Requisitos

- **Node.js** versión 18 o superior.
- **npm** versión 9 o superior.
- (Opcional) **PostgreSQL** 14+ o una cuenta en **Supabase**.

### 14.2 Instalación y ejecución

**Backend:**
```
cd backend
npm install
npm run dev
```
El servidor inicia en `http://localhost:4000`.

**Frontend:**
```
cd frontend
npm install
npm run dev
```
La aplicación abre en `http://localhost:5173`.

### 14.3 Configurar base de datos (opcional)

1. Crear una base de datos en PostgreSQL o Supabase.
2. Ejecutar el script `sql/schema.sql` para crear las tablas.
3. Si es Supabase existente, ejecutar `sql/supabase_migration.sql` para las migraciones adicionales.
4. Crear `backend/.env` con:
   ```
   USE_DB=true
   DATABASE_URL=postgresql://usuario:password@host:5432/nombre_bd
   ```
5. Reiniciar el backend.

### 14.4 Datos iniciales

Al iniciar el backend por primera vez, se crean automáticamente:
- Los 5 roles del sistema.
- Un usuario administrador semilla (configurable en `.env`).
- Un código de seguimiento demo: `TM-2026-0001`.

---

## 15. GLOSARIO

| Término | Significado |
|---------|-------------|
| **API REST** | Interfaz de programación basada en HTTP que permite al frontend comunicarse con el backend usando verbos estándar (GET, POST, PUT, PATCH, DELETE). |
| **Token** | Cadena única que identifica una sesión activa. Se envía en cada petición para demostrar que el usuario está autenticado. |
| **Hash** | Resultado de aplicar un algoritmo criptográfico a una contraseña. Es irreversible: no se puede obtener la contraseña original a partir del hash. |
| **Middleware** | Función que se ejecuta antes de procesar una petición. Se usa para verificar autenticación y permisos. |
| **E.164** | Estándar internacional para números de teléfono (ej: +51987654321). |
| **Seed** | Datos iniciales que se crean automáticamente al ejecutar el sistema por primera vez. |
| **CRUD** | Acrónimo de Create, Read, Update, Delete — las 4 operaciones básicas sobre datos. |
| **SPA** | Single Page Application — aplicación web que carga una sola vez y navega sin recargar la página. |
| **Endpoint** | Una ruta específica de la API (ej: `GET /api/packages`). |
| **Breakpoint** | Punto de quiebre en diseño responsivo donde el layout cambia según el ancho de pantalla. |
