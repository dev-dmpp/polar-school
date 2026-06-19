// Simulator engine — ejecuta comandos Linux simulados en el navegador.
// Inspirado en https://commands.dev pero standalone, sin dependencias.
// Para F0: simula los 20 comandos más comunes. Después se reemplaza
// por un sandbox real (xterm.js + Docker ephemeral).

export interface SimResult {
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
}

interface FSNode {
  type: 'file' | 'dir'
  content?: string
  children?: Record<string, FSNode>
  mode?: number
  mtime?: number
  owner?: string
}

interface SimContext {
  cwd: string
  fs: FSNode
  env: Record<string, string>
  history: string[]
  git: {
    branch: string
    branches: string[]
    remote: string | null
    commits: { hash: string; msg: string; author: string }[]
    staged: Set<string>
    user: string
    email: string
    initialized: boolean
  }
  db: {
    postgres: Map<string, TableRow[]>
    mysql: Map<string, TableRow[]>
    sqlite: Map<string, TableRow[]>
  }
}

interface TableRow { [col: string]: string | number | null }

const HOME = '/home/polar'

function createInitialFS(): FSNode {
  const now = Date.now()
  return {
    type: 'dir',
    children: {
      home: {
        type: 'dir',
        children: {
          polar: {
            type: 'dir',
            children: {
              'README.md': {
                type: 'file',
                content:
                  '# Bienvenido a Polar School\n\nEste es un simulador de Linux. Prueba los comandos de la lección sin miedo — no puedes romper nada. Tu sesión se resetea al recargar la página.\n',
                mode: 0o644,
                mtime: now,
                owner: 'polar',
              },
              'notas.txt': {
                type: 'file',
                content: 'mis apuntes de Linux\n',
                mode: 0o644,
                mtime: now,
                owner: 'polar',
              },
              proyectos: {
                type: 'dir',
                children: {
                  'hola.txt': {
                    type: 'file',
                    content: 'hola mundo\n',
                    mode: 0o644,
                    mtime: now,
                    owner: 'polar',
                  },
                },
                mode: 0o755,
                mtime: now,
                owner: 'polar',
              },
              '.bashrc': {
                type: 'file',
                content: 'export PS1="\\u@\\h:\\w$ "\n',
                mode: 0o644,
                mtime: now,
                owner: 'polar',
              },
            },
            mode: 0o755,
            mtime: now,
            owner: 'polar',
          },
        },
        mode: 0o755,
        mtime: now,
        owner: 'root',
      },
      tmp: {
        type: 'dir',
        children: {},
        mode: 0o1777,
        mtime: now,
        owner: 'root',
      },
      etc: {
        type: 'dir',
        children: {
          hostname: { type: 'file', content: 'polar-school\n', mode: 0o644, mtime: now, owner: 'root' },
          'os-release': {
            type: 'file',
            content: 'NAME="Polar Linux"\nVERSION="1.0"\n',
            mode: 0o644,
            mtime: now,
            owner: 'root',
          },
        },
        mode: 0o755,
        mtime: now,
        owner: 'root',
      },
      var: {
        type: 'dir',
        children: {
          log: {
            type: 'dir',
            children: {
              'syslog': {
                type: 'file',
                content: 'Jun 18 10:00:00 polar-school systemd[1]: Started.\n',
                mode: 0o644,
                mtime: now,
                owner: 'root',
              },
            },
            mode: 0o755,
            mtime: now,
            owner: 'root',
          },
        },
        mode: 0o755,
        mtime: now,
        owner: 'root',
      },
    },
    mode: 0o755,
    mtime: now,
    owner: 'root',
  }
}

function createInitialContext(): SimContext {
  return {
    cwd: HOME,
    fs: createInitialFS(),
    env: {
      USER: 'polar',
      HOME: HOME,
      PWD: HOME,
      PATH: '/usr/local/bin:/usr/bin:/bin',
      SHELL: '/bin/bash',
      LANG: 'es_PA.UTF-8',
    },
    history: [],
    git: {
      branch: 'main',
      branches: ['main'],
      remote: null,
      commits: [],
      staged: new Set<string>(),
      user: 'polar',
      email: 'polar@polar.school',
      initialized: false,
    },
    db: {
      postgres: new Map<string, TableRow[]>(),
      mysql: new Map<string, TableRow[]>(),
      sqlite: new Map<string, TableRow[]>(),
    },
  }
}

function resolvePath(ctx: SimContext, path: string): string {
  if (path.startsWith('/')) return normalize(path)
  if (path === '~') return HOME
  if (path.startsWith('~/')) return normalize(HOME + '/' + path.slice(2))
  return normalize(ctx.cwd + '/' + path)
}

function normalize(path: string): string {
  const parts = path.split('/').filter((p) => p.length > 0)
  const result: string[] = []
  for (const part of parts) {
    if (part === '.') continue
    if (part === '..') result.pop()
    else result.push(part)
  }
  return '/' + result.join('/')
}

function getNode(ctx: SimContext, path: string): FSNode | null {
  const normalized = resolvePath(ctx, path)
  if (normalized === '/') return ctx.fs
  const parts = normalized.split('/').filter((p) => p.length > 0)
  let node: FSNode = ctx.fs
  for (const part of parts) {
    if (node.type !== 'dir' || !node.children || !node.children[part]) return null
    node = node.children[part]
  }
  return node
}

function formatMode(mode: number): string {
  const type = (mode & 0o170000) === 0o040000 ? 'd' : '-'
  const r = (m: number) => (m & 4 ? 'r' : '-') + (m & 2 ? 'w' : '-') + (m & 1 ? 'x' : '-')
  return type + r((mode >> 6) & 7) + r((mode >> 3) & 7) + r(mode & 7)
}

function ls(ctx: SimContext, args: string[]): SimResult {
  const long = args.includes('-l') || args.includes('-la') || args.includes('-al')
  const all = args.includes('-a') || args.includes('-la') || args.includes('-al')
  const targets = args.filter((a) => !a.startsWith('-'))
  const paths = targets.length > 0 ? targets : ['.']

  let stdout = ''
  for (const path of paths) {
    const node = getNode(ctx, path)
    if (!node) {
      return err(`ls: no se puede acceder a '${path}': No existe el archivo o directorio`)
    }
    if (node.type === 'file') {
      stdout += long
        ? `${formatMode(node.mode ?? 0)} 1 ${node.owner ?? 'polar'} polar  ${(node.content ?? '').length} ${new Date(node.mtime ?? Date.now()).toISOString().slice(0, 10)} ${path}\n`
        : `${path}\n`
      continue
    }
    const entries = Object.entries(node.children ?? {})
      .filter(([name]) => all || !name.startsWith('.'))
      .sort(([a], [b]) => a.localeCompare(b))
    if (long) {
      for (const [name, child] of entries) {
        const size = child.type === 'file' ? (child.content?.length ?? 0) : 4096
        stdout += `${formatMode(child.mode ?? 0)} 1 ${child.owner ?? 'polar'} polar  ${size} ${new Date(child.mtime ?? Date.now()).toISOString().slice(0, 10)} ${name}\n`
      }
    } else {
      stdout += entries.map(([name]) => name).join('  ') + '\n'
    }
  }
  return ok(stdout.trimEnd())
}

function cat(ctx: SimContext, args: string[]): SimResult {
  if (args.length === 0) return err('cat: falta archivo')
  let stdout = ''
  for (const path of args) {
    const node = getNode(ctx, path)
    if (!node) return err(`cat: ${path}: No existe el archivo o directorio`)
    if (node.type !== 'file') return err(`cat: ${path}: Es un directorio`)
    stdout += node.content ?? ''
  }
  return ok(stdout)
}

function cd(ctx: SimContext, args: string[]): SimResult {
  const target = args[0] ?? HOME
  const resolved = resolvePath(ctx, target.replace(/^~$/, HOME))
  const node = getNode(ctx, resolved)
  if (!node) return err(`cd: ${target}: No existe el archivo o directorio`)
  if (node.type !== 'dir') return err(`cd: ${target}: No es un directorio`)
  ctx.cwd = resolved
  ctx.env.PWD = resolved
  return ok('')
}

function pwd(ctx: SimContext): SimResult {
  return ok(ctx.cwd)
}

