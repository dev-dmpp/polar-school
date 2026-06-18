# Polar School

> Plataforma educativa gratuita en español-latino sobre Linux, Docker, hosting y bases de datos.

Hecho en Panamá 🇵🇦 para LATAM. Open source, CC-BY-SA. Ver [VISION.md](./VISION.md) para la visión completa.

## Estado actual

- **F0 (en desarrollo)**: monorepo base + 1 curso piloto "Linux básico — 20 comandos" con simulador en navegador
- Próximas fases en VISION.md

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: Astro 5 (estático para F0) + Svelte 5 islands
- **Backend** (F1+): Hono + Drizzle + PostgreSQL
- **Sandbox** (F2+): xterm.js + Docker SDK en VPS
- **Hosting**: Astro estático servido por `apps/web` en el VPS vía Cloudflare Tunnel

## Estructura

```
polar-school/
├── apps/
│   └── web/                     Astro 5 (puerto 3000)
├── packages/
│   ├── content/                 Definiciones de cursos en TypeScript
│   ├── simulator/               Engine de simulación Linux (browser)
│   └── ui/                      Componentes Svelte compartidos
├── services/                    (vacío en F0, para Go/Python en F5+)
├── infra/                       (vacío en F0, para Caddy/systemd en F1+)
├── VISION.md                    Documento de visión
└── README.md                    Este archivo
```

## Desarrollo local

```bash
# instalar deps
pnpm install

# correr dev server (localhost:3000)
pnpm dev

# build de producción
pnpm build

# servir el build (preview)
pnpm start
```

## Deploy (cuando esté listo)

Pendiente F0 → F1. El plan es:

1. Build local → assets en `apps/web/dist/`
2. Copiar al VPS vía SSH (rsync o GitHub Actions)
3. `pm2 restart polar-school-web`
4. Cloudflare Tunnel expone `localhost:3000` al público

## Licencia

- **Código**: MIT
- **Contenido educativo (`.mdx`, definiciones de cursos)**: CC-BY-SA 4.0

## Créditos

Inspirado en [W3Schools](https://w3schools.com), [Cisco NetAcad](https://netacad.com), [Platzi](https://platzi.com), [FreeCodeCamp](https://freecodecamp.org), [Docker PWD](https://labs.play-with-docker.com), [TonyHost](https://tonyhost.com), [db4free](https://db4free.net), [Khan Academy](https://khanacademy.org) y [Mozilla MDN](https://developer.mozilla.org).
