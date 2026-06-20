// ─────────────────────────────────────────────────────────────────────────────
// Sandbox limits
//
// Recursos por contenedor + límites globales. Ver brief F5.
// ─────────────────────────────────────────────────────────────────────────────

/** Imagen a usar. Construida con apps/api/src/sandbox/Dockerfile. */
export const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE ?? "polar-school-sandbox:latest";

/** Memoria por contenedor. 128 MB es suficiente para practicar comandos. */
export const MEMORY_LIMIT_MB = 128;

/** CPU por contenedor (0.5 = medio core). */
export const CPU_LIMIT = 0.5;

/** Máximo de PIDs por contenedor (evitar fork bombs). */
export const PID_LIMIT = 64;

/** Tamaño total de tmpfs (/tmp + /home + /root). */
export const TMPFS_SIZE_MB = 64;

/** Minutos de inactividad antes de matar el contenedor. */
export const IDLE_TIMEOUT_MIN = 15;

/** Minutos desde createdAt antes de marcar un container como huérfano (sin dueño en el mapa). */
export const ORPHAN_TIMEOUT_MIN = 30;

/** Máximo de contenedores simultáneos por usuario. */
export const MAX_PER_USER = 3;

/** Máximo de contenedores totales en el VPS. */
export const MAX_TOTAL = 20;

/** Cada cuántos minutos corre el cleanup. */
export const CLEANUP_INTERVAL_MIN = 5;

/** UID/GID del usuario nobody (Alpine). */
export const NOBODY_UID = 65534;
export const NOBODY_GID = 65534;

/** Hostname del API (para pasar a Docker labels). */
export const API_HOSTNAME = process.env.HOSTNAME ?? "polar-school-api";

/** Label que identifica los contenedores del sandbox (para cleanup). */
export const LABEL_MANAGED_BY = "polar-school";
export const LABEL_MANAGED_BY_VALUE = "sandbox";