function mkdir(ctx: SimContext, args: string[]): SimResult {
  const parents = args.includes('-p')
  const paths = args.filter((a) => !a.startsWith('-'))
  if (paths.length === 0) return err('mkdir: falta operando')
  for (const path of paths) {
    const resolved = resolvePath(ctx, path)
    const parts = resolved.split('/').filter((p) => p.length > 0)
    let current = ctx.fs
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!current.children) current.children = {}
      if (!current.children[part]) {
        if (i < parts.length - 1 && !parents) {
          return err(`mkdir: no se puede crear '${path}': No existe el archivo o directorio`)
        }
        current.children[part] = { type: 'dir', children: {}, mode: 0o755, mtime: Date.now(), owner: 'polar' }
      }
      current = current.children[part]
      if (current.type !== 'dir') return err(`mkdir: no se puede crear '${path}': Ya existe`)
    }
  }
  return ok('')
}

function touch(ctx: SimContext, args: string[]): SimResult {
  if (args.length === 0) return err('touch: falta archivo')
  for (const path of args) {
    const resolved = resolvePath(ctx, path)
    const parts = resolved.split('/').filter((p) => p.length > 0)
    const name = parts.pop()!
    let parent = ctx.fs
    for (const part of parts) {
      if (!parent.children || !parent.children[part]) {
        return err(`touch: no se puede tocar '${path}': No existe el archivo o directorio`)
      }
      parent = parent.children[part]
      if (parent.type !== 'dir') return err(`touch: no se puede tocar '${path}'`)
    }
    if (!parent.children) parent.children = {}
    if (!parent.children[name]) {
      parent.children[name] = { type: 'file', content: '', mode: 0o644, mtime: Date.now(), owner: 'polar' }
    } else {
      parent.children[name].mtime = Date.now()
    }
  }
  return ok('')
}

function rm(ctx: SimContext, args: string[]): SimResult {
  const recursive = args.includes('-r') || args.includes('-rf') || args.includes('-fr')
  const force = args.includes('-f') || args.includes('-rf') || args.includes('-fr')
  const paths = args.filter((a) => !a.startsWith('-'))
  if (paths.length === 0) return err('rm: falta operando')
  for (const path of paths) {
    const resolved = resolvePath(ctx, path)
    if (resolved === '/' || resolved === HOME) {
      if (!force) return err(`rm: no se puede borrar '${path}'`)
      continue
    }
    const parts = resolved.split('/').filter((p) => p.length > 0)
    const name = parts.pop()!
    let parent = ctx.fs
    for (const part of parts) {
      if (!parent.children || !parent.children[part]) {
        if (force) continue
        return err(`rm: no se puede borrar '${path}': No existe el archivo o directorio`)
      }
      parent = parent.children[part]
    }
    if (!parent.children || !parent.children[name]) {
      if (force) continue
      return err(`rm: no se puede borrar '${path}': No existe el archivo o directorio`)
    }
    const target = parent.children[name]
    if (target.type === 'dir' && !recursive) {
      return err(`rm: no se puede borrar '${path}': Es un directorio`)
    }
    delete parent.children[name]
  }
  return ok('')
}

function cp(ctx: SimContext, args: string[]): SimResult {
  if (args.length < 2) return err('cp: faltan argumentos')
  const recursive = args.includes('-r') || args.includes('-R')
  const sources = args.filter((a) => !a.startsWith('-'))
  const dest = sources.pop()!
  for (const src of sources) {
    const node = getNode(ctx, src)
    if (!node) return err(`cp: no se puede acceder a '${src}'`)
    if (node.type === 'dir' && !recursive) {
      return err(`cp: -r no especificado; omitiendo directorio '${src}'`)
    }
    const destNode = getNode(ctx, dest)
    if (destNode && destNode.type === 'dir') {
      const baseName = src.split('/').pop()!
      writeAt(ctx, dest + '/' + baseName, JSON.parse(JSON.stringify(node)))
    } else {
      writeAt(ctx, dest, JSON.parse(JSON.stringify(node)))
    }
  }
  return ok('')
}

function mv(ctx: SimContext, args: string[]): SimResult {
  if (args.length < 2) return err('mv: faltan argumentos')
  const sources = args.filter((a) => !a.startsWith('-'))
  const dest = sources.pop()!
  for (const src of sources) {
    const node = getNode(ctx, src)
    if (!node) return err(`mv: no se puede acceder a '${src}'`)
    const destNode = getNode(ctx, dest)
    if (destNode && destNode.type === 'dir') {
      const baseName = src.split('/').pop()!
      writeAt(ctx, dest + '/' + baseName, JSON.parse(JSON.stringify(node)))
    } else {
      writeAt(ctx, dest, JSON.parse(JSON.stringify(node)))
    }
    const parts = resolvePath(ctx, src).split('/').filter((p) => p.length > 0)
    const name = parts.pop()!
    let parent = ctx.fs
    for (const part of parts) {
      if (parent.children && parent.children[part]) parent = parent.children[part]
    }
    if (parent.children) delete parent.children[name]
  }
  return ok('')
}

function writeAt(ctx: SimContext, path: string, node: FSNode): void {
  const resolved = resolvePath(ctx, path)
  const parts = resolved.split('/').filter((p) => p.length > 0)
  const name = parts.pop()!
  let parent = ctx.fs
  for (const part of parts) {
    if (!parent.children) parent.children = {}
    if (!parent.children[part]) parent.children[part] = { type: 'dir', children: {} }
    parent = parent.children[part]
  }
  if (!parent.children) parent.children = {}
  parent.children[name] = node
}

function echo(ctx: SimContext, args: string[]): SimResult {
  const joined = args.join(' ')
  const redirIdx = args.findIndex((a) => a === '>' || a === '>>')
  if (redirIdx !== -1) {
    const op = args[redirIdx]
    const path = args[redirIdx + 1]
    const text = args.slice(0, redirIdx).join(' ') + '\n'
    if (!path) return err(`echo: falta archivo destino después de '${op}'`)
    const existing = getNode(ctx, path)
    if (op === '>' && existing && existing.type === 'file') {
      const node = getNode(ctx, path)!
      node.content = text
      node.mtime = Date.now()
    } else {
      const parts = resolvePath(ctx, path).split('/').filter((p) => p.length > 0)
      const name = parts.pop()!
      let parent = ctx.fs
      for (const part of parts) {
        if (!parent.children || !parent.children[part]) {
          parent.children![part] = { type: 'dir', children: {} }
        }
        parent = parent.children![part]
      }
      if (!parent.children) parent.children = {}
      if (op === '>>' && parent.children[name]?.type === 'file') {
        parent.children[name].content = (parent.children[name].content ?? '') + text
        parent.children[name].mtime = Date.now()
      } else {
        parent.children[name] = { type: 'file', content: text, mode: 0o644, mtime: Date.now(), owner: 'polar' }
      }
    }
    void ctx
    return ok('')
  }
  return ok(joined)
}

function grep(ctx: SimContext, args: string[]): SimResult {
  if (args.length < 2) return err('grep: patrón y archivo requeridos')
  const pattern = args[0]
  const path = args[1]
  const node = getNode(ctx, path)
  if (!node) return err(`grep: ${path}: No existe el archivo o directorio`)
  if (node.type !== 'file') return err(`grep: ${path}: Es un directorio`)
  const lines = (node.content ?? '').split('\n')
  const matches = lines.filter((l) => l.includes(pattern))
  return ok(matches.join('\n'))
}

function findCmd(ctx: SimContext, args: string[]): SimResult {
  const nameIdx = args.indexOf('-name')
  if (nameIdx === -1 || !args[nameIdx + 1]) return err('find: se requiere -name <patrón>')
  const pattern = args[nameIdx + 1].replace(/\*/g, '.*')
  const startPath = args.filter((a) => !a.startsWith('-') && a !== args[nameIdx + 1])[0] ?? '.'
  const results: string[] = []
  const walk = (path: string, node: FSNode) => {
    if (node.type === 'file') {
      const name = path.split('/').pop()!
      if (new RegExp(`^${pattern}$`).test(name)) results.push(path)
    } else if (node.children) {
      for (const [name, child] of Object.entries(node.children)) {
        walk(path === '/' ? '/' + name : path + '/' + name, child)
      }
    }
  }
  const node = getNode(ctx, startPath)
  if (node) walk(resolvePath(ctx, startPath), node)
  return ok(results.join('\n'))
}

