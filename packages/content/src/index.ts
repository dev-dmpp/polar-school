// Re-exports de cursos. Cada curso tiene su propio módulo.
export * from './courses/linux-basico'
export * from './courses/linux-intermedio'
export * from './courses/docker'
export * from './courses/tu-primer-vps'
export type { Lesson, Course, CourseMeta } from './types'

import { linuxBasico } from './courses/linux-basico'
import { linuxIntermedio } from './courses/linux-intermedio'
import { docker } from './courses/docker'
import { tuPrimerVps } from './courses/tu-primer-vps'

export const allCourses = [linuxBasico, linuxIntermedio, docker, tuPrimerVps] as const
