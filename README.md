# Polar School

> Plataforma educativa gratuita en español-latino sobre Linux, Docker, hosting y bases de datos.

Hecho en Panamá 🇵🇦 para LATAM. Open source, CC-BY-SA. Ver [VISION.md](./VISION.md) para la visión completa.

## Estado actual

- **F0**: monorepo base + 1 curso piloto "Linux básico — 20 comandos" con simulador en navegador.
- **F1**: 8 cursos, 85 lecciones, 105 páginas estáticas, simulador con 60+ comandos.
- **F2**: páginas legales, donar, sobre, dominio `polar.school` y Cloudflare Tunnel live.
- **F3**: auth (email+contraseña con scrypt + magic link) + progreso de lecciones.
- **F4 (en curso)**: CI/CD con GitHub Actions (staging automático, prod en tag).
- **Live ahora**: ver [VISION.md](./VISION.md) §10 (fases)
- **Próximas fases**: VISION.md

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

## Deploy

Tres workflows de GitHub Actions en `.github/workflows/`:

| Workflow | Trigger | Qué hace |
|---|---|---|
| `ci.yml` | PR y push a master | Lint, typecheck, build, tests, auditoría voseo. Postgres efímero. |
| `deploy-staging.yml` | Push a master | Deploy a staging (rompible). Sin backup ni rollback. |
| `deploy-prod.yml` | Tag `v*` (ej: `v1.0.0`) | Deploy a prod con backup de DB, health checks y rollback automático. |

Ver `.github/SECRETS.md` para qué variables configurar en GitHub.

Para deploy manual en VPS:

```bash
TAG=v1.0.0 ./scripts/deploy.sh production
# o sin tag para staging:
./scripts/deploy.sh staging
```

## Licencia

**CC-BY-SA 4.0** — código y contenido. Ver [LICENSE](./LICENSE). Atribución requerida, obras derivadas deben mantener la misma licencia.

## Contribuir

PRs bienvenidos. Las lecciones viven en `packages/content/src/courses/` como archivos TypeScript tipados. Para agregar una lección, edita el array `lessons` del curso correspondiente (el tipado en `types.ts` te guía). Para un curso nuevo, crea un archivo nuevo en la misma carpeta y registralo en `packages/content/src/index.ts`.

## Créditos

Inspirado en [W3Schools](https://w3schools.com), [Cisco NetAcad](https://netacad.com), [Platzi](https://platzi.com), [FreeCodeCamp](https://freecodecamp.org), [Docker PWD](https://labs.play-with-docker.com), [TonyHost](https://tonyhost.com), [db4free](https://db4free.net), [Khan Academy](https://khanacademy.org) y [Mozilla MDN](https://developer.mozilla.org).