function chmod(ctx: SimContext, args: string[]): SimResult {
  const recursive = args.includes('-R') || args.includes('-r')
  const filtered = args.filter((a) => a !== '-R' && a !== '-r')
  if (filtered.length < 2) return err('chmod: modo y archivo requeridos')
  const modeStr = filtered[0]
  const path = filtered[1]
  const mode = parseInt(modeStr, 8)
  if (isNaN(mode)) return err(`chmod: modo inválido: '${modeStr}'`)
  const apply = (node: FSNode): SimResult => {
    if (!node) return err(`chmod: no se puede acceder a '${path}'`)
    node.mode = mode
    node.mtime = Date.now()
    if (recursive && node.type === 'dir' && node.children) {
      for (const child of Object.values(node.children)) apply(child)
    }
    return ok('')
  }
  const node = getNode(ctx, path)
  return apply(node)
}

function ps(_ctx: SimContext, args: string[]): SimResult {
  if (args.includes('aux') || args.includes('-ef')) {
    return ok(
      'USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n' +
      'root         1  0.0  0.1 168920 11844 ?        Ss   Jun15   0:01 /sbin/init\n' +
      'root       387  0.0  0.2  72340  9324 ?        Ss   Jun15   0:00 sshd: /usr/sbin/sshd\n' +
      'polar      421  0.0  0.1  21032  5120 pts/0    Ss   10:00   0:00 -bash\n' +
      'polar      587  0.0  0.0  38820  3456 pts/0    R+   12:34   0:00 ps aux\n' +
      'www-data   612  0.1  0.5 142432 22456 ?        S    11:22   0:04 nginx: worker process'
    )
  }
  return ok(
    '  PID TTY          TIME CMD\n' +
    '    1 ?        00:00:01 systemd\n' +
    '  142 ?        00:00:00 sshd\n' +
    '  387 pts/0    00:00:00 bash\n' +
    '  421 pts/0    00:00:00 ps'
  )
}

function kill(_ctx: SimContext, args: string[]): SimResult {
  if (args.length === 0) return err('kill: falta PID')
  const force = args.includes('-9') || args.includes('-KILL') || args.includes('-SIGKILL')
  const pid = args.filter((a) => !a.startsWith('-'))[0]
  if (!pid || isNaN(Number(pid))) return err(`kill: argumento inválido: '${pid}'`)
  return ok(`[simulado] Proceso ${pid} ${force ? 'terminado forzosamente (SIGKILL)' : 'terminado (SIGTERM)'}`)
}

function man(_ctx: SimContext, args: string[]): SimResult {
  if (args.length === 0) return err('¿Qué página de manual quieres?')
  const cmd = args[0]
  return ok(
    `${cmd.toUpperCase()}(1)                 Manual del usuario                 ${cmd.toUpperCase()}(1)\n\nNOMBRE\n       ${cmd} - comando simulado del simulador Polar School\n\nDESCRIPCIÓN\n       Esta es una versión simulada. Para ver el manual real, abre una terminal\n       Linux real y escribe 'man ${cmd}'.\n`
  )
}

// ===== F1: Linux Intermedio / Docker / VPS commands =====

function tail(ctx: SimContext, args: string[]): SimResult {
  if (args.length === 0) return err('tail: falta archivo')
  const nIdx = args.findIndex((a) => a === '-n')
  const n = nIdx >= 0 ? parseInt(args[nIdx + 1], 10) : 10
  const files = args.filter((a) => !a.startsWith('-') && a !== String(n))
  if (files.length === 0) return err('tail: falta archivo')
  const out: string[] = []
  for (const file of files) {
    const node = getNode(ctx, file)
    if (!node || node.type !== 'file') return err(`tail: no se puede abrir '${file}'`)
    const lines = (node.content ?? '').split('\n')
    const last = lines.slice(-n)
    out.push(files.length > 1 ? `==> ${file} <==\n${last.join('\n')}` : last.join('\n'))
  }
  return ok(out.join('\n'))
}

function head(ctx: SimContext, args: string[]): SimResult {
  if (args.length === 0) return err('head: falta archivo')
  const nIdx = args.findIndex((a) => a === '-n')
  const n = nIdx >= 0 ? parseInt(args[nIdx + 1], 10) : 10
  const files = args.filter((a) => !a.startsWith('-') && a !== String(n))
  if (files.length === 0) return err('head: falta archivo')
  const out: string[] = []
  for (const file of files) {
    const node = getNode(ctx, file)
    if (!node || node.type !== 'file') return err(`head: no se puede abrir '${file}'`)
    const lines = (node.content ?? '').split('\n')
    const first = lines.slice(0, n)
    out.push(files.length > 1 ? `==> ${file} <==\n${first.join('\n')}` : first.join('\n'))
  }
  return ok(out.join('\n'))
}

function wc(ctx: SimContext, args: string[]): SimResult {
  const files = args.filter((a) => !a.startsWith('-'))
  if (files.length === 0) return err('wc: falta archivo')
  const lines: string[] = []
  for (const file of files) {
    const node = getNode(ctx, file)
    if (!node || node.type !== 'file') return err(`wc: ${file}: No existe el archivo`)
    const content = node.content ?? ''
    const cLines = content.split('\n').length - (content.endsWith('\n') ? 1 : 0)
    const cWords = content.split(/\s+/).filter((w) => w.length > 0).length
    const cBytes = content.length
    lines.push(`${String(cLines).padStart(7)} ${String(cWords).padStart(7)} ${String(cBytes).padStart(7)} ${file}`)
  }
  return ok(lines.join('\n'))
}

function sort(ctx: SimContext, args: string[]): SimResult {
  const reverse = args.includes('-r')
  const files = args.filter((a) => !a.startsWith('-'))
  if (files.length === 0) return err('sort: falta archivo')
  const out: string[] = []
  for (const file of files) {
    const node = getNode(ctx, file)
    if (!node || node.type !== 'file') return err(`sort: ${file}: No existe`)
    const lines = (node.content ?? '').split('\n').filter((l) => l.length > 0)
    const sorted = [...lines].sort()
    out.push(reverse ? sorted.reverse().join('\n') : sorted.join('\n'))
  }
  return ok(out.join('\n'))
}

function uniq(ctx: SimContext, args: string[]): SimResult {
  const files = args.filter((a) => !a.startsWith('-'))
  if (files.length === 0) return err('uniq: falta archivo')
  const file = files[0]
  const node = getNode(ctx, file)
  if (!node || node.type !== 'file') return err(`uniq: ${file}: No existe`)
  const lines = (node.content ?? '').split('\n')
  const seen = new Set<string>()
  const result: string[] = []
  for (const line of lines) {
    if (!seen.has(line)) {
      seen.add(line)
      result.push(line)
    }
  }
  return ok(result.join('\n'))
}

function tar(ctx: SimContext, args: string[]): SimResult {
  // Desempaca flags agrupados: '-czf' -> ['-c', '-z', '-f'], '-xzf' -> ['-x', '-z', '-f']
  const expanded: string[] = []
  for (const a of args) {
    if (a.length > 2 && a[0] === '-' && a[1] !== '-' && !a.includes('=')) {
      expanded.push(...a.slice(1).split('').map((c) => '-' + c))
    } else {
      expanded.push(a)
    }
  }
  args = expanded
  const create = args.includes('-c')
  const extract = args.includes('-x')
  const list = args.includes('-t')
  const fIdx = args.findIndex((a) => a === '-f')
  const f = fIdx >= 0 ? args[fIdx + 1] : null
  if (!f) return err('tar: falta argumento -f')
  if (create) {
    const paths = args.filter((a) => !a.startsWith('-') && a !== f)
    if (paths.length === 0) return err('tar: no se dieron rutas')
    let content = 'TAR ARCHIVE\n'
    for (const path of paths) {
      const node = getNode(ctx, path)
      if (!node) return err(`tar: ${path}: No existe`)
      content += `${path}\n`
    }
    const resolved = resolvePath(ctx, f)
    const parts = resolved.split('/').filter((p) => p.length > 0)
    const name = parts.pop()!
    const parent = getNode(ctx, '/' + parts.join('/'))
    if (!parent || parent.type !== 'dir') return err(`tar: ${f}: No existe`)
    parent.children = parent.children ?? {}
    parent.children[name] = { type: 'file', content, mode: 0o644, mtime: Date.now(), owner: ctx.env.USER }
    return ok('')
  }
  if (list || extract) {
    const resolved = resolvePath(ctx, f)
    const node = getNode(ctx, resolved)
    if (!node || node.type !== 'file') return err(`tar: ${f}: No se puede abrir`)
    const content = node.content ?? ''
    if (list) return ok(content)
    const entries = content.split('\n').filter((l) => l.length > 0 && l !== 'TAR ARCHIVE').length
    return ok(`Extraídas ${entries} entradas`)
  }
  return err('tar: debes especificar -c, -x o -t')
}

