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
}

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
  if (args.length < 2) return err('chmod: modo y archivo requeridos')
  const modeStr = args[0]
  const path = args[1]
  const mode = parseInt(modeStr, 8)
  if (isNaN(mode)) return err(`chmod: modo inválido: '${modeStr}'`)
  const node = getNode(ctx, path)
  if (!node) return err(`chmod: no se puede acceder a '${path}'`)
  node.mode = mode
  node.mtime = Date.now()
  return ok('')
}

function ps(_ctx: SimContext): SimResult {
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
  return ok('')
}

function man(_ctx: SimContext, args: string[]): SimResult {
  if (args.length === 0) return err('¿Qué página de manual quieres?')
  const cmd = args[0]
  return ok(
    `${cmd.toUpperCase()}(1)                 Manual del usuario                 ${cmd.toUpperCase()}(1)\n\nNOMBRE\n       ${cmd} - comando simulado del simulador Polar School\n\nDESCRIPCIÓN\n       Esta es una versión simulada. Para ver el manual real, abre una terminal\n       Linux real y escribe 'man ${cmd}'.\n`
  )
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
        ps: () => ps(ctx),
        kill: (a) => kill(ctx, a),
        man: (a) => man(ctx, a),
        whoami: () => ok(ctx.env.USER),
        date: () => ok(new Date().toString()),
        clear: () => ok('\x1b[CLEAR\x1b'),
        help: () =>
          ok(
            'Comandos disponibles: ls, cd, pwd, cat, mkdir, touch, rm, cp, mv, echo, grep, find, chmod, ps, kill, man, whoami, date, clear'
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
