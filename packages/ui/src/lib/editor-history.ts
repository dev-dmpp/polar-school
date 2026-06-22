/**
 * editor-history.ts
 *
 * Stack de undo/redo para editores de texto. En memoria, no persistido.
 *
 * Decisiones:
 *   - Stack por panel (HTML, CSS, JS cada uno con su propio).
 *   - Push NO por keystroke (seria 1 entry por letra): quien usa esta clase
 *     hace push con debounce.
 *   - Cualquier push DESCARTA el redo stack (comportamiento estandar:
 *     si escribis algo nuevo despues de undo, no podes rehacer lo viejo).
 *   - maxSize FIFO: si se llena, se descarta la entrada mas vieja.
 *   - Si el valor a pushear es IGUAL al ultimo, no se duplica.
 */

export class EditorHistory {
  private stack: string[] = []
  private redoStack: string[] = []
  private maxSize: number

  constructor(maxSize = 50) {
    this.maxSize = Math.max(1, maxSize)
  }

  /**
   * Pushea un nuevo estado al stack. Descarta el redoStack.
   * Si el valor es identico al ultimo, no hace nada.
   */
  push(value: string): void {
    const last = this.stack[this.stack.length - 1]
    if (last === value) return
    this.stack.push(value)
    if (this.stack.length > this.maxSize) {
      this.stack.shift()
    }
    this.redoStack = []
  }

  /**
   * Devuelve el estado anterior y mueve el actual al redoStack.
   * Devuelve null si no hay nada para deshacer.
   */
  undo(): string | null {
    if (this.stack.length === 0) return null
    const current = this.stack.pop()!
    this.redoStack.push(current)
    // El "anterior" es el top del stack despues del pop
    return this.stack[this.stack.length - 1] ?? null
  }

  /**
   * Devuelve el siguiente estado del redoStack.
   * Devuelve null si no hay nada para rehacer.
   */
  redo(): string | null {
    if (this.redoStack.length === 0) return null
    const next = this.redoStack.pop()!
    this.stack.push(next)
    return next
  }

  canUndo(): boolean {
    return this.stack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  /** Limpia ambos stacks. Llamar en reset o al cargar un draft externo. */
  clear(): void {
    this.stack = []
    this.redoStack = []
  }

  /** Util para debug / tests. */
  get sizes(): { undo: number; redo: number } {
    return { undo: this.stack.length, redo: this.redoStack.length }
  }
}