function df(_ctx: SimContext, args: string[]): SimResult {
  const human = args.includes('-h')
  if (human) {
    return ok(`S.Archivos     Tamaño Usados  Disp Uso% Montado en\n/dev/sda1        50G    12G   36G  25% /\ntmpfs            2G     0M    2G   0% /dev/shm`)
  }
  return ok(`S.Archivos       Bloques de 1K   Usados   Disponibles   Uso% Montado en\n/dev/sda1          52428800  12582912  39845888  25% /\ntmpfs              2097152         0   2097152   0% /dev/shm`)
}

function du(ctx: SimContext, args: string[]): SimResult {
  const human = args.includes('-h') || args.includes('-sh')
  const summary = args.includes('-s')
  const paths = args.filter((a) => !a.startsWith('-'))
  if (paths.length === 0) return ok(human ? '4,0K\t.' : '4096\t.')
  const lines: string[] = []
  for (const path of paths) {
    const node = getNode(ctx, path)
    if (!node) return err(`du: ${path}: No existe`)
    const size = node.type === 'file' ? (node.content?.length ?? 0) : 4096
    lines.push(human ? `4,0K\t${path}` : `${size}\t${path}`)
  }
  return ok(lines.join('\n'))
}

function free(_ctx: SimContext, args: string[]): SimResult {
  const human = args.includes('-h')
  if (human) {
    return ok(`              total      used      free    shared  buff/cache   available\nMem:          4,0Gi    1,0Gi    2,0Gi     256Mi     800Mi    2,8Gi\nSwap:           0B        0B        0B`)
  }
  return ok(`              total      used      free    shared  buff/cache   available\nMem:        4194304   1048576   2097152    262144     819200   2867200\nSwap:             0         0         0`)
}

function top(_ctx: SimContext): SimResult {
  return ok(`top - 12:34:56 up 5 days,  1 user,  load average: 0,10, 0,05, 0,01\nTareas: 98 total,   1 ejecutándose, 97 durmiendo\n%Cpu(s):  2,5 usuario,  1,0 sistema,  0,0 nice, 96,5 inactivo\nMiB Mem :   4096,0 total,   1024,2 usado,   2800,5 libre,    256,1 búfer/caché\n\n  PID USUARIO   PR  NI    VIRT    RES  SHR S  %CPU  %MEM     TIEMPO+ ORDEN\n 1234 polar     20   0  1024M   128M   16M S   0,5   3,1   0:01,23 bash\n 5678 polar     20   0   512M    64M    8M S   0,2   1,6   0:00,45 top\n    1 root      20   0   256M    16M    4M S   0,0   0,4   0:05,67 systemd\n  (presiona 'q' para salir)`)
}

interface ServiceState {
  active: 'active' | 'inactive' | 'failed'
  enabled: boolean
  description: string
}

const simulatedServices: Record<string, ServiceState> = {
  'nginx.service': { active: 'active', enabled: true, description: 'A high performance web server and reverse proxy server' },
  'ssh.service': { active: 'active', enabled: true, description: 'SSH per-connection server daemon' },
  'cron.service': { active: 'active', enabled: true, description: 'Regular background program processing daemon' },
  'fail2ban.service': { active: 'inactive', enabled: false, description: 'Ban IPs that make too many authentication failures' },
  'ufw.service': { active: 'inactive', enabled: false, description: 'Uncomplicated firewall' },
}

function systemctl(ctx: SimContext, args: string[]): SimResult {
  const action = args[0]
  if (!action || action === 'list-units') {
    const lines = ['UNIT                STATE   ACTIVE  DESCRIPTION']
    for (const [name, s] of Object.entries(simulatedServices)) {
      lines.push(`${name.padEnd(20)} loaded ${s.active.padEnd(8)} ${s.description.slice(0, 40)}`)
    }
    return ok(lines.join('\n'))
  }
  if (action === 'status') {
    const name = args[1] || 'nginx.service'
    const s = simulatedServices[name] ?? { active: 'inactive' as const, enabled: false, description: 'Servicio desconocido' }
    return ok(`● ${name} - ${s.description}\n     Loaded: loaded (/lib/systemd/system/${name}; ${s.enabled ? 'enabled' : 'disabled'})\n     Active: ${s.active} (${s.active === 'active' ? 'running' : 'dead'})\n\n[salida simulada — systemd real mostraría entradas recientes del log]`)
  }
  if (action === 'start' || action === 'stop' || action === 'restart') {
    const name = args[1]
    if (!name) return err(`systemctl: falta nombre del servicio`)
    if (!simulatedServices[name]) return err(`Failed to ${action} ${name}: Unit not found.`)
    simulatedServices[name].active = action === 'stop' ? 'inactive' : 'active'
    return ok('')
  }
  if (action === 'enable' || action === 'disable') {
    const name = args[1]
    if (!name) return err(`systemctl: falta nombre del servicio`)
    if (!simulatedServices[name]) return err(`Failed to ${action} ${name}: Unit not found.`)
    simulatedServices[name].enabled = action === 'enable'
    return ok(`Synchronizing state of ${name} with SysV service script.`)
  }
  return err(`systemctl: acción desconocida '${action}'`)
}

function journalctl(_ctx: SimContext, args: string[]): SimResult {
  const fIdx = args.findIndex((a) => a === '-f')
  const nIdx = args.findIndex((a) => a === '-n')
  const n = nIdx >= 0 ? parseInt(args[nIdx + 1], 10) : 10
  const samples = [
    `-- Logs begin at Mon 2026-06-15 00:00:00 UTC, end at Mon 2026-06-19 12:34:56 UTC. --`,
    `Jun 19 12:00:01 polar systemd[1]: Starting Daily apt download activities...`,
    `Jun 19 12:00:05 polar apt[2345]: Get:1 http://archive.ubuntu.com focal InRelease [265 kB]`,
    `Jun 19 12:01:12 polar nginx[1234]: 192.168.1.50 - - [19/Jun/2026:12:01:12 +0000] "GET / HTTP/1.1" 200 1234`,
    `Jun 19 12:02:30 polar sshd[2345]: Accepted publickey for polar from 192.168.1.50 port 54321`,
    `Jun 19 12:03:00 polar systemd[1]: nginx.service: Scheduled restart job.`,
    `Jun 19 12:03:01 polar systemd[1]: Stopped A high performance web server.`,
    `Jun 19 12:03:02 polar systemd[1]: Starting A high performance web server...`,
    `Jun 19 12:03:03 polar systemd[1]: Started A high performance web server.`,
    `Jun 19 12:04:00 polar CRON[3456]: (root) CMD (test -x /usr/sbin/anacron)`,
  ]
  const result = fIdx >= 0 ? samples.concat(['(modo follow — Ctrl+C para salir)']) : samples
  return ok(result.slice(-n).join('\n'))
}

function service(_ctx: SimContext, args: string[]): SimResult {
  const name = args[0]
  const action = args[1]
  if (!name || !action) return err('service: faltan operandos\nUso: service [nombre] [start|stop|restart|status]')
  return ok(` * ${action === 'status' ? 'estado de' : action + 'ando'} ${name}\n   ...hecho.`)
}

function adduser(ctx: SimContext, args: string[]): SimResult {
  if (args.length === 0) return err('adduser: falta el nombre de usuario')
  const username = args[0]
  if (!ctx.env.USERS) ctx.env.USERS = 'root,polar'
  if (ctx.env.USERS.split(',').includes(username)) return err(`adduser: el usuario '${username}' ya existe`)
  ctx.env.USERS = ctx.env.USERS + ',' + username
  return ok(`Agregando usuario '${username}'...\nCreando directorio home '/home/${username}'...\n[simulado — en un sistema real escribirías: passwd ${username}]`)
}

