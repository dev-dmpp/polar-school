import type { Course } from '../types'

export const gitGithub: Course = {
  meta: {
    slug: 'git-github',
    title: 'Git y GitHub desde cero',
    description:
      'Git es el sistema de control de versiones que usan casi todos los desarrolladores del mundo. GitHub es donde viven tus repositorios en la nube. En este curso aprendes el flujo completo: init, add, commit, push, ramas, merges y el flujo profesional de Pull Requests.',
    level: 'intermedio',
    totalLessons: 10,
    estimatedHours: 4,
  },
  lessons: [
    {
      slug: '01-git-init',
      title: 'git init — crear un repositorio',
      description:
        'Un repositorio Git es una carpeta vigilada: Git recuerda cada cambio que hagas en sus archivos. Empieza por crear uno con git init.',
      command: 'git',
      difficulty: 'intermedio',
      category: 'git',
      readTime: 4,
      example:
        '$ cd mi-proyecto\n$ git init\nInicializado repositorio Git vacío en /home/polar/mi-proyecto/.git/',
      tip: 'El comando no muestra nada después de la línea inicial: si no hay error, todo salió bien. El subdirectorio .git es donde Git guarda toda la historia.',
    },
    {
      slug: '02-git-add',
      title: 'git add — elegir qué cambios registrar',
      description:
        'Git no guarda todo automáticamente. Con git add eliges qué archivos quieres incluir en el próximo commit. Es como armar una "caja" antes de sellarla.',
      command: 'git',
      difficulty: 'intermedio',
      category: 'git',
      readTime: 5,
      example:
        '$ git add README.md\n$ git add .\n$ git add src/\n\n[archivos preparados para el próximo commit]',
      tip: "git add . agrega todos los archivos modificados. En proyectos grandes prefieres git add archivo por archivo para no subir cosas que no quieres.",
    },
    {
      slug: '03-git-commit',
      title: 'git commit -m — guardar los cambios en la historia',
      description:
        'Un commit es un punto en la historia del proyecto: una foto de cómo están los archivos en este momento, con un mensaje que explica qué cambió.',
      command: 'git',
      difficulty: 'intermedio',
      category: 'git',
      readTime: 5,
      example:
        '$ git commit -m "agrego el README inicial"\n[main a4a9qbn] agrego el README inicial\n 1 archivo cambiado, 8 inserciones(+)\n Autor: polar <polar@polar.school>',
      tip: 'El mensaje en -m debería ser claro y empezar con verbo en presente: "agrego", "corrijo", "refactorizo". Para mensajes largos usas git commit sin -m y se abre el editor.',
    },
    {
      slug: '04-git-status',
      title: 'git status — ver qué cambió',
      description:
        'Antes de hacer commit quieres saber qué modificaste. git status te dice qué archivos cambiaron, cuáles están listos para commitear y en qué rama estás.',
      command: 'git',
      difficulty: 'intermedio',
      category: 'git',
      readTime: 4,
      example:
        '$ git status\nEn la rama main\nTu rama está actualizada con \'origin/main\'.\n\nnada para hacer commit, el árbol de trabajo está limpio',
      tip: 'Es el comando que más vas a usar en el día a día. Conviene memorizar la salida: archivos en rojo no están en staging, en verde sí.',
    },
    {
      slug: '05-git-log',
      title: 'git log — ver la historia del proyecto',
      description:
        'Cada commit tiene un hash (identificador único), un autor, una fecha y un mensaje. git log los lista del más reciente al más viejo.',
      command: 'git',
      difficulty: 'intermedio',
      category: 'git',
      readTime: 4,
      example:
        '$ git log\ncommit a4a9qbn (HEAD -> main)\nAuthor: polar <polar@polar.school>\nDate:   Mon Jun 19 10:30:00 2026\n\n    agrego el README inicial\n\ncommit 9f3c2a1\nAuthor: polar <polar@polar.school>\nDate:   Mon Jun 19 09:15:00 2026\n\n    primer commit',
      tip: 'git log --oneline muestra solo el hash corto y el mensaje, una línea por commit. Útil cuando la historia es larga.',
    },
    {
      slug: '06-git-branch',
      title: 'git branch — trabajar en ramas paralelas',
      description:
        'Una rama es una línea de tiempo alternativa. La usas para trabajar en una feature sin tocar el código principal. La rama por defecto es main.',
      command: 'git',
      difficulty: 'intermedio',
      category: 'git',
      readTime: 5,
      example:
        '$ git branch\n* main\n  feature-login\n  hotfix-bug-404\n\n$ git branch nueva-feature\n$ git checkout -b experimento\nCambiaste a una nueva rama \'experimento\'',
      tip: 'El asterisco (*) marca la rama donde estás parado. La convención moderna es usar main como rama principal (antes se llamaba master).',
    },
    {
      slug: '07-git-merge',
      title: 'git merge — fusionar ramas',
      description:
        'Cuando terminaste el trabajo en una rama, la traes de vuelta a main con git merge. Git intenta combinar los cambios automáticamente.',
      command: 'git',
      difficulty: 'intermedio',
      category: 'git',
      readTime: 5,
      example:
        '$ git checkout main\n$ git merge feature-login\nMerge made by the \'ort\' strategy.\n src/auth.ts | 45 +++++++++++++++++++++++++++++++++++++++++++++\n 1 archivo cambiado, 45 inserciones(+)',
      tip: 'Si Git no puede fusionar automáticamente (conflicto) te lo avisa y te deja editar los archivos marcados. Después corres git add y git commit para terminar.',
    },
    {
      slug: '08-git-remote',
      title: 'git remote — conectar con GitHub',
      description:
        'Hasta ahora todo vive en tu máquina. Para subir el repo a GitHub agregas un remote: una URL donde vive el proyecto en la nube.',
      command: 'git',
      difficulty: 'intermedio',
      category: 'git',
      readTime: 5,
      example:
        '$ git remote add origin https://github.com/dev-dmpp/mi-proyecto.git\n$ git remote -v\norigin\thttps://github.com/dev-dmpp/mi-proyecto.git (fetch)\norigin\thttps://github.com/dev-dmpp/mi-proyecto.git (push)',
      tip: 'origin es solo el nombre por defecto que se le da al remote principal. Podés tener varios (origin, upstream, backup) para apuntar a distintas copias.',
    },
    {
      slug: '09-git-push',
      title: 'git push — subir commits a GitHub',
      description:
        'git push envía tus commits locales al remote. Después de esto tus cambios están en GitHub y cualquier colaborador puede verlos.',
      command: 'git',
      difficulty: 'intermedio',
      category: 'git',
      readTime: 5,
      example:
        '$ git push -u origin main\nObjeto commits: 3, hecho.\nDelta compression using up to 4 threads.\nTotal 3 (delta 0), reused 0 (delta 0), pack-reused 0\nTo https://github.com/dev-dmpp/mi-proyecto.git\n   abc1234..a4a9qbn  main -> main',
      tip: "El -u se usa solo la primera vez: deja configurada la rama upstream. Después con git push alcanza.",
    },
    {
      slug: '10-pull-request',
      title: 'Pull Requests — el flujo de GitHub',
      description:
        'Una Pull Request (PR) es una propuesta de cambio: dices "miren lo que hice, agrégenlo si les parece". Es el flujo profesional para que otros revisen tu código antes de fusionarlo.',
      command: 'git',
      difficulty: 'avanzado',
      category: 'git',
      readTime: 6,
      example:
        '# 1. Crear rama y pushear\n$ git checkout -b feature-login\n$ git push -u origin feature-login\n\n# 2. Ir a GitHub, click "Compare & pull request"\n# 3. Llenar título y descripción\n# 4. Esperar review y mergear',
      tip: "En proyectos open source el flujo es: fork del repo, trabajar en tu fork, abrir PR contra el repo original. En equipos con acceso directo, trabajas directo en el repo principal.",
    },
  ],
}
