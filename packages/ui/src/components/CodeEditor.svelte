<script lang="ts">
  /**
   * CodeEditor — textarea con syntax highlighting overlay + undo/redo + line numbers.
   *
   * Responsabilidades:
   *   - Textarea como input real (typing, copy, paste, accesibilidad)
   *   - <pre> debajo con el texto tokenizado por highlight.js
   *   - Tab key inserta 2 spaces
   *   - Scroll sincronizado entre textarea, pre y numbers gutter (B7)
   *   - Debounce 200ms en highlight (typing fluido)
   *   - Push al history externo con debounce 500ms (B6)
   *   - undo() / redo() exposed via callbacks al padre (B6)
   *   - Line numbers a la izquierda con current line highlight (B7)
   *
   * El history vive en el padre (HtmlPlayground) y se pasa como prop.
   *
   * Layout (B7):
   *   ┌──────┬──────────────────┐
   *   │ nums │ editor (pre+textarea)
   *   │ gutter│  absolutos dentro│
   *   └──────┴──────────────────┘
   *
   * Limitaciones conocidas:
   *   - Seleccion del textarea NO se ve como color de fondo en el
   *     highlight (texto transparente). Aceptable para playground educativo.
   *   - Si el archivo tiene >5000 lineas, renderizar 5000 divs seria lento.
   *     Por eso usamos un unico <pre> con los numeros como texto plano.
   */
  import { onMount, onDestroy } from 'svelte'
  import hljs from 'highlight.js/lib/core'
  import javascript from 'highlight.js/lib/languages/javascript'
  import xml from 'highlight.js/lib/languages/xml'
  import css from 'highlight.js/lib/languages/css'
  import 'highlight.js/styles/github-dark.css'
  import type { EditorHistory } from '../lib/editor-history'
  import {
    detectFolds,
    projectFoldedLines,
    projectFoldedNumbers,
    type FoldRange,
  } from '../lib/code-fold'
  import { findBracketMatch, type Match } from '../lib/bracket-match'

  hljs.registerLanguage('javascript', javascript)
  hljs.registerLanguage('xml', xml)
  hljs.registerLanguage('css', css)
  hljs.registerLanguage('html', xml)

  interface Props {
    value: string
    language: 'html' | 'css' | 'javascript'
    ariaLabel: string
    panel?: 'html' | 'css' | 'js'
    /** History externo (B6). Si se pasa, se hace push debounced. */
    history?: EditorHistory | null
    /** Callback cuando el editor recibe focus. */
    onFocus?: () => void
    /** Callback cuando cambia canUndo/canRedo (B6). */
    onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void
    /** Callback B8: cuando cambia el cursor (linea/columna). */
    onCursorChange?: (line: number, col: number) => void
  }

  let {
    value = $bindable(),
    language,
    ariaLabel,
    panel,
    history = null,
    onFocus,
    onHistoryChange,
    onCursorChange,
  }: Props = $props()

  // B7: derived state
  let lineCount = $derived(Math.max(1, value.split('\n').length))
  let currentLine = $state(1)
  let selectionStart = $state(0)

  // B10: bracket/tag match bajo el cursor (null si no hay match).
  // Se recalcula cuando cambia selectionStart o el value.
  let bracketMatch = $state<Match | null>(null)

  // B10: posicion visual del match (line/col en texto PROYECTADO si hay folds,
  // si no en source directo). Se usa para posicionar el .match-marker overlay.
  // Tambien guardamos el char/tag text para sizing del marker.
  let matchVisual = $state<{
    line: number // 1-based
    col: number // 1-based
    length: number // cuantos chars ocupa visualmente el match
    text: string // el texto a mostrar (en caso de tag como '</body>')
  } | null>(null)

  // B9: folds disponibles (rangos detectados del value actual).
  let availableFolds = $derived<Map<number, FoldRange>>(detectFolds(value, language))

  // B9: folds que el usuario decidio colapsar (set de startLines).
  let collapsedFolds = $state<Set<number>>(new Set())

  // B9: invalida folds cuando el value cambia de forma significativa
  // (reset cuando arranca un value nuevo). Estrategia simple: si el
  // availableFolds no contiene un startLine que estaba collapsed, lo saco.
  $effect(() => {
    const validKeys = new Set(availableFolds.keys())
    const next = new Set<number>()
    for (const k of collapsedFolds) {
      if (validKeys.has(k)) next.add(k)
    }
    if (next.size !== collapsedFolds.size) {
      collapsedFolds = next
    }
  })

  // Estado de highlight
  let highlighted = $state('')
  let highlightTimer: ReturnType<typeof setTimeout> | null = null
  let historyTimer: ReturnType<typeof setTimeout> | null = null

  // Refs
  let textareaEl: HTMLTextAreaElement | null = $state(null)
  let preEl: HTMLPreElement | null = $state(null)
  let numbersEl: HTMLPreElement | null = $state(null)

  // B7+B9: precomputamos el texto de numeros como un solo string,
  // usando el proyector de folds para que las lineas colapsadas
  // muestren "…" y se salteen los numeros del medio.
  let numbersText = $derived(projectFoldedNumbers(value, collapsedFolds, availableFolds))

  // B7: numero a resaltar (currentLine)
  function recomputeCurrentLine() {
    if (!textareaEl) return
    const pos = textareaEl.selectionStart ?? 0
    selectionStart = pos
    const before = value.substring(0, pos)
    const line = before.split('\n').length
    const lastNl = before.lastIndexOf('\n')
    const col = lastNl === -1 ? pos + 1 : pos - lastNl
    currentLine = line
    onCursorChange?.(line, col)
  }

  // B10: recalcula bracket match cuando cambia cursor o value.
  $effect(() => {
    void selectionStart
    void value
    void language
    const m = findBracketMatch(value, selectionStart, language)
    bracketMatch = m

    // B10: convertir offset source -> visual (line/col en texto proyectado).
    if (!m) {
      matchVisual = null
      return
    }
    const skipLines = new Set<number>()
    for (const startLine of collapsedFolds) {
      const range = availableFolds.get(startLine)
      if (!range) continue
      for (let l = range.startLine + 1; l <= range.endLine; l++) {
        skipLines.add(l)
      }
    }

    // Si el match cae adentro de un fold colapsado, no mostrar
    const matchLine =
      value.substring(0, m.start).split('\n').length
    if (skipLines.has(matchLine)) {
      matchVisual = null
      return
    }

    // Calcular visualLine: cuantas lineas del source ORIGINAL se renderizan
    // hasta llegar a matchLine (saltando las que estan en skipLines).
    let visualLine = 0
    for (let i = 1; i <= matchLine; i++) {
      if (!skipLines.has(i)) visualLine++
    }

    // Calcular visualCol: posicion dentro de la linea visual
    const lineStart = value.lastIndexOf('\n', m.start - 1) + 1
    const visualCol = m.start - lineStart + 1

    const text = value.substring(m.start, m.end)
    matchVisual = {
      line: visualLine,
      col: visualCol,
      length: m.end - m.start,
      text,
    }
  })

  // B8: salta a una linea (1-based). Posiciona el cursor al inicio
  // de esa linea. Si el numero es invalido, no hace nada.
  export function gotoLine(targetLine: number) {
    if (!textareaEl) return
    const lines = value.split('\n')
    const n = Math.max(1, Math.min(targetLine, lines.length))
    // offset = suma de lengths de lineas previas + n-1 newlines
    let offset = 0
    for (let i = 0; i < n - 1; i++) {
      offset += lines[i].length + 1 // +1 por el \n
    }
    textareaEl.focus()
    textareaEl.setSelectionRange(offset, offset)
    recomputeCurrentLine()
  }

  // B8: click en el gutter (numero) — calcula que linea fue clickeada
  // segun el offsetY del click relativo al <pre> de numeros.
  function handleGutterClick(ev: MouseEvent) {
    if (!numbersEl || !textareaEl) return
    const rect = numbersEl.getBoundingClientRect()
    const yWithinPre = ev.clientY - rect.top + numbersEl.scrollTop
    // 0.6rem de padding-top (mismo que el editor)
    const padTop = parseFloat(getComputedStyle(numbersEl).paddingTop) || 0
    const lineHeight = parseFloat(getComputedStyle(numbersEl).lineHeight) || 18
    const line = Math.floor((yWithinPre - padTop) / lineHeight) + 1
    if (line >= 1 && line <= lineCount) {
      gotoLine(line)
    }
  }

  // B9: toggle fold en una linea de inicio. Si esta colapsado, expande.
  // Si no, colapsa. Si la linea no es inicio de fold, no hace nada.
  function toggleFold(startLine: number) {
    if (!availableFolds.has(startLine)) return
    const next = new Set(collapsedFolds)
    if (next.has(startLine)) {
      next.delete(startLine)
    } else {
      next.add(startLine)
    }
    collapsedFolds = next
    // Recalcular current line por si quedo dentro de un fold
    queueMicrotask(recomputeCurrentLine)
  }

  // B9: click en chevron del gutter. Calcula que startLine fue clickeado.
  // Estrategia: el chevron esta en una "linea virtual" del gutter que
  // coincide con la linea de inicio de un fold. Recorremos las lineas
  // del gutter proyectado y vemos si la linea clickeada es inicio de fold.
  function handleChevronClick(ev: MouseEvent) {
    if (!numbersEl || !textareaEl) return
    ev.stopPropagation() // no propagar al click del gutter
    const rect = numbersEl.getBoundingClientRect()
    const yWithinPre = ev.clientY - rect.top + numbersEl.scrollTop
    const padTop = parseFloat(getComputedStyle(numbersEl).paddingTop) || 0
    const lineHeight = parseFloat(getComputedStyle(numbersEl).lineHeight) || 18
    const visualLine = Math.floor((yWithinPre - padTop) / lineHeight) + 1

    // Mapear visualLine (linea en el texto proyectado) -> linea real
    // Recorremos las lineas reales y contamos cuantas "salen" en el render.
    const lines = value.split('\n')
    const skipLines = new Set<number>()
    for (const startLine of collapsedFolds) {
      const range = availableFolds.get(startLine)
      if (!range) continue
      for (let l = range.startLine + 1; l <= range.endLine; l++) {
        skipLines.add(l)
      }
    }

    let visual = 0
    for (let i = 0; i < lines.length; i++) {
      const realLine = i + 1
      if (skipLines.has(realLine)) continue
      visual++
      if (visual === visualLine) {
        if (availableFolds.has(realLine)) {
          toggleFold(realLine)
        }
        return
      }
    }
  }

  // B9: lista derivada de (visualLineIndex, startLine, collapsed) para
  // renderizar los chevrons en el gutter. La visualLineIndex es 1-based
  // contando lineas renderizadas (no saltadas).
  let chevronRows = $derived(() => {
    const lines = value.split('\n')
    const skipLines = new Set<number>()
    for (const startLine of collapsedFolds) {
      const range = availableFolds.get(startLine)
      if (!range) continue
      for (let l = range.startLine + 1; l <= range.endLine; l++) {
        skipLines.add(l)
      }
    }
    const rows: Array<{ visual: number; startLine: number; collapsed: boolean }> = []
    let visual = 0
    for (let i = 0; i < lines.length; i++) {
      const realLine = i + 1
      if (skipLines.has(realLine)) continue
      visual++
      if (availableFolds.has(realLine)) {
        rows.push({
          visual,
          startLine: realLine,
          collapsed: collapsedFolds.has(realLine),
        })
      }
    }
    return rows
  })

  // B6: estado undo/redo
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
      // B9: highlight sobre el texto proyectado (con "…" donde hay folds)
      // para que el overlay quede alineado con el gutter.
      const projected = projectFoldedLines(value, collapsedFolds, availableFolds)
      const result = hljs.highlight(projected, { language, ignoreIllegals: true })
      // B10: ya no envuelvo el match con un span (rompe HTML cuando cruza
      // entities o spans de hljs). En su lugar, se renderiza un overlay DIV
      // absoluto sobre el editor (ver .match-marker en el template).
      highlighted = result.value + '\n'
    } catch {
      const projected = projectFoldedLines(value, collapsedFolds, availableFolds)
      highlighted = escapeHtml(projected) + '\n'
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

  function scheduleHistoryPush() {
    if (!history) return
    if (historyTimer) clearTimeout(historyTimer)
    historyTimer = setTimeout(() => {
      history!.push(value)
      updateHistoryState()
    }, 500)
  }

  function pushHistoryNow() {
    if (!history) return
    if (historyTimer) clearTimeout(historyTimer)
    history.push(value)
    updateHistoryState()
  }

  export function undo() {
    if (!history) return
    const prev = history.undo()
    updateHistoryState()
    if (prev !== null) {
      value = prev
      // Recalcular currentLine despues del cambio
      queueMicrotask(recomputeCurrentLine)
    }
  }

  export function redo() {
    if (!history) return
    const next = history.redo()
    updateHistoryState()
    if (next !== null) {
      value = next
      queueMicrotask(recomputeCurrentLine)
    }
  }

  // Resaltar cuando cambia value o language
  $effect(() => {
    void value
    void language
    scheduleHighlight()
  })

  // Push al history cuando cambia value
  $effect(() => {
    void value
    if (!history) return
    scheduleHistoryPush()
  })

  // B7: sincronizar scroll de numbers y pre con el textarea
  function handleScroll() {
    if (!textareaEl) return
    if (preEl) {
      preEl.scrollTop = textareaEl.scrollTop
      preEl.scrollLeft = textareaEl.scrollLeft
    }
    if (numbersEl) {
      numbersEl.scrollTop = textareaEl.scrollTop
    }
  }

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
          recomputeCurrentLine()
        }
      })
      pushHistoryNow()
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
    // Recalcular current line al recibir focus
    queueMicrotask(recomputeCurrentLine)
  }

  // B7: cuando cambia selectionStart (cursor), recalcular currentLine.
  // Usamos un effect que depende de selectionStart.
  $effect(() => {
    void selectionStart
    // currentLine ya se setea dentro de recomputeCurrentLine,
    // pero necesitamos reactividad. La funcion se llama en handlers,
    // asi que este effect no hace nada en si.
  })

  // B7: listener de selectionchange a nivel document para capturar
  // el cambio de cursor sin importar como se hizo (click, key, etc).
  $effect(() => {
    if (typeof document === 'undefined') return
    function onSelChange() {
      if (document.activeElement === textareaEl) {
        recomputeCurrentLine()
      }
    }
    document.addEventListener('selectionchange', onSelChange)
    return () => document.removeEventListener('selectionchange', onSelChange)
  })

  onMount(() => {
    recomputeHighlight()
    updateHistoryState()
    recomputeCurrentLine()
  })

  onDestroy(() => {
    if (highlightTimer) clearTimeout(highlightTimer)
    if (historyTimer) clearTimeout(historyTimer)
  })