function ufw(_ctx: SimContext, args: string[]): SimResult {
  const action = args[0]
  if (!action || action === 'status') {
    return ok(`Estado: activo\n\nHasta                     Acción      Desde\n--                         ------      ----\n22/tcp                     ALLOW       Anywhere\n80/tcp                     ALLOW       Anywhere\n443/tcp                    ALLOW       Anywhere`)
  }
  if (action === 'allow' || action === 'deny') {
    const target = args[1]
    if (!target) return err(`ufw: falta puerto o servicio`)
    return ok(`Regla agregada\nRegla agregada (v6)`)
  }
  return err(`ufw: acción desconocida '${action}'`)
}

function apt(_ctx: SimContext, args: string[]): SimResult {
  const action = args[0]
  if (action === 'update') {
    return ok(`Obj:1 http://archive.ubuntu.com focal InRelease\nLeyendo lista de paquetes... Todos los paquetes están actualizados.`)
  }
  if (action === 'upgrade') {
    return ok(`Leyendo lista de paquetes...\n0 actualizados, 0 nuevos, 0 para eliminar.\n0 no actualizados.`)
  }
  if (action === 'install') {
    const pkg = args[1]
    if (!pkg) return err('apt install: falta nombre del paquete')
    return ok(`Leyendo lista de paquetes...\nSe instalarán los siguientes paquetes NUEVOS:\n  ${pkg}\n0 actualizados, 1 nuevos, 0 para eliminar.\nNecesito descargar 1.234 kB de archivos.\n[simulado — apt real descargaría e instalaría ${pkg}]`)
  }
  if (action === 'remove') {
    const pkg = args[1]
    if (!pkg) return err('apt remove: falta nombre del paquete')
    return ok(`Leyendo lista de paquetes...\nRemoviendo ${pkg}...\n[simulado]`)
  }
  return err(`apt: acción desconocida '${action}'`)
}

function ssh(_ctx: SimContext, args: string[]): SimResult {
  if (args.length === 0) return err('ssh: falta destino\nUso: ssh [usuario@]host')
  const target = args[0]
  if (!target.includes('@')) return err(`ssh: falta host (usa ssh usuario@host)`)
  return ok(`Conectando a ${target}...\n[simulado — en una terminal real abriría una sesión interactiva]\nWelcome to Ubuntu 22.04 LTS\n\nLast login: Mon Jun 19 12:00:00 2026`)
}

function scp(_ctx: SimContext, args: string[]): SimResult {
  if (args.length < 2) return err('scp: falta origen o destino')
  return ok(`index.html 100% 1234 1,2KB/s 00:00\n[simulado — en una terminal real copiaría archivos seguros]`)
}

function curl(_ctx: SimContext, args: string[]): SimResult {
  const url = args.find((a) => a.startsWith('http'))
  if (!url) return err('curl: falta URL')
  return ok(`<!DOCTYPE html>\n<html><body><h1>Polar School</h1></body></html>\n[respuesta simulada — curl real mostraría la respuesta del servidor]`)
}

function wget(_ctx: SimContext, args: string[]): SimResult {
  const url = args[0]
  if (!url) return err('wget: falta URL')
  return ok(`--2026-06-19 12:00:00--  ${url}\nResolviendo... hecho.\n[simulado]`)
}

function git(ctx: SimContext, args: string[]): SimResult {
  const sub = args[0]
  const g = ctx.git
  const hash = () => Math.random().toString(36).slice(2, 9)
  const isInit = () => g.commits.length > 0 || g.remote !== null

  if (sub === 'init') {
    g.branches = ['main']
    g.branch = 'main'
    g.remote = null
    g.commits = []
    g.staged = new Set()
    g.initialized = true
    return ok(`Inicializado repositorio Git vacío en ${ctx.cwd}/.git/`)
  }
  if (sub === 'status') {
    if (!g.initialized) return ok(`fatal: no es un repositorio git (ni ninguno de los directorios superiores): .git\nSugerencia: ejecuta 'git init' primero.`)
    const staged = Array.from(g.staged)
    const lines: string[] = []
    lines.push(`En la rama ${g.branch}`)
    if (!g.remote) {
      lines.push(`Tu rama está basada en '${g.branch}', pero no hay información de upstream.`)
      lines.push(`Sugerencia: ejecuta 'git push -u origin ${g.branch}' para publicar la rama.`)
    }
    lines.push(``)
    if (staged.length === 0) lines.push(`nada para hacer commit, el árbol de trabajo está limpio`)
    else {
      lines.push(`Cambios a confirmar:`)
      lines.push(`  nuevo archivo:   ${staged.join('\n  nuevo archivo:   ')}`)
    }
    if (g.commits.length > 0 && staged.length === 0) {
      lines.push(``)
      lines.push(`Tu rama está ${Math.floor(Math.random() * 3)} commits ahead de 'origin/${g.branch}'.`)
    }
    return ok(lines.join('\n'))
  }
  if (sub === 'add') {
    if (!g.initialized) return err(`fatal: no es un repositorio git`)
    const targets = args.slice(1)
    if (targets.length === 0) return err('git add: falta ruta de archivo')
    for (const t of targets) {
      if (t === '.' || t === '-A' || t === '--all') {
        g.staged = new Set(['.'])
      } else {
        g.staged.add(t)
      }
    }
    return ok('')
  }
  if (sub === 'commit') {
    if (!g.initialized) return err(`fatal: no es un repositorio git`)
    const mIdx = args.indexOf('-m')
    const msg = mIdx >= 0 && args[mIdx + 1] ? args[mIdx + 1] : null
    if (!msg) return err('git commit: usa -m "mensaje" para describir el cambio')
    if (g.staged.size === 0) return err('git commit: nada para confirmar (usa git add primero)')
    const h = hash()
    g.commits.push({ hash: h, msg, author: `${g.user} <${g.email}>` })
    g.staged = new Set()
    return ok(`[${g.branch} ${h}] ${msg}\n 1 archivo cambiado, ${Math.floor(Math.random() * 50) + 1} inserciones(+)\n Autor: ${g.user} <${g.email}>`)
  }
  if (sub === 'log') {
    if (!g.initialized) return err(`fatal: no es un repositorio git`)
    if (g.commits.length === 0) return ok('(vacío — no hay commits todavía)')
    const lines = g.commits.slice().reverse().map((c) => `commit ${c.hash} (HEAD -> ${g.branch})\nAuthor: ${c.author}\n\n    ${c.msg}`)
    return ok(lines.join('\n\n'))
  }
  if (sub === 'branch') {
    if (args.length === 1) {
      return ok(g.branches.map((b) => (b === g.branch ? `* ${b}` : `  ${b}`)).join('\n'))
    }
    const name = args[1]
    if (g.branches.includes(name)) return err(`fatal: ya existe una rama llamada '${name}'`)
    g.branches.push(name)
    return ok('')
  }
  if (sub === 'checkout') {
    const newBranch = args[1]
    if (args.includes('-b')) {
      const name = args[args.indexOf('-b') + 1]
      if (!name) return err('git checkout -b: falta nombre de rama')
      if (g.branches.includes(name)) return err(`fatal: ya existe una rama llamada '${name}'`)
      g.branches.push(name)
      g.branch = name
      return ok(`Cambiaste a una nueva rama '${name}'`)
    }
    if (!newBranch) return err('git checkout: falta nombre de rama o commit')
    if (!g.branches.includes(newBranch)) return err(`error: pathspec '${newBranch}' no coincide con ningún archivo conocido por git`)
    g.branch = newBranch
    return ok(`Cambiaste a la rama '${newBranch}'`)
  }
  if (sub === 'merge') {
    const target = args[1]
    if (!target) return err('git merge: falta nombre de rama')
    if (!g.branches.includes(target)) return err(`fatal: '${target}' — no es algo que se pueda fusionar`)
    if (target === g.branch) return err('git merge: ya estás en esa rama')
    return ok(`Merge made by the 'ort' strategy.\n[simulado — fusionaría los commits de ${target} en ${g.branch}]`)
  }
  if (sub === 'remote') {
    if (args[1] === 'add') {
      const name = args[2]
      const url = args[3]
      if (!name || !url) return err('git remote add: falta nombre o URL')
      g.remote = url
      return ok('')
    }
    if (args[1] === '-v' || !args[1]) {
      if (!g.remote) return ok('')
      return ok(`origin\t${g.remote} (fetch)\norigin\t${g.remote} (push)`)
    }
    return ok(`git remote ${args.slice(1).join(' ')}: simulado`)
  }
  if (sub === 'push') {
    if (!g.remote) return err(`fatal: no hay un 'origin' configurado. Usa 'git remote add origin URL' primero.`)
    const ahead = g.staged.size === 0 && g.commits.length
    return ok(`Objeto ${ahead ? 'commits' : 'cambios'}: ${g.commits.length || 1}, hecho.\nDelta compression using up to 4 threads.\nTotal ${g.commits.length || 1} (delta 0), reused 0 (delta 0), pack-reused 0\nTo ${g.remote}\n   abc1234..${hash()}  ${g.branch} -> ${g.branch}`)
  }
  if (sub === 'pull') {
    if (!g.remote) return err(`fatal: no hay 'origin' configurado`)
    return ok(`Ya está actualizado.`)
  }
  if (sub === 'clone') {
    const url = args[1]
    if (!url) return err('git clone: falta URL')
    const name = url.split('/').pop()?.replace('.git', '') ?? 'repo'
    return ok(`Clonando en '${name}'...\nremote: Enumerando objetos: 42, hecho.\nRecibiendo objetos: 100% (42/42), hecho.\n[simulado]`)
  }
  if (sub === 'diff') {
    return ok(g.staged.size > 0
      ? `diff --git a/${Array.from(g.staged)[0]} b/${Array.from(g.staged)[0]}\n+ cambios sin confirmar [simulado]`
      : `(sin cambios — usa 'git add archivo' para empezar a trackear)`)
  }
  return ok(`git ${sub}: simulado — en un repo real ejecutaría: ${args.join(' ')}`)
}

