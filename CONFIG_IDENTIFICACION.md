# config.json — Configuración y Parametrización

**Proyecto:** TingoCargo — Sistema de Transporte y Logística  
**Archivo:** `config.json`

---

## Identificación por líneas

### CONFIGURACIÓN (líneas 2-24)

Valores técnicos que definen *cómo* opera el sistema. Cambian según el entorno (desarrollo/producción).

| Líneas | Clave | Tipo |
|--------|-------|------|
| 3-5 | `servidor` | Configuración |
| 4 | `puerto` | Configuración |
| 5 | `zonaHoraria` | Configuración |
| 6-9 | `baseDatos` | Configuración |
| 7 | `usar` | Configuración |
| 8 | `url` | Configuración |
| 10-14 | `api` | Configuración |
| 11 | `urlBaseFrontend` | Configuración |
| 12 | `dniUrl` | Configuración |
| 13 | `dniToken` | Configuración |
| 15-23 | `auth` | Configuración |
| 16-20 | `adminUser`, `adminPass`, `seedNombre`, `seedEmail`, `seedPassword` | Configuración |
| 21-22 | `tokenKey`, `userKey` | Configuración |

### PARAMETRIZACIÓN (líneas 25-49)

Reglas de negocio que el administrador puede ajustar sin cambiar código.

| Líneas | Clave | Tipo |
|--------|-------|------|
| 26-30 | `tarifas` | Parametrización |
| 27 | `precioEstandarSoles` | Parametrización |
| 28 | `pesoLimiteKg` | Parametrización |
| 29 | `moneda` | Parametrización |
| 31-34 | `paquetes` | Parametrización |
| 32 | `estados` | Parametrización |
| 33 | `prefijoSeguimiento` | Parametrización |
| 34 | `metodosPago` | Parametrización |
| 35-48 | `telefonos` | Parametrización |
| 36 | `paisPorDefecto` | Parametrización |
| 37-47 | `paises` | Parametrización |

---

## Resumen

```
config.json
├── configuracion (líneas 2-24)   → CONFIGURACIÓN
│   ├── servidor
│   ├── baseDatos
│   ├── api
│   └── auth
│
└── parametrizacion (líneas 25-49) → PARAMETRIZACIÓN
    ├── tarifas
    ├── paquetes
    └── telefonos
```
