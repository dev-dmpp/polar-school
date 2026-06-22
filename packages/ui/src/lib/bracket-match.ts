/**
 * bracket-match.ts — encuentra el par de un bracket/tag bajo el cursor.
 *
 * B10: cuando el cursor esta sobre un bracket ( ) { } [ ] o cerca de un
 * tag HTML, retorna el rango {start, end} del bracket/tag par para que
 * el CodeEditor lo resalte visualmente.
 *
 * Algoritmo:
 *   - Brackets: scan lineal con counter, contando { [ ( y sus closes.
 *     Para JS ignora brackets dentro de strings y comentarios.
 *   - Tags HTML: parsea el tag actual bajo el cursor y busca su match
 *     contando profundidad. Ignora self-closing y void elements.
 *
 * No intenta hacer rainbow ni scope lines (fuera de scope B10).
 */

export type MatchKind = 'open' | 'close' | 'tag-open' | 'tag-close' | 'tag-self'

export interface Match {
  /** Offset absoluto (en chars) del inicio del match. */
  start: number
  /** Offset absoluto (en chars) del final del match (exclusive). */
  end: number
  /** Que tipo de match es. */
  kind: MatchKind
  /** Caracter/tag del match encontrado (para debugging). */
  char: string
}

const VOID_HTML = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

/**
 * Encuentra el match del bracket/tag bajo el cursor.
 *
 * @param source   texto completo del editor
 * @param cursorPos  posicion del cursor (0-based char offset)
 * @param language   'html' | 'css' | 'javascript'
 * @returns Match | null si no hay match (bracket desbalanceado, en string, etc.)
 */
export function findBracketMatch(
  source: string,
  cursorPos: number,
  language: 'html' | 'css' | 'javascript',
): Match | null {
  if (cursorPos < 0 || cursorPos > source.length) return null

  // 1) Cursor SOBRE un bracket char
  const onChar = source[cursorPos]
  if (onChar && '(){}[]'.includes(onChar)) {
    return matchBrace(source, cursorPos, onChar, language)
  }

  // 2) Cursor justo DESPUES de un close bracket (cursor entre ] y lo siguiente)
  if (cursorPos > 0) {
    const prev = source[cursorPos - 1]
    if (')]}'.includes(prev)) {
      return matchBrace(source, cursorPos - 1, prev, language)
    }
  }

  // 3) HTML tag matching — el cursor esta dentro o sobre un tag
  if (language === 'html') {
    return matchHtmlTag(source, cursorPos)
  }

  return null
}

/**
 * Encuentra el match de un bracket en source[pos].
 * Soporta (), [], {}. Para JS ignora dentro de strings/comments.
 */
function matchBrace(
  source: string,
  pos: number,
  ch: string,
  language: 'html' | 'css' | 'javascript',
): Match | null {
  const isOpen = '({['.includes(ch)
  const closeOf: Record<string, string> = { '(': ')', '{': '}', '[': ']' }
  const openOf: Record<string, string> = { ')': '(', '}': '{', ']': '[' }

  if (isOpen) {
    const target = closeOf[ch]
    // Scan hacia adelante contando depth
    let depth = 1
    let i = pos + 1
    while (i < source.length) {
      if (language === 'javascript' && isInsideJsStringOrComment(source, i)) {
        i++
        continue
      }
      const c = source[i]
      if (c === ch) depth++
      else if (c === target) {
        depth--
        if (depth === 0) {
          return { start: i, end: i + 1, kind: 'open', char: target }
        }
      }
      i++
    }
    return null
  } else {
    const target = openOf[ch]
    // Scan hacia atras
    let depth = 1
    let i = pos - 1
    while (i >= 0) {
      if (language === 'javascript' && isInsideJsStringOrComment(source, i)) {
        i--
        continue
      }
      const c = source[i]
      if (c === ch) depth++
      else if (c === target) {
        depth--
        if (depth === 0) {
          return { start: i, end: i + 1, kind: 'close', char: target }
        }
      }
      i--
    }
    return null
  }
}

/**
 * Verifica si source[i] cae dentro de un string o comentario en JS.
 * Re-corre desde el principio hasta i (simple, correcto para playground).
 */
