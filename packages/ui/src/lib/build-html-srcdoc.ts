/**
 * build-html-srcdoc.ts
 *
 * Helper para HtmlPlayground. Vive fuera del .svelte porque Svelte 5
 * confunde los `<script>` y `</script>` literales dentro de template
 * strings con el cierre del propio bloque <script> del componente.
 *
 * Construye el srcdoc completo: HTML del usuario + CSS inyectado + JS inyectado
 * + handler de errores que reporta al parent via postMessage.
 */

export interface SrcdocInput {
  html: string
  css: string
  js: string
}

const MAX_SRCDOC_BYTES = 200_000

/**
 * Extrae solo el contenido de <body>. Si el usuario no puso <body>, devuelve
 * todo el HTML tal cual (puede ser un fragment).
 */
function extractBody(html: string): string {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  return m ? m[1] : html
}

/**
 * Construye el HTML completo que va dentro del iframe.
 * El iframe tiene `sandbox="allow-scripts"` (sin allow-same-origin),
 * asi que el JS corre en origen null y no puede leer cookies del origin real.
 *
 * Errores del iframe se reportan al parent via postMessage.
 */
export function buildHtmlSrcdoc({ html, css, js }: SrcdocInput): string {
  const cssBlock = css.trim()
    ? `<style>\n${css}\n</style>`
    : ''

  // IMPORTANTE: el `</script>` de cierre se concatena como string separado
  // para que el parser no se confunda con el cierre del <script> del componente.
  const jsOpen = '<script>'
  const jsClose = '<' + '/script>'
  const errorOpen = '<script>'
  const errorClose = '<' + '/script>'

  const errorHandler =
    errorOpen +
    `
      window.addEventListener('error', (e) => {
        parent.postMessage({
          type: 'html-playground-error',
          message: e.message + ' (' + (e.filename || 'inline') + ':' + e.lineno + ':' + e.colno + ')'
        }, '*')
      })
    ` +
    errorClose

  const jsBlock = js.trim()
    ? jsOpen +
      `\ntry {\n${js}\n} catch (e) { throw e }\n` +
      jsClose
    : ''

  return (
    '<!DOCTYPE html>\n' +
    '<html lang="es">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <base href="about:blank">\n' +
    '  ' + cssBlock + '\n' +
    '</head>\n' +
    '<body>\n' +
    extractBody(html) + '\n' +
    errorHandler + '\n' +
    jsBlock + '\n' +
    '</body>\n' +
    '</html>\n'
  )
}

export function isSrcdocTooBig(srcdoc: string): boolean {
  return srcdoc.length > MAX_SRCDOC_BYTES
}

export const MAX_SRCDOC_BYTES_CONST = MAX_SRCDOC_BYTES
