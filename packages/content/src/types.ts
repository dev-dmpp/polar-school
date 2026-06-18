export interface Lesson {
  slug: string
  title: string
  description: string
  command: string
  difficulty: 'basico' | 'intermedio' | 'avanzado'
  category: 'navegacion' | 'archivos' | 'texto' | 'permisos' | 'procesos' | 'red' | 'paquetes'
  readTime: number
}

export interface CourseMeta {
  slug: string
  title: string
  description: string
  level: 'basico' | 'intermedio' | 'avanzado'
  totalLessons: number
  estimatedHours: number
}

export interface Course {
  meta: CourseMeta
  lessons: Lesson[]
}
