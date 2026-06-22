// ============================================================
// Lesson kinds (B1)
// ============================================================
// Discriminated union. Cada lección renderiza un playground
// distinto según su `kind`. El switcher vive en B2.
export const LESSON_KINDS = [
  'terminal-linux',   // SandboxTerminal (Docker real, Alpine)
  'playground-html',  // HtmlPlayground (B3, iframe sandbox)
  'playground-git',   // GitPlayground (futuro)
  'playground-docker',// DockerPlayground (futuro)
  'reading-only',     // Sin playground interactivo
] as const

export type LessonKind = typeof LESSON_KINDS[number]

export function isLessonKind(value: unknown): value is LessonKind {
  return (
    typeof value === 'string' &&
    (LESSON_KINDS as readonly string[]).includes(value)
  )
}

export interface Lesson {
  slug: string
  title: string
  description: string
  command: string
  difficulty: 'basico' | 'intermedio' | 'avanzado'
  category:
    | 'navegacion'
    | 'archivos'
    | 'texto'
    | 'permisos'
    | 'procesos'
    | 'red'
    | 'paquetes'
    | 'servicios'
    | 'logs'
    | 'disco'
    | 'memoria'
    | 'compresion'
    | 'contenedores'
    | 'imagenes'
    | 'orquestacion'
    | 'deploy'
    | 'ssh'
    | 'webserver'
    | 'seguridad'
    | 'git'
    | 'sql'
    | 'web'
    | 'automatizacion'
    | 'sistema'
  /** B1: qué playground renderiza esta lección. */
  kind: LessonKind
  readTime: number
  example?: string
  tip?: string
}

export interface CourseMeta {
  slug: string
  title: string
  description: string
  level: 'basico' | 'intermedio' | 'avanzado'
  totalLessons: number
  estimatedHours: number
  upcoming?: boolean
}

export interface Course {
  meta: CourseMeta
  lessons: Lesson[]
}
