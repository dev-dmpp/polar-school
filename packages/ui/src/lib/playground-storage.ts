/**
 * playground-storage.ts
 *
 * Persistencia client-side del HTML/CSS/JS del usuario en localStorage.
 *
 * Por que existe como modulo aparte:
 *   - Centraliza el try/catch de localStorage (modo incognito, cuota llena)
 *   - Versionado con 'v1' en el key para migrar formato en el futuro
 *   - Keys por leccion para que cada playground recuerde su propio draft
 *
 * SSR-safe: todas las funciones verifican `typeof window` antes de tocar
 * localStorage. En el server (build de Astro) devuelven null/no-op.
 */

const STORAGE_PREFIX = 'polar-school:html-playground:v1'
export const PLAYGROUND_STORAGE_VERSION = 'v1'

export interface PlaygroundDraft {
  html: string
  css: string
  js: string
  /** Timestamp (epoch ms) del ultimo save. */
  savedAt: number
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * Construye el storage key. Si no se pasa lessonSlug, usa 'default'
 * (modo standalone, sin lesson).
 */
export function buildStorageKey(lessonSlug?: string): string {
  const slug = (lessonSlug ?? 'default').trim() || 'default'
  return `${STORAGE_PREFIX}:${slug}`
}

/**
 * Carga un draft guardado. Devuelve null si:
 *   - No estamos en browser
 *   - No hay nada guardado para ese key
 *   - El JSON guardado esta corrupto
 *   - El shape no matchea PlaygroundDraft
 */
export function loadDraft(key: string): PlaygroundDraft | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.html === 'string' &&
      typeof parsed.css === 'string' &&
      typeof parsed.js === 'string' &&
      typeof parsed.savedAt === 'number'
    ) {
      return parsed as PlaygroundDraft
    }
    return null
  } catch {
    // JSON corrupto o localStorage inaccesible (modo incognito, etc.)
    return null
  }
}

/**
 * Guarda un draft. Silencioso si falla (cuota llena, modo incognito).
 */
export function saveDraft(
  key: string,
  draft: Omit<PlaygroundDraft, 'savedAt'>,
): { ok: true; savedAt: number } | { ok: false; reason: string } {
  if (!isBrowser()) return { ok: false, reason: 'no-browser' }
  try {
    const payload: PlaygroundDraft = { ...draft, savedAt: Date.now() }
    window.localStorage.setItem(key, JSON.stringify(payload))
    return { ok: true, savedAt: payload.savedAt }
  } catch (e) {
    // QuotaExceededError es el caso comun (Safari con storage full, etc.)
    return {
      ok: false,
      reason: e instanceof Error ? e.name : 'unknown',
    }
  }
}

/**
 * Limpia el draft de un key especifico.
 */
export function clearDraft(key: string): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // silencioso
  }
}

/**
 * Compara si dos drafts son identicos (mismo html+css+js).
 * Util para decidir si mostrar "Guardado" o no.
 */
export function draftsEqual(a: PlaygroundDraft | null, b: { html: string; css: string; js: string }): boolean {
  if (a === null) return false
  return a.html === b.html && a.css === b.css && a.js === b.js
}

/**
 * Formatea un timestamp para UI ("hace 3s", "hace 2 min", "hace 1 h").
 */
export function formatSavedAgo(savedAt: number, now = Date.now()): string {
  const diff = Math.max(0, now - savedAt)
  const sec = Math.floor(diff / 1000)
  if (sec < 5) return 'recién'
  if (sec < 60) return `hace ${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `hace ${min} min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `hace ${hr} h`
  const day = Math.floor(hr / 24)
  return `hace ${day} d`
}
