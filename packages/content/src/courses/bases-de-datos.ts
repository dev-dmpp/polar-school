import type { Course } from '../types'

export const basesDeDatos: Course = {
  meta: {
    slug: 'bases-de-datos',
    title: 'Bases de datos SQL desde cero',
    description:
      'Una base de datos guarda información de forma ordenada para que la consultes rápido. SQL es el lenguaje para hacerlo. En este curso aprendés los tres motores más usados (SQLite, MySQL, PostgreSQL) y los comandos esenciales: CREATE, INSERT, SELECT, WHERE, UPDATE, DELETE, JOIN.',
    level: 'intermedio',
    totalLessons: 10,
    estimatedHours: 5,
  },
  lessons: [
    {
      slug: '01-que-es-sql',
      title: 'Qué es SQL y por qué lo necesitás',
      description:
        'SQL (Structured Query Language) es el lenguaje para hablar con bases de datos relacionales. En vez de guardar datos en archivos, los organizás en TABLAS con filas y columnas, y los consultás con queries.',
      command: 'sqlite3',
      difficulty: 'intermedio',
      category: 'sql',
      readTime: 5,
      example:
        '# Una tabla se ve así:\n#\n#   id | nombre  | email\n#   ---+---------+-------------------\n#    1 | Ana     | ana@ejemplo.com\n#    2 | Beto    | beto@ejemplo.com\n#\n# SQL te deja crear esta tabla, insertar filas y consultarlas.',
      tip: "SQLite no necesita servidor: es un solo archivo. MySQL y PostgreSQL son servidores profesionales que usan las apps más grandes del mundo.",
    },
    {
      slug: '02-create-table',
      title: 'CREATE TABLE — definir la estructura',
      description:
        'Antes de guardar datos necesitás una tabla. CREATE TABLE define qué columnas tiene y qué tipo de dato guarda cada una (texto, número, fecha, etc.).',
      command: 'sqlite3',
      difficulty: 'intermedio',
      category: 'sql',
      readTime: 5,
      example:
        'sqlite3 test.db "CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nombre TEXT NOT NULL, email TEXT UNIQUE, edad INTEGER)"\n\nCREATE TABLE\n\n# Ahora la tabla existe, vacía, lista para insertar datos.',
      tip: 'PRIMARY KEY marca la columna identificadora (única, no se repite). NOT NULL obliga a tener valor. UNIQUE prohíbe duplicados.',
    },
    {
      slug: '03-insert',
      title: 'INSERT INTO — agregar filas',
      description:
        'Para meter datos en una tabla usas INSERT INTO. Le dices la tabla, qué columnas vas a llenar y los valores en el mismo orden.',
      command: 'sqlite3',
      difficulty: 'intermedio',
      category: 'sql',
      readTime: 4,
      example:
        'sqlite3 test.db "INSERT INTO usuarios (nombre, email, edad) VALUES (\'Ana\', \'ana@ejemplo.com\', 28)"\nINSERT 0 1\n\nsqlite3 test.db "INSERT INTO usuarios (nombre, email, edad) VALUES (\'Beto\', \'beto@ejemplo.com\', 34)"\nINSERT 0 1',
      tip: 'El "INSERT 0 1" significa: 0 filas ya estaban, 1 fila nueva insertada. Si pasás un id duplicado en una PRIMARY KEY, falla con error.',
    },
    {
      slug: '04-select',
      title: 'SELECT — leer datos de una tabla',
      description:
        'SELECT es el comando más usado: te devuelve filas de una tabla. SELECT * trae todas las columnas; SELECT nombre, email solo las que pediste.',
      command: 'sqlite3',
      difficulty: 'intermedio',
      category: 'sql',
      readTime: 5,
      example:
        'sqlite3 test.db "SELECT * FROM usuarios"\nid | nombre | email           | edad\n---+--------+-----------------+-----\n1  | Ana    | ana@ejemplo.com | 28\n2  | Beto   | beto@ejemplo.com| 34\n\nsqlite3 test.db "SELECT nombre, edad FROM usuarios"\nnombre | edad\n-------+-----\nAna    | 28\nBeto   | 34',
      tip: "SELECT * es tentador pero en apps reales conviene pedir solo las columnas que necesitás: es más rápido y menos propenso a errores.",
    },
    {
      slug: '05-where',
      title: 'WHERE — filtrar filas',
      description:
        'WHERE le agrega una condición al SELECT: solo trae las filas que cumplen el criterio. Sin WHERE te devuelve TODA la tabla.',
      command: 'sqlite3',
      difficulty: 'intermedio',
      category: 'sql',
      readTime: 5,
      example:
        'sqlite3 test.db "SELECT * FROM usuarios WHERE edad > 30"\nid | nombre | email             | edad\n---+--------+-------------------+-----\n2  | Beto   | beto@ejemplo.com  | 34\n\nsqlite3 test.db "SELECT * FROM usuarios WHERE nombre = \'Ana\'"\nid | nombre | email             | edad\n---+--------+-------------------+-----\n1  | Ana    | ana@ejemplo.com  | 28',
      tip: "Operadores: =, !=, <, >, <=, >=, LIKE (patrones con %), IN (lista), AND/OR para combinar. Los strings van con comillas simples.",
    },
    {
      slug: '06-update',
      title: 'UPDATE — modificar filas existentes',
      description:
        'UPDATE cambia datos de filas que ya existen. SIEMPRE usa WHERE: sin WHERE, actualiza TODAS las filas de la tabla.',
      command: 'sqlite3',
      difficulty: 'intermedio',
      category: 'sql',
      readTime: 5,
      example:
        'sqlite3 test.db "UPDATE usuarios SET edad = 29 WHERE nombre = \'Ana\'"\nUPDATE 1\n\nsqlite3 test.db "SELECT nombre, edad FROM usuarios WHERE nombre = \'Ana\'"\nnombre | edad\n-------+-----\nAna    | 29',
      tip: "El \"UPDATE 1\" significa que actualizaste 1 fila. Sin WHERE el UPDATE toca TODAS las filas — accidente clásico que borra o cambia datos críticos.",
    },
    {
      slug: '07-delete',
      title: 'DELETE — borrar filas',
      description:
        'DELETE saca filas de la tabla. Como UPDATE, sin WHERE borra TODO. Para borrar la tabla entera existe DROP TABLE (que también borra la estructura).',
      command: 'sqlite3',
      difficulty: 'intermedio',
      category: 'sql',
      readTime: 4,
      example:
        'sqlite3 test.db "DELETE FROM usuarios WHERE nombre = \'Beto\'"\nDELETE 1\n\nsqlite3 test.db "SELECT * FROM usuarios"\nid | nombre | email             | edad\n---+--------+-------------------+-----\n1  | Ana    | ana@ejemplo.com  | 29',
      tip: "Para deshacer, en bases reales usas transacciones con BEGIN y ROLLBACK. En SQLite en modo producción, siempre hace backup antes de DELETE masivos.",
    },
    {
      slug: '08-postgres-vs-mysql',
      title: 'PostgreSQL vs MySQL — cuál usar',
      description:
        'Los dos son motores SQL profesionales. MySQL es más popular en apps web (WordPress, Magento). PostgreSQL es más estricto y potente para datos complejos (PostGIS, JSON nativo, mejor concurrencia).',
      command: 'psql',
      difficulty: 'intermedio',
      category: 'sql',
      readTime: 5,
      example:
        '# PostgreSQL\n$ psql -U polar -d mibase\npsql (16.3)\nmibase=# SELECT version();\n                                  version\n------------------------------------------------------------------\nPostgreSQL 16.3 on x86_64-pc-linux-gnu\n\n# MySQL\n$ mysql -u polar -p mibase\nmysql> SELECT VERSION();\n+---------+\n| VERSION |\n+---------+\n| 8.0.36  |\n+---------+',
      tip: "Si recién empezás: SQLite (archivo local) → MySQL (web apps) → PostgreSQL (cuando necesitás tipos avanzados, JSON, geospatial).",
    },
    {
      slug: '09-join',
      title: 'JOIN — combinar dos tablas',
      description:
        'Las bases reales tienen MUCHAS tablas relacionadas. JOIN te permite cruzarlas. usuarios + pedidos = saber qué usuario hizo qué pedido.',
      command: 'sqlite3',
      difficulty: 'avanzado',
      category: 'sql',
      readTime: 6,
      example:
        '# Tabla pedidos:\n#   id | usuario_id | producto\n#   ---+------------+------------\n#   1  | 1          | Libro A\n#   2  | 1          | Libro B\n#   3  | 2          | Curso X\n\nsqlite3 test.db "SELECT u.nombre, p.producto FROM usuarios u JOIN pedidos p ON u.id = p.usuario_id"\nnombre | producto\n-------+---------\nAna    | Libro A\nAna    | Libro B\nBeto   | Curso X',
      tip: "INNER JOIN: solo filas que matchean en ambas. LEFT JOIN: todas las de la izquierda + match de la derecha (NULL si no hay). Los alias (u, p) hacen la query más corta.",
    },
    {
      slug: '10-indices',
      title: 'Índices y buenas prácticas',
      description:
        'Un índice hace que las búsquedas en columnas grandes sean rápidas (como el índice de un libro). Pero agregar índices a TODAS las columnas no siempre es bueno: hace las inserciones más lentas.',
      command: 'sqlite3',
      difficulty: 'avanzado',
      category: 'sql',
      readTime: 5,
      example:
        'sqlite3 test.db "CREATE INDEX idx_email ON usuarios(email)"\n#\n# Ahora SELECT * FROM usuarios WHERE email = \'x\'\n# usa el índice en vez de recorrer toda la tabla.\n\n# Buenas prácticas:\n# - PRIMARY KEY siempre (id autoincremental)\n# - Índices en columnas que aparecen en WHERE o JOIN\n# - Nombres de columnas en snake_case\n# - Backups automáticos antes de cambios grandes',
      tip: "En producción, antes de modificar una tabla grande, hace un backup. Y proba los cambios en una copia local primero.",
    },
  ],
}