</script>

<div class="code-editor" data-panel={panel}>
  <!-- B7: Line numbers gutter (a la izquierda). B8: clickable. -->
  <div class="gutter" aria-hidden="true">
    <pre
      bind:this={numbersEl}
      class="line-numbers"
      class:has-current={currentLine >= 1}
      style="--current-line: {currentLine};"
      onclick={handleGutterClick}
      role="presentation"
    >{numbersText}</pre>
    <!-- B9: capa de chevrons superpuesta al gutter -->
    <div class="chevrons">
      {#each chevronRows() as row (row.startLine)}
        <button
          type="button"
          class="chevron"
          class:collapsed={row.collapsed}
          style="top: calc(var(--gutter-pad-top, 0.6rem) + (var(--gutter-line-h, 1.5rem) * {row.visual - 1}));"
          title={row.collapsed ? 'Expandir' : 'Plegar'}
          aria-label={row.collapsed ? 'Expandir bloque' : 'Plegar bloque'}
          onclick={handleChevronClick}
        >{row.collapsed ? '▸' : '▾'}</button>
      {/each}
    </div>
  </div>

  <!-- Editor: textarea + highlight overlay absolutos -->
  <div class="editor-pane">
    <pre
      bind:this={preEl}
      class="hljs language-{language} highlight-overlay"
      aria-hidden="true"
    >{@html highlighted}</pre>
    <!-- B10: marker absoluto sobre el bracket/tag match -->
    {#if matchVisual}
      <div
        class="match-marker"
        style="top: calc(var(--gutter-pad-top, 0.6rem) + (var(--gutter-line-h, 1.275rem) * ({matchVisual.line - 1}))); left: calc(var(--gutter-pad-top, 0.6rem) + 0.85rem * 0.6 * ({matchVisual.col - 1})); width: calc(0.85rem * 0.6 * {matchVisual.length}); height: var(--gutter-line-h, 1.275rem);"
      ></div>
    {/if}
    <textarea
      bind:this={textareaEl}
      bind:value
      onscroll={handleScroll}
      onkeydown={handleKeydown}
      onblur={handleBlur}
      onfocus={handleFocusInternal}
      onclick={recomputeCurrentLine}
      onkeyup={recomputeCurrentLine}
      spellcheck="false"
      autocapitalize="off"
      autocorrect="off"
      autocomplete="off"
      aria-label={ariaLabel}
    ></textarea>
  </div>
</div>

<style>
  /* B7: editor contenedor. */
  .code-editor {
    position: relative;
    flex: 1;
    display: flex;
    min-height: 0;
    background: var(--pg-bg, #1e1e1e);
    /* B10: variables para posicionar marker. Tambien las usa B9 (chevrons). */
    --gutter-pad-top: 0.6rem;
    --gutter-line-h: 1.275rem; /* 0.85rem * 1.5 */
  }

  /* B7: gutter de numeros. B8: clickable (solo el pre hijo recibe clicks). */
  .gutter {
    position: relative; /* B9: para contener chevrons absolutos */
    flex: 0 0 auto;
    width: 2.5rem;
    background: var(--pg-bg, #1e1e1e);
    border-right: 1px solid var(--pg-border, #3f3f46);
    overflow: hidden;
    user-select: none;
    pointer-events: none;
  }

  .line-numbers {
    /* Mismas propiedades que el editor para alineamiento perfecto */
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.85rem;
    line-height: 1.5;
    margin: 0;
    border: 0;
    box-sizing: border-box;
    white-space: pre;
    word-wrap: normal;
    overflow: hidden;

    color: #6a737d;
    text-align: right;
    background: transparent;

    /* Mismo padding-top que el editor + padding-right para el ultimo digito */
    padding: 0.6rem 0.4rem 0.6rem 0;
    width: 100%;
    height: 100%;

    /* B8: clickable */
    pointer-events: auto;
    cursor: pointer;
  }

  /* B8: highlight sutil al hacer hover */
  .line-numbers:hover {
    color: #c9d1d9;
  }

  /* B7: highlight de current line via gradiente — trick para no renderizar
     N divs. Limitacion: solo resalta si el viewport alcanza esa linea. */
  .line-numbers.has-current {
    background: linear-gradient(
      to bottom,
      transparent 0,
      transparent calc((var(--current-line) - 1) * 1lh),
      rgba(217, 119, 6, 0.12) calc((var(--current-line) - 1) * 1lh),
      rgba(217, 119, 6, 0.12) calc(var(--current-line) * 1lh),
      transparent calc(var(--current-line) * 1lh)
    );
  }

  /* Editor pane: contiene pre + textarea absolutos */
  .editor-pane {
    position: relative;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .highlight-overlay,
  .editor-pane textarea {
    /* Mismas propiedades para alineamiento pixel-perfect */
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

  .editor-pane textarea {
    color: transparent;
    caret-color: var(--pg-fg, #e4e4f7);
    background: transparent;
    resize: none;
    outline: none;
    z-index: 2;
  }

  .editor-pane textarea::selection {
    background: rgba(217, 119, 6, 0.35);
  }

  .editor-pane textarea:focus {
    background: transparent;
  }

  /* Sync scrollbar: escondemos el del highlight para que solo se vea el del textarea */
  .highlight-overlay::-webkit-scrollbar {
    display: none;
  }
  .highlight-overlay {
    scrollbar-width: none;
  }

  /* Tema dark de highlight.js */
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

  /* B10: bracket/tag match highlight (overlay DIV absoluto sobre el editor) */
  .match-marker {
    position: absolute;
    pointer-events: none;
    background: rgba(217, 119, 6, 0.4);
    box-shadow: 0 0 0 1px rgba(217, 119, 6, 0.7);
    border-radius: 2px;
    z-index: 3; /* sobre el highlight (z=1) y textarea (z=2) */
  }

  /* B9: capa de chevrons sobre el gutter */
  .chevrons {
    position: absolute;
    inset: 0;
    pointer-events: none; /* los botones individuales re-habilitan */
  }
  .chevron {
    position: absolute;
    left: 0;
    width: 1rem;
    height: var(--gutter-line-h, 1.275rem);
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
    background: transparent;
    border: 0;
    color: #8b949e;
    cursor: pointer;
    pointer-events: auto;
    font-size: 0.7rem;
    transition: color 0.1s, background 0.1s;
    border-radius: 2px;
  }
  .chevron:hover {
    color: var(--pg-fg, #e4e4e7);
    background: rgba(217, 119, 6, 0.18);
  }
  .chevron.collapsed {
    color: var(--pg-accent, #d97706);
  }
</style>
