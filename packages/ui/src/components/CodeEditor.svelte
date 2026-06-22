<script lang="ts">
  /**
   * CodeEditor — textarea con syntax highlighting overlay.
   *
   * Estrategia: el <textarea> sigue siendo el input real (typing, copy,
   * paste, accesibilidad). Debajo, un <pre> con el mismo texto tokenizado
   * por highlight.js. El textarea tiene color: transparent y caret-color
   * para mantener el caret visible. El scroll se sincroniza entre ambos.
   *
   * Lenguajes: html | css | javascript (los 3 que usa HtmlPlayground).
   *
   * Rendimiento: highlight() corre con debounce 200ms (suficientemente
   * responsivo para typing fluido).
   *
   * Limitaciones conocidas:
   *   - La selección del textarea NO se ve como color de fondo en el
   *     highlight (porque el texto es transparente). Esto es aceptable
   *     para el caso de uso de un playground educativo.
   *   - Si el usuario pega codigo gigante (>50KB) el highlight puede
   *     tardar ~100ms. Eso es aceptable.
   */
  import { onMount, onDestroy } from 'svelte'
  import hljs from 'highlight.js/lib/core'
  import javascript from 'highlight.js/lib/languages/javascript'
  import xml from 'highlight.js/lib/languages/xml'
  import css from 'highlight.js/lib/languages/css'
  import 'highlight.js/styles/github-dark.css'

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
    /** Padding y line-height deben matchear entre textarea y pre. */
  }

  let { value = $bindable(), language, ariaLabel, panel }: Props = $props()

  // Tokenized output para el <pre>
  let highlighted = $state('')
  let highlightTimer: ReturnType<typeof setTimeout> | null = null

  // Refs para sincronizar scroll
  let textareaEl: HTMLTextAreaElement | null = $state(null)
  let preEl: HTMLPreElement | null = $state(null)

  function recomputeHighlight() {
    try {
      const result = hljs.highlight(value, { language, ignoreIllegals: true })
      // hljs devuelve HTML con <span class="hljs-...">. Anadimos un newline
      // al final para que la ultima linea tenga la misma altura que en textarea.
      highlighted = result.value + '\n'
    } catch {
      // Si highlight.js falla (input muy raro), fallback al texto plano escapado
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

  // Resaltar cuando cambia value o language
  $effect(() => {
    void value
    void language
    scheduleHighlight()
  })

  // Sincronizar scroll del pre con el textarea
  function handleScroll() {
    if (!textareaEl || !preEl) return
    preEl.scrollTop = textareaEl.scrollTop
    preEl.scrollLeft = textareaEl.scrollLeft
  }

  // Tab key inserta 2 spaces (comun en JS/HTML/CSS)
  function handleKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Tab' && textareaEl) {
      ev.preventDefault()
      const start = textareaEl.selectionStart
      const end = textareaEl.selectionEnd
      const insert = '  '
      value = value.substring(0, start) + insert + value.substring(end)
      // Restaurar cursor despues del insert
      queueMicrotask(() => {
        if (textareaEl) {
          textareaEl.selectionStart = textareaEl.selectionEnd = start + insert.length
        }
      })
    }
  }

  onMount(() => {
    // Highlight inmediato al montar (sin debounce)
    recomputeHighlight()
  })

  onDestroy(() => {
    if (highlightTimer) clearTimeout(highlightTimer)
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
    /* Mismas propiedades tipograficas para alineamiento pixel-perfect */
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

    /* Toman todo el espacio del contenedor */
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;

    /* Scroll vertical en ambos */
    overflow: auto;
  }

  .highlight-overlay {
    /* El pre va DEBAJO y muestra los colores */
    color: #e4e4e7;
    background: var(--pg-bg, #1e1e1e);
    pointer-events: none; /* clicks van al textarea */
    z-index: 1;
  }

  textarea {
    /* El textarea va ENCIMA con texto transparente */
    color: transparent;
    caret-color: var(--pg-fg, #e4e4e7);
    background: transparent;
    resize: none;
    outline: none;
    z-index: 2;
    /* Hace visible la seleccion del usuario sobre el highlight */
    /* (webkit usa esto para el fondo de seleccion) */
  }

  textarea::selection {
    background: rgba(217, 119, 6, 0.35);
  }

  textarea:focus {
    background: transparent;
  }

  /* Tema dark de highlight.js para que combine con el playground */
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