function isInsideJsStringOrComment(source: string, i: number): boolean {
  let inSingle = false
  let inDouble = false
  let inBack = false
  let inLineComment = false
  let inBlockComment = false

  let k = 0
  while (k < i) {
    const ch = source[k]
    const next = source[k + 1]

    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      k++
      continue
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false
        k += 2
        continue
      }
      k++
      continue
    }
    if (inSingle) {
      if (ch === '\\') {
        k += 2
        continue
      }
      if (ch === "'") inSingle = false
      k++
      continue
    }
    if (inDouble) {
      if (ch === '\\') {
        k += 2
        continue
      }
      if (ch === '"') inDouble = false
      k++
      continue
    }
    if (inBack) {
      if (ch === '\\') {
        k += 2
        continue
      }
      if (ch === '`') inBack = false
      k++
      continue
    }

    if (ch === '/' && next === '/') {
      inLineComment = true
      k += 2
      continue
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true
      k += 2
      continue
    }
    if (ch === "'") {
      inSingle = true
      k++
      continue
    }
    if (ch === '"') {
      inDouble = true
      k++
      continue
    }
    if (ch === '`') {
      inBack = true
      k++
      continue
    }

    k++
  }

  return inSingle || inDouble || inBack || inLineComment || inBlockComment
}

/**
 * HTML tag matching. Detecta si el cursor esta dentro de un <tag> o </tag>
 * y busca su match correspondiente.
 */
function matchHtmlTag(source: string, cursorPos: number): Match | null {
  // Encuentra el < y > que delimitan el tag actual bajo el cursor
  // Scan hacia atras buscando '<'
  let tagStart = -1
  let k = cursorPos
  while (k >= 0) {
    const ch = source[k]
    if (ch === '<') {
      tagStart = k
      break
    }
    if (ch === '>') {
      // El cursor esta despues del >, no dentro de un tag
      return null
    }
    k--
  }
  if (tagStart === -1) return null

  // Encuentra el > de cierre
  let tagEnd = source.indexOf('>', tagStart)
  if (tagEnd === -1) return null
  tagEnd++ // exclusive

  // Verifica que el cursor cae dentro del tag
  if (cursorPos < tagStart || cursorPos > tagEnd) return null

  // Parsea el contenido del tag
  const inner = source.substring(tagStart + 1, tagEnd - 1).trim()
  if (inner.length === 0) return null

  const isClose = inner.startsWith('/')
  const isSelfClose = inner.endsWith('/') || inner.startsWith('!') || inner.startsWith('?')
  const tagNameMatch = inner.match(/^(\/?)([a-zA-Z][a-zA-Z0-9-]*)/)
  if (!tagNameMatch) return null
  const tagName = tagNameMatch[2].toLowerCase()

  if (VOID_HTML.has(tagName)) return null
  if (isSelfClose) return null

  // Tag regex para buscar matches
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)\/?>/g

  if (!isClose) {
    // Apertura -> buscar cierre
    const stack: Array<{ tag: string; line: number }> = []
    tagRe.lastIndex = tagEnd
    let m: RegExpExecArray | null
    while ((m = tagRe.exec(source)) !== null) {
      const full = m[0]
      const name = m[1].toLowerCase()
      const isC = full.startsWith('</')
      const isSC = full.endsWith('/>') || VOID_HTML.has(name)
      if (isSC) continue
      if (!isC) {
        stack.push({ tag: name, line: 0 })
      } else {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].tag === name) {
            stack.splice(i, 1)
            break
          }
        }
        if (stack.length === 0 && name === tagName) {
          // Encontrado el match de cierre
          return {
            start: m.index,
            end: m.index + full.length,
            kind: 'tag-open',
            char: full,
          }
        }
      }
    }
    return null
  } else {
    // Cierre </tag> -> buscar apertura correspondiente
    // Scan hacia atras desde tagStart
    tagRe.lastIndex = 0
    const matches: Array<{ index: number; len: number; tag: string; isClose: boolean }> = []
    let m: RegExpExecArray | null
    while ((m = tagRe.exec(source)) !== null) {
      if (m.index >= tagStart) break
      const full = m[0]
      const name = m[1].toLowerCase()
      const isC = full.startsWith('</')
      const isSC = full.endsWith('/>') || VOID_HTML.has(name)
      if (isSC) continue
      matches.push({ index: m.index, len: full.length, tag: name, isClose: isC })
    }
    // Buscar la apertura mas reciente del mismo tag sin cerrar
    const stack: string[] = []
    for (const e of matches) {
      if (e.isClose) {
        stack.pop()
      } else {
        if (e.tag === tagName) stack.push(tagName)
      }
    }
    // Tomar la primera apertura del mismo tag en orden
    for (let i = matches.length - 1; i >= 0; i--) {
      const e = matches[i]
      if (!e.isClose && e.tag === tagName) {
        return {
          start: e.index,
          end: e.index + e.len,
          kind: 'tag-close',
          char: source.substring(e.index, e.index + e.len),
        }
      }
    }
    return null
  }
}
