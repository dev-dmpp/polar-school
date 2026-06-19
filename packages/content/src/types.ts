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
