<script lang="ts">
  /**
   * HtmlPlayground — live HTML/CSS/JS preview en iframe sandbox.
   *
   * 100% client-side. Persiste el codigo del usuario en localStorage
   * (B4), asi sobrevive al refresh. Cada lesson tiene su propio draft
   * (storageKey por slug).
   *
   * Seguridad:
   *   - iframe sandbox="allow-scripts" (SIN allow-same-origin)
   *     -> scripts del usuario NO pueden leer cookies del origin real
   *   - <base href="about:blank"> -> scripts externos no se cargan
   *
   * UX:
   *   - 3 textareas (HTML, CSS, JS) con debounce 300ms auto-render
   *   - Persistencia con debounce 500ms (B4)
   *   - Indicador "Guardado" sutil al lado del header
   *   - Botones: Render (manual), Reset (confirma + limpia storage), Copy por panel
   *   - Errores JS del iframe -> overlay rojo
   */
  import { onMount, onDestroy } from 'svelte'
  import { buildHtmlSrcdoc, isSrcdocTooBig } from '../lib/build-html-srcdoc'
  import {
    buildStorageKey,
    loadDraft,
    saveDraft,
    clearDraft,
    formatSavedAgo,
  } from '../lib/playground-storage'
  import { EditorHistory } from '../lib/editor-history'
  import CodeEditor from './CodeEditor.svelte'

  interface Props {
    initialHtml?: string
    initialCss?: string
    initialJs?: string
    height?: string
    /** Slug de la leccion para storage key por leccion. */
    storageKey?: string
    /** Si true, desactiva la persistencia (util para tests). */
    disableStorage?: boolean
  }

  const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Mi sitio</title>
