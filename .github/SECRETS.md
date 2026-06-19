# Secrets para GitHub Actions

Ir a: `Settings → Secrets and variables → Actions → New repository secret`

## CI (`ci.yml`)

Ninguno. CI usa Postgres efímero con credenciales en texto plano.

## Deploy Staging (`deploy-staging.yml`)

| Secret | Descripción |
|---|---|
| `STAGING_SSH_HOST` | IP o dominio del VPS staging |
| `STAGING_SSH_USER` | Usuario SSH (no root) |
| `STAGING_SSH_KEY` | Llave SSH privada (formato OpenSSH) |
| `STAGING_PUBLIC_API_URL` | URL pública del API staging |

El archivo `.env` del staging debe existir en el VPS. No se crea desde CI.

## Deploy Prod (`deploy-prod.yml`)

| Secret | Descripción |
|---|---|
| `PROD_SSH_HOST` | IP o dominio del VPS prod |
| `PROD_SSH_USER` | Usuario SSH (no root) |
| `PROD_SSH_KEY` | Llave SSH privada (idealmente diferente a staging) |
| `PROD_DATABASE_URL` | URL completa del Postgres prod |
| `PROD_PUBLIC_API_URL` | URL pública del API prod |
| `SLACK_WEBHOOK_URL` | Webhook de Slack para notificaciones (opcional) |

## Cómo generar las llaves SSH

```bash
# Generar llave dedicada para CI (sin passphrase, GitHub Actions no soporta interactivo)
ssh-keygen -t ed25519 -C "polar-school-ci" -f ~/.ssh/polar_school_ci -N ""

# Copiar pública al VPS (idealmente un usuario dedicado sin sudo)
ssh-copy-id -i ~/.ssh/polar_school_ci.pub polar@VPS_IP

# Probar conexión
ssh -i ~/.ssh/polar_school_ci polar@VPS_IP 'whoami'

# Pegar el contenido completo de la privada en GitHub (incluyendo BEGIN y END)
cat ~/.ssh/polar_school_ci
```

## Deploy manual sin tag

```bash
# En GitHub UI: Actions → Deploy production → Run workflow
# Completar el campo "tag" con SHA de commit o tag semver
```

## Rotación de llaves (cada 6 meses)

1. Generar nueva llave
2. Agregar la pública al VPS (mantener la vieja)
3. Reemplazar el secret en GitHub
4. Deployar un cambio dummy para probar
5. Remover la vieja del VPS
