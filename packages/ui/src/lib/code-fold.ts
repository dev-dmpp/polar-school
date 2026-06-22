/**
 * code-fold.ts — deteccion de rangos plegables por lenguaje.
 *
 * B9: code folding para el CodeEditor.
 *
 * Output: Map<line, FoldRange> donde la key es la linea de INICIO
 * del rango (donde aparece el chevron "▾"). Cada FoldRange describe
 * un bloque { startLine, endLine, kind } que puede colapsarse.
 *
 * kind indica que se pliega:
 *   - 'tag'  -> HTML/XML open+close match (B9)
 *   - 'brace' -> CSS/JS {} balanced (B9)
 *
 * Algoritmo:
 *   - HTML: regex simple de <tag ...> + </tag> con matching por nombre.
 *     No maneja comentarios condicionales ni CDATA (no relevante para playground).
 *   - CSS: cuenta { y } linea por linea, fold cuando balance llega a 0
 *     partiendo de una linea que abrio { en lineCount > 1.
 *   - JS: similar a CSS pero ignora { y } dentro de strings ("`, ', `)
 *     y comentarios // ... y /* ... *\/ (heuristica basica, suficiente para playground).
 *
 * Limitaciones conocidas:
 *   - HTML no detecta <script>...</script> como fold (lo trata como tag normal,
 *     igual funciona porque matching por nombre).
 *   - CSS/JS no distinguen entre bloques de control (if/else) y bloques de
 *     declaracion. Eso esta bien para playground educativo.
 *   - Si un bracket esta dentro de un string, el detector JS lo cuenta igual
 *     (puede dar folds incorrectos). Trade-off aceptado.
 */

export type FoldKind = 'tag' | 'brace'

export interface FoldRange {
  /** Linea de inicio (1-based) — donde aparece el chevron. */
  startLine: number
  /** Linea de fin (1-based) — donde termina el bloque. */
  endLine: number
  /** Que se esta plegando. */
  kind: FoldKind
}

/**
 * Detecta rangos plegables para el lenguaje dado.
 * Retorna Map<startLine, FoldRange>.
 */
export function detectFolds(
  source: string,
  language: 'html' | 'css' | 'javascript',
): Map<number, FoldRange> {
  switch (language) {
    case 'html':
      return detectHtmlFolds(source)
    case 'css':
      return detectBraceFolds(source, ['{', '}'])
    case 'javascript':
      return detectJsFolds(source)
  }
}

/**
 * HTML: matchea <tag ...> contra </tag> en orden.
 * Ignora self-closing (<br/>, <img />, etc).
 * Ignora void elements (br, img, input, meta, link, hr).
 */
function detectHtmlFolds(source: string): Map<number, FoldRange> {
  const folds = new Map<number, FoldRange>()
  const voidElements = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
  ])

  // Stack de tags abiertos: { tagName, startLine }
  const stack: Array<{ tag: string; line: number }> = []

  // Regex: captura <tag ...> o </tag> en cada linea
  // Flags: 'g' global, 'i' case insensitive para nombres
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)\/?>/g

  // Track linea actual (1-based)
  let line = 1

  for (const rawLine of source.split('\n')) {
    // Reset lastIndex porque reusamos el regex con /g
    tagRe.lastIndex = 0

    let m: RegExpExecArray | null
    while ((m = tagRe.exec(rawLine)) !== null) {
      const fullMatch = m[0]
      const tagName = m[1].toLowerCase()
      const isClose = fullMatch.startsWith('</')
      const isSelfClose = fullMatch.endsWith('/>') || voidElements.has(tagName)

      if (isSelfClose) continue
      if (voidElements.has(tagName)) continue

      if (!isClose) {
        // Apertura
        stack.push({ tag: tagName, line })
      } else {
        // Cierre — busca el match en el stack (el mas reciente con mismo tag)
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].tag === tagName) {
            const startLine = stack[i].line
            // Solo fold si el rango cubre 2+ lineas
            if (line > startLine) {
              folds.set(startLine, { startLine, endLine: line, kind: 'tag' })
            }
            stack.splice(i, 1)
            break
          }
        }
      }
    }

    line++
  }

  return folds
}

/**
 * Detecta folds por {} balanceados. Usado para CSS.
 * Trackea depth a traves de lineas; cuando depth baja a 0 desde >0,
 * cierra un fold.
 *
 * Importante: NO ignora brackets dentro de strings (CSS no suele tenerlos
 * salvo content: "..{..}" que es raro). Aceptamos la limitacion.
 */
function detectBraceFolds(
  source: string,
  brackets: [string, string],
): Map<number, FoldRange> {
  const folds = new Map<number, FoldRange>()
  const lines = source.split('\n')

  let depth = 0
  let foldStart: number | null = null
  let line = 1

  for (const rawLine of lines) {
    for (const ch of rawLine) {
      if (ch === brackets[0]) {
        if (depth === 0) foldStart = line
        depth++
      } else if (ch === brackets[1]) {
        depth--
        if (depth === 0 && foldStart !== null && line > foldStart) {
          folds.set(foldStart, {
            startLine: foldStart,
            endLine: line,
            kind: 'brace',
          })
          foldStart = null
        }
      }
    }
    line++
  }

  return folds
}

