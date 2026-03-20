# Analisis de costos MDI

Base inicial de una aplicacion web para historicos y comparativos de precios de construccion.

Modulos actuales base:

- autenticacion y roles
- categorias
- conceptos
- proveedores
- obras
- historicos de precios
- ajustes manuales
- comparativos

## Monorepo

- `web`: frontend React + Vite
- `api`: backend Express + MongoDB

## Requisitos

- Node.js 20+ recomendado
- npm 10+
- MongoDB local o Atlas

## Variables de entorno

### API

Copiar `api/.env.example` a `api/.env`.

### Web

Copiar `web/.env.example` a `web/.env`.

## Instalacion

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Esto levanta:

- API en `http://localhost:4000`
- Web en `http://localhost:5173`

## Seed inicial de superadmin

```bash
npm run seed:admin
```

Por defecto usa las variables de `api/.env` y crea el usuario indicado ahi.