function nano(_ctx: SimContext, args: string[]): SimResult {
  const file = args[0] ?? 'nuevo-archivo'
  return ok(`GNU nano 6.2 — ${file}\n\n  [ 0 líneas leídas ]\n^G Ayuda  ^O Guarda  ^W Busca  ^K Cortar  ^J Justificar\n^X Sal   ^R Leer     ^U Pega\n\n[editor simulado — nano real abriría interactivamente]`)
}

function docker(_ctx: SimContext, args: string[]): SimResult {
  const action = args[0]
  if (!action) return err('docker: falta comando\nUso: docker [run|ps|images|pull|stop|start|rm|rmi|logs|exec|build]')
  // Positional args = no-flags, no-puertos con :, no-key=val
  const positional = args.filter((a, i) => i > 0 && !a.startsWith('-') && !a.includes(':') && !a.includes('='))
  const last = positional[positional.length - 1]
  if (action === 'run') {
    const image = last ?? 'hello-world'
    const portFlag = args.find((a) => a.startsWith('-p'))
    const detached = args.includes('-d')
    const port = portFlag ? portFlag.replace(/^-p\s*/, '') : ''
    return ok(`Unable to find image '${image}:latest' locally\nlatest: Pulling from library/${image}\n[simulado — docker real descargaría ${image}${port ? ` y publicaría en ${port}` : ''}${detached ? ' en segundo plano' : ''}]\n\n${image === 'hello-world' ? 'Hello from Docker!\nThis message shows that your installation appears to be working correctly.' : `Container basado en ${image} simulado. En docker real verías el log del proceso principal.`}`)
  }
  if (action === 'ps') {
    return ok(`CONTAINER ID   IMAGE          COMMAND   CREATED       STATUS       PORTS     NAMES\na1b2c3d4e5f6   nginx:latest   "nginx"   2 hours ago   Up 2 hours   80/tcp    web\n[simulado]`)
  }
  if (action === 'images') {
    return ok(`REPOSITORY   TAG       IMAGE ID       CREATED       SIZE\nnginx        latest    a1b2c3d4e5f6   2 hours ago   187MB\nhello-world  latest    b7c5d4e3f2a1   3 months ago  13,3kB\n[simulado]`)
  }
  if (action === 'pull') {
    const image = last ?? 'nginx'
    return ok(`Using default tag: latest\nlatest: Pulling from library/${image}\nStatus: Downloaded newer image for ${image}:latest\n[simulado]`)
  }
  if (action === 'compose') {
    const sub = args[1]
    const detached = args.includes('-d')
    if (sub === 'up' || sub === 'down') {
      return ok(`[+] ${sub === 'up' ? 'Running' : 'Going'} 2/2\n ✔ Network web_default   ${sub === 'up' ? 'Created' : 'Removed'}\n ✔ Container web-nginx   ${sub === 'up' ? 'Started' : 'Removed'}\n[simulado — docker compose real orquestó los servicios del docker-compose.yml${detached ? ' (detached)' : ''}]`)
    }
    return ok(`docker compose ${sub ?? ''}: simulado`)
  }
  if (['stop', 'start', 'restart', 'rm', 'rmi', 'logs'].includes(action)) {
    const target = last ?? 'nginx'
    return ok(`${target}\n[simulado — docker real haría '${action}' sobre ${target}]`)
  }
  if (action === 'exec') {
    const container = positional[0] ?? 'nginx'
    return ok(`${container}\n[simulado — docker real haría 'exec' dentro de ${container}]`)
  }
  if (action === 'build') {
    const path = last ?? '.'
    return ok(`Sending build context to Docker daemon: ${path}\n[simulado — docker real compilaría la imagen desde ${path}]`)
  }
  return err(`docker: comando desconocido '${action}'`)
}

function nginx(_ctx: SimContext, args: string[]): SimResult {
  if (args.includes('-v') || args.includes('-V')) {
    return ok(`nginx version: nginx/1.24.0 (Ubuntu)`)
  }
  if (args[0] === '-s' && args[1] === 'reload') return ok('nginx: recargado')
  if (args[0] === '-s' && args[1] === 'stop') return ok('nginx: detenido')
  if (args[0] === '-t') return ok('nginx: la configuración es correcta')
  return ok('[simulado — nginx real arrancaría el servidor en foreground]')
}

// ===== F2: Git, redes, permisos, cron, bases de datos =====

function chown(ctx: SimContext, args: string[]): SimResult {
  const recursive = args.includes('-R')
  const filtered = args.filter((a) => a !== '-R')
  if (filtered.length < 2) return err('chown: propietario y archivo requeridos\nUso: chown [-R] usuario[:grupo] archivo')
  const [owner, path] = filtered
  const user = owner.split(':')[0]
  const node = getNode(ctx, path)
  if (!node) return err(`chown: no se puede acceder a '${path}'`)
  node.owner = user
  node.mtime = Date.now()
  if (recursive && node.type === 'dir' && node.children) {
    for (const child of Object.values(node.children)) {
      child.owner = user
    }
  }
  return ok('')
}

function ss(_ctx: SimContext, args: string[]): SimResult {
  if (args.includes('-tulpn') || args.includes('-tlnp') || args.includes('-tuln')) {
    return ok(`State     Recv-Q  Send-Q   Local Address:Port     Peer Address:Port   Process\nLISTEN    0       128            0.0.0.0:22            0.0.0.0:*       users:(("sshd",pid=387,fd=3))\nLISTEN    0       511            0.0.0.0:80            0.0.0.0:*       users:(("nginx",pid=612,fd=6))\nLISTEN    0       4096           127.0.0.1:5432        0.0.0.0:*       users:(("postgres",pid=890,fd=4))\nLISTEN    0       80             127.0.0.1:3306        0.0.0.0:*       users:(("mysqld",pid=901,fd=5))\nLISTEN    0       128            [::]:22                 [::]:*          users:(("sshd",pid=387,fd=4))\nLISTEN    0       511            [::]:443                [::]:*          users:(("nginx",pid=612,fd=7))`)
  }
  return ok('Uso típico: ss -tulpn (TCP+UDP escuchando, con procesos)')
}