/**
 * JS: como CSS pero ignora { } dentro de strings y comentarios.
 * Heuristica: tokeniza linea por linea, lleva un estado "inString"/"inComment".
 */
function detectJsFolds(source: string): Map<number, FoldRange> {
  const folds = new Map<number, FoldRange>()
  const lines = source.split('\n')

  let depth = 0
  let foldStart: number | null = null
  let line = 1

  for (const rawLine of lines) {
    let inSingle = false
    let inDouble = false
    let inBack = false
    let inLineComment = false
    let inBlockComment = false

    let i = 0
    while (i < rawLine.length) {
      const ch = rawLine[i]
      const next = rawLine[i + 1]

      // Comentarios
      if (!inSingle && !inDouble && !inBack) {
        if (inLineComment) {
          i++
          continue
        }
        if (inBlockComment) {
          if (ch === '*' && next === '/') {
            inBlockComment = false
            i += 2
            continue
          }
          i++
          continue
        }
        if (ch === '/' && next === '/') {
          inLineComment = true
          i += 2
          continue
        }
        if (ch === '/' && next === '*') {
          inBlockComment = true
          i += 2
          continue
        }
      }

      // Strings
      if (inSingle) {
        if (ch === '\\') {
          i += 2
          continue
        }
        if (ch === "'") inSingle = false
        i++
        continue
      }
      if (inDouble) {
        if (ch === '\\') {
          i += 2
          continue
        }
        if (ch === '"') inDouble = false
        i++
        continue
      }
      if (inBack) {
        if (ch === '\\') {
          i += 2
          continue
        }
        if (ch === '`') inBack = false
        i++
        continue
      }

      // Apertura de strings
      if (ch === "'") {
        inSingle = true
        i++
        continue
      }
      if (ch === '"') {
        inDouble = true
        i++
        continue
      }
      if (ch === '`') {
        inBack = true
        i++
        continue
      }

      // Brackets
      if (ch === '{') {
        if (depth === 0) foldStart = line
        depth++
      } else if (ch === '}') {
        depth--
        if (depth === 0 && foldStart !== null && line > foldStart) {
          folds.set(foldStart, {
            startLine: foldStart,
            endLine: line,
            kind: 'brace',
          })
          foldStart = null
        }
      }

      i++
    }

    line++
  }

  return folds
}

/**
 * Dado el texto fuente y un set de folds colapsados,
 * retorna una version "plegada" donde las lineas dentro de un
 * rango colapsado se reemplazan por una sola linea con "…".
 *
 * Esto es para el RENDER (gutter + highlight overlay), NO para
 * el value real del textarea.
 */
export function projectFoldedLines(
  source: string,
  collapsed: Set<number>,
  folds: Map<number, FoldRange>,
): string {
  const lines = source.split('\n')
  const out: string[] = []
  const skipLines = new Set<number>()

  // Construyo set de lineas a saltar (las que estan dentro de un fold colapsado
  // excepto la primera del rango).
  for (const startLine of collapsed) {
    const range = folds.get(startLine)
    if (!range) continue
    for (let l = range.startLine + 1; l <= range.endLine; l++) {
      skipLines.add(l)
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    if (skipLines.has(lineNum)) continue

    const isCollapsedStart = collapsed.has(lineNum)
    if (isCollapsedStart) {
      // Reemplazar el contenido de la linea con "…"
      out.push('…')
    } else {
      out.push(lines[i])
    }
  }

  return out.join('\n')
}

/**
 * Dado el texto fuente, folds y folds colapsados,
 * retorna el texto de numeros para el gutter.
 *
 * El numero de linea REAL se muestra en la linea de inicio del fold.
 * Las lineas saltadas NO se enumeran (gap en la numeracion).
 *
 * Linea donde empieza un fold colapsado: muestra "…" en vez del numero.
 */
export function projectFoldedNumbers(
  source: string,
  collapsed: Set<number>,
  folds: Map<number, FoldRange>,
): string {
  const lines = source.split('\n')
  const out: string[] = []
  const skipLines = new Set<number>()

  for (const startLine of collapsed) {
    const range = folds.get(startLine)
    if (!range) continue
    for (let l = range.startLine + 1; l <= range.endLine; l++) {
      skipLines.add(l)
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    if (skipLines.has(lineNum)) continue

    const isCollapsedStart = collapsed.has(lineNum)
    if (isCollapsedStart) {
      out.push('…')
    } else {
      out.push(String(lineNum))
    }
  }

  // Misma cantidad de newlines que lineas originales para alinear scroll
  return out.join('\n') + '\n'
}
