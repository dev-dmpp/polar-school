<script lang="ts">
  /**
   * CodeEditor — textarea con syntax highlighting overlay + undo/redo.
   *
   * Responsabilidades:
   *   - Textarea como input real (typing, copy, paste, accesibilidad)
   *   - <pre> debajo con el texto tokenizado por highlight.js
   *   - Tab key inserta 2 spaces
   *   - Scroll sincronizado entre textarea y pre
   *   - Debounce 200ms en highlight (typing fluido)
   *   - Push al history externo con debounce 500ms (B6)
   *   - undo() / redo() exposed via callbacks al padre (B6)
   *
   * El history vive en el padre (HtmlPlayground) y se pasa como prop.
   * Asi el padre coordina los atajos globales (Cmd+Z afecta al panel
   * con focus) y el undo/redo entre paneles si quiere.
   *
   * Limitaciones conocidas:
   *   - Seleccion del textarea NO se ve como color de fondo en el
   *     highlight (texto transparente). Aceptable para playground educativo.
   */
  import { onMount, onDestroy } from 'svelte'
  import hljs from 'highlight.js/lib/core'
  import javascript from 'highlight.js/lib/languages/javascript'
  import xml from 'highlight.js/lib/languages/xml'
  import css from 'highlight.js/lib/languages/css'
  import 'highlight.js/styles/github-dark.css'
  import type { EditorHistory } from '../lib/editor-history'

  // Registrar solo los lenguajes que necesitamos (reduce bundle ~50KB → ~30KB)
  hljs.registerLanguage('javascript', javascript)
  hljs.registerLanguage('xml', xml) // HTML usa xml segun hljs
  hljs.registerLanguage('css', css)
  hljs.registerLanguage('html', xml) // alias

  interface Props {
    value: string
    language: 'html' | 'css' | 'javascript'
    ariaLabel: string
    panel?: 'html' | 'css' | 'js'
    /** History externo (B6). Si se pasa, se hace push debounced. */
    history?: EditorHistory | null
    /** Callback cuando el editor recibe focus. Usado por el padre para los atajos. */
    onFocus?: () => void
    /** Callback cuando cambia canUndo/canRedo (B6). Para habilitar/deshabilitar botones. */
    onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void
  }

  let {
    value = $bindable(),
    language,
    ariaLabel,
    panel,
    history = null,
    onFocus,
    onHistoryChange,
  }: Props = $props()

  // Tokenized output para el <pre>
  let highlighted = $state('')
  let highlightTimer: ReturnType<typeof setTimeout> | null = null
  let historyTimer: ReturnType<typeof setTimeout> | null = null

  // Refs para sincronizar scroll
  let textareaEl: HTMLTextAreaElement | null = $state(null)
  let preEl: HTMLPreElement | null = $state(null)

  // Estado de undo/redo expuesto al padre (B6)
  let canUndoState = $state(false)
  let canRedoState = $state(false)

  function updateHistoryState() {
    if (!history) {
      canUndoState = false
      canRedoState = false
    } else {
      canUndoState = history.canUndo()
      canRedoState = history.canRedo()
    }
    onHistoryChange?.(canUndoState, canRedoState)
  }

  function recomputeHighlight() {
    try {
      const result = hljs.highlight(value, { language, ignoreIllegals: true })
      highlighted = result.value + '\n'
    } catch {
      highlighted = escapeHtml(value) + '\n'
    }
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  function scheduleHighlight() {
    if (highlightTimer) clearTimeout(highlightTimer)
    highlightTimer = setTimeout(recomputeHighlight, 200)
  }

  /**
   * Push al history con debounce 500ms. Asi un typing rapido genera
   * una sola entry, no una por letra. Tambien push en blur para
   * capturar el estado final cuando el usuario cambia de panel.
   */
  function scheduleHistoryPush() {
    if (!history) return
    if (historyTimer) clearTimeout(historyTimer)
    historyTimer = setTimeout(() => {
      history!.push(value)
      updateHistoryState()
    }, 500)
  }

  // Push inmediato al history (sin debounce) para acciones discretas.
  function pushHistoryNow() {
    if (!history) return
    if (historyTimer) clearTimeout(historyTimer)
    history.push(value)
    updateHistoryState()
  }

  // Metodos undo/redo (B6). El padre los invoca via callbacks cuando
  // detecta Cmd/Ctrl+Z o Cmd/Ctrl+Shift+Z en un listener global.
  // Tambien expone via export para los botones undo/redo del header.
  export function undo() {
    if (!history) return
    const prev = history.undo()
    updateHistoryState()
    if (prev !== null) {
      value = prev
    }
  }

  export function redo() {
    if (!history) return
    const next = history.redo()
    updateHistoryState()
    if (next !== null) {
      value = next
    }
  }

  // Resaltar cuando cambia value o language
  $effect(() => {
    void value
    void language
    scheduleHighlight()
  })

  // Push al history cuando cambia value (con debounce)
  $effect(() => {
    void value
    if (!history) return
    scheduleHistoryPush()
  })

  // Sincronizar scroll del pre con el textarea
  function handleScroll() {
    if (!textareaEl || !preEl) return
    preEl.scrollTop = textareaEl.scrollTop
    preEl.scrollLeft = textareaEl.scrollLeft
  }

  // Tab key + atajos undo/redo (B6)
  function handleKeydown(ev: KeyboardEvent) {
    // Tab inserta 2 spaces
    if (ev.key === 'Tab' && textareaEl) {
      ev.preventDefault()
      const start = textareaEl.selectionStart
      const end = textareaEl.selectionEnd
      const insert = '  '
      value = value.substring(0, start) + insert + value.substring(end)
      queueMicrotask(() => {
        if (textareaEl) {
          textareaEl.selectionStart = textareaEl.selectionEnd = start + insert.length
        }
      })
      pushHistoryNow() // tab es accion discreta
      return
    }

    // Cmd/Ctrl+Z (undo) o Cmd/Ctrl+Shift+Z / Cmd/Ctrl+Y (redo)
    const mod = ev.metaKey || ev.ctrlKey
    if (!mod) return
    const key = ev.key.toLowerCase()

    if (key === 'z' && !ev.shiftKey) {
      ev.preventDefault()
      undo()
      return
    }
    if ((key === 'z' && ev.shiftKey) || key === 'y') {
      ev.preventDefault()
      redo()
      return
    }
  }

  function handleBlur() {
    // Flush del debounce para que el estado quede persistido en history
    // antes de que el usuario cambie de panel o haga Cmd+Z en otro.
    if (historyTimer) {
      clearTimeout(historyTimer)
      historyTimer = null
      if (history) {
        history.push(value)
        updateHistoryState()
      }
    }
  }

  function handleFocusInternal() {
    onFocus?.()
  }

  onMount(() => {
    recomputeHighlight()
    // Inicializa estado de history
    updateHistoryState()
  })

  onDestroy(() => {
    if (highlightTimer) clearTimeout(highlightTimer)
    if (historyTimer) clearTimeout(historyTimer)
  })
</script>

<div class="code-editor" data-panel={panel}>
  <pre
    bind:this={preEl}
    class="hljs language-{language} highlight-overlay"
    aria-hidden="true"
  >{highlighted}</pre>
  <textarea
    bind:this={textareaEl}
    bind:value
    onscroll={handleScroll}
    onkeydown={handleKeydown}
    onblur={handleBlur}
    onfocus={handleFocusInternal}
    spellcheck="false"
    autocapitalize="off"
    autocorrect="off"
    autocomplete="off"
    aria-label={ariaLabel}
  ></textarea>
</div>

<style>
  .code-editor {
    position: relative;
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .highlight-overlay,
  textarea {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.85rem;
    line-height: 1.5;
    padding: 0.6rem 0.8rem;
    margin: 0;
    border: 0;
    white-space: pre;
    word-wrap: normal;
    overflow-wrap: normal;
    tab-size: 2;

    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;

    overflow: auto;
  }

  .highlight-overlay {
    color: #e4e4e7;
    background: var(--pg-bg, #1e1e1e);
    pointer-events: none;
    z-index: 1;
  }

  textarea {
    color: transparent;
    caret-color: var(--pg-fg, #e4e4f7);
    background: transparent;
    resize: none;
    outline: none;
    z-index: 2;
  }

  textarea::selection {
    background: rgba(217, 119, 6, 0.35);
  }

  textarea:focus {
    background: transparent;
  }

  :global(.hljs) {
    background: transparent !important;
    color: #e4e4e7;
  }
  :global(.hljs-keyword),
  :global(.hljs-selector-tag),
  :global(.hljs-built_in) {
    color: #f97583;
  }
  :global(.hljs-string),
  :global(.hljs-attr) {
    color: #9ecbff;
  }
  :global(.hljs-comment) {
    color: #6a737d;
    font-style: italic;
  }
  :global(.hljs-number),
  :global(.hljs-literal) {
    color: #79b8ff;
  }
  :global(.hljs-function),
  :global(.hljs-title) {
    color: #ffab70;
  }
  :global(.hljs-variable),
  :global(.hljs-name) {
    color: #ffab70;
  }
  :global(.hljs-tag) {
    color: #85e89d;
  }
</style>