function netstat(_ctx: SimContext, args: string[]): SimResult {
  if (args.includes('-tulpn') || args.includes('-tln')) {
    return ok(`Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\ntcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      387/sshd\ntcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      612/nginx\ntcp        0      0 127.0.0.1:5432          0.0.0.0:*               LISTEN      890/postgres\ntcp6       0      0 :::443                   :::*                    LISTEN      612/nginx`)
  }
  return ok('Uso típico: netstat -tulpn (puertos abiertos)')
}

function ping(_ctx: SimContext, args: string[]): SimResult {
  const host = args.filter((a) => !a.startsWith('-'))[0]
  if (!host) return err('ping: falta host\nUso: ping [-c N] host')
  const count = (() => {
    const i = args.indexOf('-c')
    return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : 4
  })()
  const lines = [`PING ${host} (93.184.216.34) 56(84) bytes of data.`]
  for (let i = 0; i < Math.min(count, 5); i++) {
    lines.push(`64 bytes from ${host}: icmp_seq=${i + 1} ttl=56 time=${(Math.random() * 50 + 10).toFixed(1)} ms`)
  }
  lines.push(``, `--- ${host} ping statistics ---`, `${count} packets transmitted, ${count} received, 0% packet loss`)
  return ok(lines.join('\n'))
}

function crontab(_ctx: SimContext, args: string[]): SimResult {
  if (args.includes('-l')) {
    return ok(`# m h dom mon dow command\n0 3 * * * /usr/local/bin/backup.sh\n*/15 * * * * /usr/bin/php /var/www/cron.php\n@reboot systemctl restart nginx.service`)
  }
  if (args.includes('-e')) {
    return ok(`crontab: installing new crontab\n[simulado — en una sesión real abriría el editor (vi/nano) para editar las tareas programadas]`)
  }
  if (args.includes('-r')) {
    return ok(`crontab: crontab de ${_ctx.env.USER} borrado [simulado]`)
  }
  return ok('Uso: crontab [-e editar | -l listar | -r borrar]\nFormato: m h dom mon dow comando')
}

function useradd(_ctx: SimContext, args: string[]): SimResult {
  const filtered = args.filter((a) => !a.startsWith('-'))
  const user = filtered[0]
  if (!user) return err('useradd: falta nombre de usuario')
  return ok(`[simulado] Usuario '${user}' creado. En useradd real, agregalo con -m para crear el home directory.`)
}

function groupadd(_ctx: SimContext, args: string[]): SimResult {
  const filtered = args.filter((a) => !a.startsWith('-'))
  const group = filtered[0]
  if (!group) return err('groupadd: falta nombre de grupo')
  return ok(`[simulado] Grupo '${group}' creado.`)
}

function groups(_ctx: SimContext, args: string[]): SimResult {
  const user = args[0] ?? _ctx.env.USER
  if (user === 'root') return ok('root : root')
  if (user === 'polar') return ok('polar : polar sudo www-data docker')
  return ok(`${user} : ${user}`)
}

function which(_ctx: SimContext, args: string[]): SimResult {
  const cmd = args[0]
  if (!cmd) return err('which: falta comando')
  const known = ['ls', 'cat', 'cd', 'pwd', 'mkdir', 'touch', 'rm', 'cp', 'mv', 'echo', 'grep', 'find', 'chmod', 'ps', 'kill', 'man', 'systemctl', 'journalctl', 'service', 'adduser', 'ufw', 'apt', 'ssh', 'scp', 'curl', 'wget', 'git', 'nano', 'docker', 'nginx', 'postgres', 'psql', 'mysql', 'sqlite3', 'node', 'python3', 'tar', 'df', 'du', 'free', 'top', 'crontab', 'ping']
  return known.includes(cmd) ? ok(`/usr/bin/${cmd}`) : err(`which: no ${cmd} en (${_ctx.env.PATH})`)
}

function envCmd(_ctx: SimContext, args: string[]): SimResult {
  if (args.length === 0) return ok(Object.entries(_ctx.env).map(([k, v]) => `${k}=${v}`).join('\n'))
  return ok(`[simulado — 'env ${args.join(' ')}' ejecutaría el comando con esas variables]`)
}

function historyCmd(_ctx: SimContext, args: string[]): SimResult {
  if (_ctx.history.length === 0) return ok('')
  const lines = _ctx.history.slice(-20).map((cmd, i) => `  ${(_ctx.history.length - 20 + i + 1).toString().padStart(4)}  ${cmd}`)
  return ok(lines.join('\n'))
}

function exportCmd(ctx: SimContext, args: string[]): SimResult {
  for (const a of args) {
    const [k, v] = a.split('=')
    if (k && v !== undefined) ctx.env[k] = v
  }
  return ok('')
}

// ===== Bases de datos SQL =====

function sqlSelect(rows: TableRow[], query: string): SimResult {
  const trimmed = query.trim().replace(/;$/, '').replace(/\s+/g, ' ')
  const fromMatch = trimmed.match(/FROM\s+(\w+)/i)
  if (!fromMatch) return err('ERROR: se requiere FROM <tabla>')
  const table = fromMatch[1].toLowerCase()
  let result = rows
  const whereMatch = trimmed.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/i)
  if (whereMatch) {
    const cond = whereMatch[1].trim()
    const m = cond.match(/(\w+)\s*=\s*['"]?([^'"]+)['"]?/i)
    if (m) {
      const [, col, val] = m
      result = result.filter((r) => String(r[col]) === val)
    } else {
      const m2 = cond.match(/(\w+)\s*>\s*(\d+)/)
      if (m2) {
        const [, col, val] = m2
        result = result.filter((r) => Number(r[col]) > Number(val))
      }
    }
  }
  if (result.length === 0) return ok('(0 filas)')
  const cols = Object.keys(result[0])
  const header = cols.join(' | ')
  const sep = cols.map(() => '---').join('-+-')
  const body = result.map((r) => cols.map((c) => r[c] ?? 'NULL').join(' | ')).join('\n')
  return ok([header, sep, body].join('\n'))
}

function sqlInsert(rows: TableRow[], query: string): SimResult {
  const m = query.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i)
  if (!m) return err('ERROR: sintaxis INSERT incorrecta\nUso: INSERT INTO tabla (col1, col2) VALUES (val1, val2)')
  const [, table, colsStr, valsStr] = m
  const cols = colsStr.split(',').map((c) => c.trim())
  const vals = valsStr.split(',').map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
  if (cols.length !== vals.length) return err('ERROR: número de columnas no coincide con valores')
  const row: TableRow = {}
  cols.forEach((c, i) => {
    const n = Number(vals[i])
    row[c] = isNaN(n) ? vals[i] : n
  })
  rows.push(row)
  return ok(`INSERT 0 1`)
}

function sqlCreate(query: string): string | null {
  const m = query.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i)
  return m ? m[1].toLowerCase() : null
}

function postgres(ctx: SimContext, args: string[]): SimResult {
  if (args.includes('--version') || args.includes('-V')) return ok('postgres (PostgreSQL) 16.3')
  return ok('Uso: psql -d <base> [comandos SQL]\nConectá a Postgres con: psql -U polar -d mibase')
}

function psql(ctx: SimContext, args: string[]): SimResult {
  // Captura query inline con -c
  const cIdx = args.indexOf('-c')
  if (cIdx === -1) {
    return ok(`psql (16.3)\nConectado a: postgresql://polar@localhost:5432/mibase\nEscribe 'help' para ayuda.\n\nmibase=# `)
  }
  const query = args.slice(cIdx + 1).join(' ')
  const rows = ctx.db.postgres
  if (/^CREATE\s+TABLE/i.test(query)) {
    const t = sqlCreate(query)
    if (!t) return err('ERROR: CREATE TABLE mal formado')
    if (!rows.has(t)) rows.set(t, [])
    return ok('CREATE TABLE')
  }
  if (/^INSERT\s+INTO/i.test(query)) {
    const m = query.match(/INSERT\s+INTO\s+(\w+)/i)
    if (!m) return err('ERROR: INSERT mal formado')
    const t = m[1].toLowerCase()
    if (!rows.has(t)) return err(`ERROR: relación "${t}" no existe`)
    return sqlInsert(rows.get(t)!, query)
  }
  if (/^SELECT/i.test(query)) {
    const m = query.match(/FROM\s+(\w+)/i)
    if (!m) return err('ERROR: SELECT mal formado')
    const t = m[1].toLowerCase()
    if (!rows.has(t)) return err(`ERROR: relación "${t}" no existe`)
    return sqlSelect(rows.get(t)!, query)
  }
  if (/^DROP\s+TABLE/i.test(query)) {
    const m = query.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i)
    if (!m) return err('ERROR: DROP mal formado')
    rows.delete(m[1].toLowerCase())
    return ok('DROP TABLE')
  }
  return ok(`psql: query no reconocida en simulador: ${query.slice(0, 40)}...`)
}

