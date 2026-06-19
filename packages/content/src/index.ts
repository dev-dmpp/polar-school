// Re-exports de cursos. Cada curso tiene su propio módulo.
export * from './courses/linux-basico'
export * from './courses/linux-intermedio'
export * from './courses/docker'
export * from './courses/tu-primer-vps'
export * from './courses/git-github'
export * from './courses/linux-avanzado'
export * from './courses/bases-de-datos'
export * from './courses/primer-sitio-web'
export type { Lesson, Course, CourseMeta } from './types'

import { linuxBasico } from './courses/linux-basico'
import { linuxIntermedio } from './courses/linux-intermedio'
import { docker } from './courses/docker'
import { tuPrimerVps } from './courses/tu-primer-vps'
import { gitGithub } from './courses/git-github'
import { linuxAvanzado } from './courses/linux-avanzado'
import { basesDeDatos } from './courses/bases-de-datos'
import { primerSitioWeb } from './courses/primer-sitio-web'

export const allCourses = [
  linuxBasico,
  linuxIntermedio,
  docker,
  tuPrimerVps,
  gitGithub,
  linuxAvanzado,
  basesDeDatos,
  primerSitioWeb,
] as const
