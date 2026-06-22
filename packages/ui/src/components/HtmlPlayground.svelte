<script lang="ts">
  /**
   * HtmlPlayground — live HTML/CSS/JS preview en iframe sandbox.
   *
   * 100% client-side. Sin backend, sin auth, sin persistencia.
   *
   * Seguridad:
   *   - iframe sandbox="allow-scripts" (SIN allow-same-origin)
   *     → scripts del usuario NO pueden leer cookies del origin real
   *   - <base href="about:blank"> → scripts externos no se cargan
   *
   * UX:
   *   - 3 textareas (HTML, CSS, JS) con debounce 300ms auto-render
   *   - Botones: Render (manual), Reset, Copy por panel
   *   - Errores JS del iframe → overlay rojo
   */
  import { onDestroy } from 'svelte'
  import { buildHtmlSrcdoc, isSrcdocTooBig } from '../lib/build-html-srcdoc'

  interface Props {
    initialHtml?: string
    initialCss?: string
    initialJs?: string
    height?: string
  }

  const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Mi sitio</title>
</head>
<body>
  <h1>Hola mundo</h1>
  <p>Editá este HTML y mirá el preview al lado.</p>
  <button id="boton">Click acá</button>
</body>
</html>`

  const DEFAULT_CSS = `body {
  font-family: system-ui, sans-serif;
  max-width: 640px;
  margin: 2rem auto;
  padding: 0 1rem;
  color: #1f2937;
  background: #fafaf7;
}
h1 { color: #d97706; }
button {
  background: #d97706;
  color: white;
  border: 0;
  padding: 0.6em 1.2em;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
}`

  const DEFAULT_JS = `// Tu JavaScript corre dentro del iframe sandbox
const boton = document.getElementById('boton')
boton?.addEventListener('click', () => {
  alert('Hola desde tu playground!')
})`

  let {
    initialHtml = DEFAULT_HTML,
    initialCss = DEFAULT_CSS,
    initialJs = DEFAULT_JS,
    height = '420px',
  }: Props = $props()

  // Estado editable
  let html = $state(initialHtml)
  let css = $state(initialCss)
  let js = $state(initialJs)
  let lastError = $state<string | null>(null)
  let copyState = $state<'html' | 'css' | 'js' | null>(null)

  // Iframe ref
  let iframe: HTMLIFrameElement | null = $state(null)
  let renderTimer: ReturnType<typeof setTimeout> | null = null

  // Construye el srcdoc completo (HTML + CSS inyectado + JS inyectado)
  // Logica extraida a ../lib/build-html-srcdoc.ts para evitar que el
  // parser de Svelte confunda cierres de bloque script literales dentro
  // de strings con el cierre del propio bloque script del componente.

  // Render con debounce
  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer)
    renderTimer = setTimeout(render, 300)
  }

  function render() {
    if (!iframe) return
    const srcdoc = buildHtmlSrcdoc({ html, css, js })
    if (isSrcdocTooBig(srcdoc)) {
      lastError = 'HTML demasiado grande (>200KB). Simplificá tu código.'
      return
    }
    lastError = null
    iframe.srcdoc = srcdoc
  }

  // Reset a defaults
  function reset() {
    html = initialHtml
    css = initialCss
    js = initialJs
    render()
  }

  // Copiar al clipboard
  async function copy(panel: 'html' | 'css' | 'js') {
    const text = panel === 'html' ? html : panel === 'css' ? css : js
    try {
      await navigator.clipboard.writeText(text)
      copyState = panel
      setTimeout(() => {
        if (copyState === panel) copyState = null
      }, 1500)
    } catch {
      // clipboard API no disponible, silencioso
    }
  }

  // Escuchar errores del iframe
  function handleMessage(ev: MessageEvent) {
    if (ev.data?.type === 'html-playground-error') {
      lastError = String(ev.data.message ?? 'Error desconocido')
    }
  }

  $effect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', handleMessage)
      return () => window.removeEventListener('message', handleMessage)
    }
  })

  // Render inicial al montar
  $effect(() => {
    // dependencias implícitas: html, css, js (state) + iframe (ref)
    void html
    void css
    void js
    void iframe
    scheduleRender()
  })

  onDestroy(() => {
    if (renderTimer) clearTimeout(renderTimer)
  })
</script>

<div class="html-playground" style="--pg-height: {height}">
  <div class="panes">
    <div class="pane">
      <div class="pane-header">
        <span class="label">HTML</span>
        <button class="copy-btn" onclick={() => copy('html')}>
          {copyState === 'html' ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
      <textarea
        bind:value={html}
        spellcheck="false"
        aria-label="Editor HTML"
        data-panel="html"
      ></textarea>
    </div>

    <div class="pane">
      <div class="pane-header">
        <span class="label">CSS</span>
        <button class="copy-btn" onclick={() => copy('css')}>
          {copyState === 'css' ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
      <textarea
        bind:value={css}
        spellcheck="false"
        aria-label="Editor CSS"
        data-panel="css"
      ></textarea>
    </div>

    <div class="pane">
      <div class="pane-header">
        <span class="label">JS</span>
        <button class="copy-btn" onclick={() => copy('js')}>
          {copyState === 'js' ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
      <textarea
        bind:value={js}
        spellcheck="false"
        aria-label="Editor JavaScript"
        data-panel="js"
      ></textarea>
    </div>

    <div class="pane preview">
      <div class="pane-header">
        <span class="label">Preview</span>
        <div class="actions">
          <button class="reset-btn" onclick={reset}>Reset</button>
          <button class="render-btn" onclick={render}>Render</button>
        </div>
      </div>
      <iframe
        bind:this={iframe}
        title="HTML preview"
        sandbox="allow-scripts"
      ></iframe>
      {#if lastError}
        <div class="error-overlay">⚠ {lastError}</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .html-playground {
    --pg-bg: #1e1e1e;
    --pg-fg: #e4e4e7;
    --pg-border: #3f3f46;
    --pg-accent: #d97706;

    border: 2px solid var(--pg-border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--pg-bg);
    color: var(--pg-fg);
  }

  .panes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto;
    gap: 1px;
    background: var(--pg-border);
  }

  .pane {
    background: var(--pg-bg);
    display: flex;
    flex-direction: column;
    min-height: var(--pg-height);
  }

  .pane.preview {
    grid-column: 1 / -1;
    min-height: var(--pg-height);
    position: relative;
  }

  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.4rem 0.8rem;
    background: #27272a;
    border-bottom: 1px solid var(--pg-border);
    font-size: 0.85rem;
  }

  .label {
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-weight: 700;
    color: var(--pg-accent);
    letter-spacing: 0.04em;
  }

  textarea {
    flex: 1;
    width: 100%;
    border: 0;
    background: var(--pg-bg);
    color: var(--pg-fg);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.85rem;
    line-height: 1.5;
    padding: 0.6rem 0.8rem;
    resize: vertical;
    outline: none;
  }
  textarea:focus {
    background: #18181b;
  }

  iframe {
    flex: 1;
    width: 100%;
    border: 0;
    background: white;
  }

  .actions {
    display: flex;
    gap: 0.4rem;
  }

  button {
    background: transparent;
    border: 1px solid var(--pg-border);
    color: var(--pg-fg);
    font-family: inherit;
    font-size: 0.78rem;
    padding: 0.2em 0.7em;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
  }
  button:hover {
    background: #3f3f46;
  }
  .render-btn {
    background: var(--pg-accent);
    border-color: var(--pg-accent);
    color: white;
  }
  .render-btn:hover {
    background: #b45309;
  }
  .reset-btn:hover {
    background: #7f1d1d;
    border-color: #7f1d1d;
  }
  .copy-btn {
    font-size: 0.72rem;
    padding: 0.15em 0.55em;
  }

  .error-overlay {
    position: absolute;
    bottom: 0.6rem;
    left: 0.6rem;
    right: 0.6rem;
    background: rgba(127, 29, 29, 0.95);
    color: #fee2e2;
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 0.8rem;
    line-height: 1.4;
    border: 1px solid #ef4444;
  }

  /* Mobile: apilar todo */
  @media (max-width: 720px) {
    .panes {
      grid-template-columns: 1fr;
    }
    .pane.preview {
      grid-column: 1;
    }
  }
</style>