function mysql(ctx: SimContext, args: string[]): SimResult {
  const eIdx = args.indexOf('-e')
  if (eIdx === -1) {
    return ok(`mysql  Ver 8.0.36 for Linux on x86_64\nConectado a: mysqldb@localhost:3306  (server 8.0.36)\nEscribe 'help;' para ayuda.\n\nmysql> `)
  }
  const query = args.slice(eIdx + 1).join(' ')
  const rows = ctx.db.mysql
  if (/^CREATE\s+TABLE/i.test(query)) {
    const t = sqlCreate(query)
    if (!t) return err('ERROR: CREATE TABLE mal formado')
    if (!rows.has(t)) rows.set(t, [])
    return ok('Query OK, 0 rows affected')
  }
  if (/^INSERT\s+INTO/i.test(query)) {
    const m = query.match(/INSERT\s+INTO\s+(\w+)/i)
    if (!m) return err('ERROR: INSERT mal formado')
    const t = m[1].toLowerCase()
    if (!rows.has(t)) return err(`ERROR: Table '${m[1]}' doesn't exist`)
    return sqlInsert(rows.get(t)!, query)
  }
  if (/^SELECT/i.test(query)) {
    const m = query.match(/FROM\s+(\w+)/i)
    if (!m) return err('ERROR: SELECT mal formado')
    const t = m[1].toLowerCase()
    if (!rows.has(t)) return err(`ERROR: Table '${m[1]}' doesn't exist`)
    return sqlSelect(rows.get(t)!, query)
  }
  if (/^DROP\s+TABLE/i.test(query)) {
    const m = query.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i)
    if (!m) return err('ERROR: DROP mal formado')
    rows.delete(m[1].toLowerCase())
    return ok('Query OK, 0 rows affected')
  }
  return ok(`mysql: query no reconocida en simulador: ${query.slice(0, 40)}...`)
}

function sqlite3(ctx: SimContext, args: string[]): SimResult {
  const query = args.slice(1).join(' ')
  const rows = ctx.db.sqlite
  if (!query) {
    return ok(`SQLite version 3.45.0\nConnected to :memory:\nEscribe '.help' para ayuda.\n\nsqlite> `)
  }
  if (/^CREATE\s+TABLE/i.test(query)) {
    const t = sqlCreate(query)
    if (!t) return err('Error: near "TABLE": syntax error')
    if (!rows.has(t)) rows.set(t, [])
    return ok('')
  }
  if (/^INSERT\s+INTO/i.test(query)) {
    const m = query.match(/INSERT\s+INTO\s+(\w+)/i)
    if (!m) return err('Error: INSERT mal formado')
    const t = m[1].toLowerCase()
    if (!rows.has(t)) return err(`Error: no such table: ${m[1]}`)
    return sqlInsert(rows.get(t)!, query)
  }
  if (/^SELECT/i.test(query)) {
    const m = query.match(/FROM\s+(\w+)/i)
    if (!m) return err('Error: SELECT mal formado')
    const t = m[1].toLowerCase()
    if (!rows.has(t)) return err(`Error: no such table: ${m[1]}`)
    return sqlSelect(rows.get(t)!, query)
  }
  return ok(`sqlite3: query no reconocida en simulador: ${query.slice(0, 40)}...`)
}

function ok(stdout: string): SimResult {
  return { stdout, stderr: '', exitCode: 0, durationMs: 0 }
}
function err(stderr: string): SimResult {
  return { stdout: '', stderr, exitCode: 1, durationMs: 0 }
}

export function createSimulator() {
  const ctx = createInitialContext()
  return {
    run(input: string): SimResult {
      const start = performance.now()
      const trimmed = input.trim()
      if (!trimmed) return ok('')
      ctx.history.push(trimmed)
      const [cmd, ...args] = trimmed.split(/\s+/)
      const handlers: Record<string, (a: string[]) => SimResult> = {
        ls: (a) => ls(ctx, a),
        cd: (a) => { cd(ctx, a); return ok('') },
        pwd: () => pwd(ctx),
        cat: (a) => cat(ctx, a),
        mkdir: (a) => mkdir(ctx, a),
        touch: (a) => touch(ctx, a),
        rm: (a) => rm(ctx, a),
        cp: (a) => cp(ctx, a),
        mv: (a) => mv(ctx, a),
        echo: (a) => echo(ctx, a),
        grep: (a) => grep(ctx, a),
        find: (a) => findCmd(ctx, a),
        chmod: (a) => chmod(ctx, a),
        ps: (a) => ps(ctx, a ?? []),
        kill: (a) => kill(ctx, a),
        man: (a) => man(ctx, a),
        tail: (a) => tail(ctx, a),
        head: (a) => head(ctx, a),
        wc: (a) => wc(ctx, a),
        sort: (a) => sort(ctx, a),
        uniq: (a) => uniq(ctx, a),
        tar: (a) => tar(ctx, a),
        df: (a) => df(ctx, a),
        du: (a) => du(ctx, a),
        free: (a) => free(ctx, a),
        top: () => top(ctx),
        systemctl: (a) => systemctl(ctx, a),
        journalctl: (a) => journalctl(ctx, a),
        service: (a) => service(ctx, a),
        adduser: (a) => adduser(ctx, a),
        ufw: (a) => ufw(ctx, a),
        apt: (a) => apt(ctx, a),
        ssh: (a) => ssh(ctx, a),
        scp: (a) => scp(ctx, a),
        curl: (a) => curl(ctx, a),
        wget: (a) => wget(ctx, a),
        git: (a) => git(ctx, a),
        nano: (a) => nano(ctx, a),
        chown: (a) => chown(ctx, a),
        ss: (a) => ss(ctx, a),
        netstat: (a) => netstat(ctx, a),
        ping: (a) => ping(ctx, a),
        crontab: (a) => crontab(ctx, a),
        useradd: (a) => useradd(ctx, a),
        groupadd: (a) => groupadd(ctx, a),
        groups: (a) => groups(ctx, a),
        which: (a) => which(ctx, a),
        env: (a) => envCmd(ctx, a),
        history: (a) => historyCmd(ctx, a),
        export: (a) => exportCmd(ctx, a),
        postgres: (a) => postgres(ctx, a),
        psql: (a) => psql(ctx, a),
        mysql: (a) => mysql(ctx, a),
        sqlite3: (a) => sqlite3(ctx, a),
        docker: (a) => docker(ctx, a),
        nginx: (a) => nginx(ctx, a),
        whoami: () => ok(ctx.env.USER),
        date: () => ok(new Date().toString()),
        clear: () => ok('\x1b[CLEAR\x1b'),
        help: () =>
          ok(
            'Comandos: ls, cd, pwd, cat, mkdir, touch, rm, cp, mv, echo, grep, find, chmod, chown, ps, kill, man, tail, head, wc, sort, uniq, tar, df, du, free, top, systemctl, journalctl, service, adduser, useradd, groupadd, groups, ufw, apt, ssh, scp, curl, wget, ping, ss, netstat, crontab, which, env, export, history, git, nano, docker, nginx, postgres, psql, mysql, sqlite3, whoami, date, clear'
          ),
      }
      const handler = handlers[cmd]
      if (!handler) {
        return {
          stdout: '',
          stderr: `${cmd}: comando no encontrado. Prueba 'help'.`,
          exitCode: 127,
          durationMs: performance.now() - start,
        }
      }
      const result = handler(args)
      result.durationMs = performance.now() - start
      return result
    },
    cwd: () => ctx.cwd,
    history: () => [...ctx.history],
    reset: () => {
      const fresh = createInitialContext()
      ctx.cwd = fresh.cwd
      ctx.fs = fresh.fs
      ctx.env = fresh.env
      ctx.history = []
    },
  }
}

export type Simulator = ReturnType<typeof createSimulator>