</head>
<body>
  <h1>Hola mundo</h1>
  <p>Edita este HTML y mira el preview al lado.</p>
  <button id="boton">Click aca</button>
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
    storageKey,
    disableStorage = false,
  }: Props = $props()

  // Storage key final (B4)
  const finalStorageKey = disableStorage ? null : buildStorageKey(storageKey)

  // Cargar draft existente al montar (B4)
  function loadInitial(): { html: string; css: string; js: string } {
    if (!finalStorageKey) {
      return { html: initialHtml, css: initialCss, js: initialJs }
    }
    const draft = loadDraft(finalStorageKey)
    if (draft) {
      return { html: draft.html, css: draft.css, js: draft.js }
    }
    return { html: initialHtml, css: initialCss, js: initialJs }
  }

  const initial = loadInitial()

  // Estado editable
  let html = $state(initial.html)
  let css = $state(initial.css)
  let js = $state(initial.js)
  let lastError = $state<string | null>(null)
  let copyState = $state<'html' | 'css' | 'js' | null>(null)

  // Estado de persistencia (B4)
  let savedAt = $state<number | null>(initial.savedAt ?? null)
  let savedLabel = $state<string>(initial.savedAt ? formatSavedAgo(initial.savedAt) : '')
  let showSavedFlash = $state(false)
  let saveError = $state<string | null>(null)

  // Iframe ref + timers
  let iframe: HTMLIFrameElement | null = $state(null)
  let renderTimer: ReturnType<typeof setTimeout> | null = null
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let savedFlashTimer: ReturnType<typeof setTimeout> | null = null
  let savedLabelTimer: ReturnType<typeof setInterval> | null = null

  // Editor refs (B6) para llamar undo/redo desde los botones del header
  let htmlEditor: { undo: () => void; redo: () => void } | null = $state(null)
  let cssEditor: { undo: () => void; redo: () => void } | null = $state(null)
  let jsEditor: { undo: () => void; redo: () => void } | null = $state(null)

  // History stacks (B6): uno por panel
  const htmlHistory = new EditorHistory(50)
  const cssHistory = new EditorHistory(50)
  const jsHistory = new EditorHistory(50)

  // Estado de botones (B6) — drives los disabled
  let htmlCanUndo = $state(false)
  let htmlCanRedo = $state(false)
  let cssCanUndo = $state(false)
  let cssCanRedo = $state(false)
  let jsCanUndo = $state(false)
  let jsCanRedo = $state(false)

  function handleHtmlHistoryChange(canUndo: boolean, canRedo: boolean) {
    htmlCanUndo = canUndo
    htmlCanRedo = canRedo
  }
  function handleCssHistoryChange(canUndo: boolean, canRedo: boolean) {
    cssCanUndo = canUndo
    cssCanRedo = canRedo
  }
  function handleJsHistoryChange(canUndo: boolean, canRedo: boolean) {
    jsCanUndo = canUndo
    jsCanRedo = canRedo
  }

  function scheduleRender() {
    if (renderTimer) clearTimeout(renderTimer)
    renderTimer = setTimeout(render, 300)
  }

  function render() {
    if (!iframe) return
    const srcdoc = buildHtmlSrcdoc({ html, css, js })
    if (isSrcdocTooBig(srcdoc)) {
      lastError = 'HTML demasiado grande (>200KB). Simplifica tu codigo.'
      return
    }
    lastError = null
    iframe.srcdoc = srcdoc
  }

  // Persistencia con debounce 500ms (B4)
  function scheduleSave() {
    if (!finalStorageKey) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(commitSave, 500)
  }

  function commitSave() {
    if (!finalStorageKey) return
    const result = saveDraft(finalStorageKey, { html, css, js })
    if (result.ok) {
      savedAt = result.savedAt
      savedLabel = formatSavedAgo(result.savedAt)
      saveError = null
      showSavedFlash = true
      if (savedFlashTimer) clearTimeout(savedFlashTimer)
      savedFlashTimer = setTimeout(() => {
        showSavedFlash = false
      }, 1500)
    } else {
      // Silencioso en UI pero dejamos el reason para debug
      saveError = result.reason
    }
  }

  // Reset a defaults + limpia storage + limpia histories (B6)
  function reset() {
    const hasChanges =
      html !== initialHtml || css !== initialCss || js !== initialJs
    if (hasChanges && typeof window !== 'undefined') {
      const ok = window.confirm(
        'Esto borra tus cambios y vuelve al codigo inicial. Continuar?',
      )
      if (!ok) return
    }
    html = initialHtml
    css = initialCss
    js = initialJs
    if (finalStorageKey) clearDraft(finalStorageKey)
    savedAt = null
    savedLabel = ''
    showSavedFlash = false
    saveError = null
    // B6: limpiar histories
    htmlHistory.clear()
    cssHistory.clear()
    jsHistory.clear()
    htmlCanUndo = false
    htmlCanRedo = false
    cssCanUndo = false
    cssCanRedo = false
    jsCanUndo = false
    jsCanRedo = false
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

  // Effect: registrar listener de errores del iframe
  $effect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', handleMessage)
      return () => window.removeEventListener('message', handleMessage)
    }
  })

  // Effect (B6): listener global de teclado para undo/redo.
  // Solo actua si el focus esta dentro del playground.
  $effect(() => {
    if (typeof window === 'undefined') return
    function handleKeydown(ev: KeyboardEvent) {
      const mod = ev.metaKey || ev.ctrlKey
      if (!mod) return
      const key = ev.key.toLowerCase()
      const isUndo = key === 'z' && !ev.shiftKey
      const isRedo =
        (key === 'z' && ev.shiftKey) || (key === 'y' && !ev.shiftKey)
      if (!isUndo && !isRedo) return

      // Detectar si el target esta dentro del playground
      const target = ev.target as HTMLElement | null
      if (!target || !target.closest('.html-playground')) return

      // Determinar que panel segun el data-panel del <pre> o textarea ancestro
      const inHtml = !!target.closest('[data-panel="html"]')
      const inCss = !!target.closest('[data-panel="css"]')
      const inJs = !!target.closest('[data-panel="js"]')

      ev.preventDefault()
      if (inHtml) {
        if (isUndo) htmlEditor?.undo()
        else htmlEditor?.redo()
      } else if (inCss) {
        if (isUndo) cssEditor?.undo()
        else cssEditor?.redo()
      } else if (inJs) {
        if (isUndo) jsEditor?.undo()
        else jsEditor?.redo()
      }
      // Si el focus esta en el playground pero no en un editor
      // (ej. en el boton Reset), no hace nada y deja pasar al browser.
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  })

  // Effect: render cuando cambian html/css/js o se monta el iframe
  $effect(() => {
    void html
    void css
    void js
    void iframe
    scheduleRender()
  })

  // Effect (B4): persistir cuando cambian html/css/js (despues del mount)
  let mounted = $state(false)
  $effect(() => {
    void html
    void css
    void js
    if (!mounted) return
    if (!finalStorageKey) return
    scheduleSave()
  })

  // Effect: refrescar el label "Guardado hace X" cada 30s
  $effect(() => {
    if (typeof window === 'undefined') return
    if (!finalStorageKey) return
    savedLabelTimer = setInterval(() => {
      if (savedAt) savedLabel = formatSavedAgo(savedAt)
    }, 30_000)
    return () => {
      if (savedLabelTimer) clearInterval(savedLabelTimer)
    }
  })

  onMount(() => {
    // Marca mounted=true despues del primer render para que el effect de
    // save no dispare al cargar el draft inicial.
    mounted = true
  })

  onDestroy(() => {
    if (renderTimer) clearTimeout(renderTimer)
    if (saveTimer) clearTimeout(saveTimer)
    if (savedFlashTimer) clearTimeout(savedFlashTimer)
    if (savedLabelTimer) clearInterval(savedLabelTimer)
  })
</script>

<div class="html-playground" style="--pg-height: {height}">
  <div class="topbar">
    <span class="saved-indicator" class:flash={showSavedFlash}>
      {#if savedAt}
        {#if showSavedFlash}
          <span class="check">✓</span> Guardado
        {:else}
          💾 Guardado {savedLabel}
        {/if}
      {:else if finalStorageKey}
        <span class="muted">Sin guardar</span>
      {/if}
    </span>
    {#if saveError}
      <span class="save-error" title={saveError}>
        ⚠ No se pudo guardar (modo incognito?)
      </span>
    {/if}
  </div>
  <div class="panes">
    <div class="pane">
      <div class="pane-header">
        <span class="label">HTML</span>
        <div class="pane-actions">
          <button
            class="undo-btn"
            disabled={!htmlCanUndo}
            onclick={() => htmlEditor?.undo()}
            title="Deshacer (Ctrl/Cmd+Z)"
          >↶</button>
          <button
            class="undo-btn"
            disabled={!htmlCanRedo}
            onclick={() => htmlEditor?.redo()}
            title="Rehacer (Ctrl/Cmd+Shift+Z)"
          >↷</button>
          <button class="copy-btn" onclick={() => copy('html')}>
            {copyState === 'html' ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
      <CodeEditor
        bind:this={htmlEditor}
        bind:value={html}
        language="html"
        ariaLabel="Editor HTML"
        panel="html"
        history={htmlHistory}
        onHistoryChange={handleHtmlHistoryChange}
      />
    </div>

    <div class="pane">
      <div class="pane-header">
        <span class="label">CSS</span>
        <div class="pane-actions">
          <button
            class="undo-btn"
            disabled={!cssCanUndo}
            onclick={() => cssEditor?.undo()}
            title="Deshacer (Ctrl/Cmd+Z)"
          >↶</button>
          <button
            class="undo-btn"
            disabled={!cssCanRedo}
            onclick={() => cssEditor?.redo()}
            title="Rehacer (Ctrl/Cmd+Shift+Z)"
          >↷</button>
          <button class="copy-btn" onclick={() => copy('css')}>
            {copyState === 'css' ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
      <CodeEditor
        bind:this={cssEditor}
        bind:value={css}
        language="css"
        ariaLabel="Editor CSS"
        panel="css"
        history={cssHistory}
        onHistoryChange={handleCssHistoryChange}
      />
    </div>

    <div class="pane">
      <div class="pane-header">
        <span class="label">JS</span>
        <div class="pane-actions">
          <button
            class="undo-btn"
            disabled={!jsCanUndo}
            onclick={() => jsEditor?.undo()}
            title="Deshacer (Ctrl/Cmd+Z)"
          >↶</button>
          <button
            class="undo-btn"
            disabled={!jsCanRedo}
            onclick={() => jsEditor?.redo()}
            title="Rehacer (Ctrl/Cmd+Shift+Z)"
          >↷</button>
          <button class="copy-btn" onclick={() => copy('js')}>
            {copyState === 'js' ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
      <CodeEditor
        bind:this={jsEditor}
        bind:value={js}
        language="javascript"
        ariaLabel="Editor JavaScript"
        panel="js"
        history={jsHistory}
        onHistoryChange={handleJsHistoryChange}
      />
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
    --pg-success: #22c55e;

    border: 2px solid var(--pg-border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--pg-bg);
    color: var(--pg-fg);
  }

  .topbar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    padding: 0.4rem 0.9rem;
    background: #27272a;
    border-bottom: 1px solid var(--pg-border);
    font-size: 0.78rem;
    min-height: 1.6rem;
  }

  .saved-indicator {
    color: var(--pg-fg);
    opacity: 0.85;
    transition: color 0.2s;
  }
  .saved-indicator .muted {
    opacity: 0.45;
  }
  .saved-indicator.flash {
    color: var(--pg-success);
    opacity: 1;
  }
  .saved-indicator .check {
    font-weight: 700;
  }
  .save-error {
    color: #fca5a5;
    cursor: help;
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

  textarea,
  :global(.code-editor) {
    flex: 1;
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

  .pane-actions {
    display: flex;
    gap: 0.3rem;
    align-items: center;
  }

  .undo-btn {
    font-size: 1rem;
    padding: 0.1em 0.5em;
    line-height: 1;
    min-width: 1.8rem;
  }
  .undo-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .undo-btn:disabled:hover {
    background: transparent;
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
