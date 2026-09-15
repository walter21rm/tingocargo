# Empresa de logística y transporte

Proyecto web basado en el documento funcional proporcionado. Incluye:

- **Frontend**: React + Tailwind (cliente público y panel administrativo básico).
- **Backend**: Node.js + Express (API REST).
- **Base de datos**: PostgreSQL (esquema incluido, integración preparada).

## Estructura

```
frontend/   # Aplicación web React
backend/    # API REST en Express
sql/        # Esquema SQL para PostgreSQL
```

## Requisitos

- Node.js 18+
- npm 9+
- (Opcional) PostgreSQL 14+

## Inicio rápido (sin BD)

### Backend

```
cd backend
npm install
npm run dev
```

### Frontend

```
cd frontend
npm install
npm run dev
```

## Datos de prueba

- Código de seguimiento demo: `TM-2026-0001`
- Acceso administrativo: navegar a `http://localhost:5173/admin`

## Configuración BD (opcional)

1. Crear una base de datos en PostgreSQL.
2. Ejecutar el script `sql/schema.sql`.
3. Copiar `backend/.env.example` a `backend/.env` y completar credenciales.
4. Cambiar `USE_DB=true` en el `.env` para activar PostgreSQL.

## Notas

- El backend funciona en modo memoria por defecto para facilitar pruebas.
- El módulo de seguimiento público no requiere autenticación.
