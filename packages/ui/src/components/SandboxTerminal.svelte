<script lang="ts">
  /**
   * SandboxTerminal — terminal REAL conectado al sandbox del backend.
   *
   * Flujo:
   *   1. mount() → fetch POST /sandbox/start (con cookie de sesión Lucia)
   *   2. con sessionToken, abre WebSocket a /sandbox/ws?token=...
   *   3. escribe output crudo a xterm.js
   *   4. input del usuario → ws.send() con bytes crudos
   *   5. ResizeObserver → {type:"resize",cols,rows} por WS
   *   6. Ctrl+C → {type:"signal","signal":"SIGINT"}
   *
   * Decisiones:
   *   - Importaciones dinámicas dentro de onMount para evitar SSR de xterm
   *     (xterm es UMD con `self`, sólo funciona en browser)
   *   - El componente es self-contained: maneja su propio ciclo de vida
   *   - Usa `client:only="svelte"` en Astro
   *   - Si el backend no está disponible, muestra fallback al TryIt (simulador)
   *
   * Compatibilidad: Svelte 5 (runes).
   */
  import { onMount, onDestroy } from 'svelte'

  // Tipos para xterm.js cargados dinámicamente
  type XTermTerminal = {
    writeln: (s: string) => void
    write: (data: string | Uint8Array) => void
    onData: (cb: (data: string) => void) => { dispose: () => void }
    loadAddon: (addon: unknown) => void
    open: (parent: HTMLElement) => void
    dispose: () => void
  }
  type XTermFitAddon = {
    fit: () => void
  }

  interface Props {
    /** Mensaje de bienvenida que se muestra al iniciar. */
    welcomeMessage?: string
    /** Altura del terminal. Default 420px. */
    height?: string
    /** Si true, intenta usar API en otro origen. Si no, mismo origen. */
    apiBase?: string
    /** Callback cuando el terminal está listo para usarse. */
    onReady?: () => void
    /** Callback si hay error fatal (sin red, sin sesión, etc). */
    onFallback?: () => void
  }

  let {
    welcomeMessage = '🐻 Polar School Sandbox — terminal real',
    height = '420px',
    apiBase,
    onReady,
    onFallback,
  }: Props = $props()

  let containerEl: HTMLDivElement | undefined = $state()
  let status = $state<'connecting' | 'ready' | 'reconnecting' | 'error' | 'fallback'>('connecting')
  let statusMessage = $state('Conectando al sandbox…')
  let term: XTermTerminal | null = null
  let fitAddon: XTermFitAddon | null = null
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let destroyed = false
  let resizeObserver: ResizeObserver | null = null

  function deriveApiBase(): string {
    if (apiBase) return apiBase.replace(/\/$/, '')
    if (typeof window === 'undefined') return ''
    // Mismo origen: window.location.origin (ej: http://127.0.0.1:3000)
    return window.location.origin
  }

  /**
   * Resuelve la URL del API. Prioridad:
   *   1. prop `apiBase` (explícita)
   *   2. window.__POLAR_API_URL__ (seteada por BaseLayout.astro desde PUBLIC_API_URL)
   *   3. window.location.origin (mismo origen — útil en prod)
   *   4. fallback dev: http://127.0.0.1:3001
   */
  function resolveApiBase(): string {
    if (apiBase) return apiBase.replace(/\/$/, '')
    if (typeof window === 'undefined') return 'http://127.0.0.1:3001'
    const envBase = (window as { __POLAR_API_URL__?: string }).__POLAR_API_URL__
    if (envBase) return envBase.replace(/\/$/, '')
    return window.location.origin
  }

  function apiToWsUrl(httpBase: string, path: string): string {
    const u = new URL(httpBase)
    const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProto}//${u.host}${path}`
  }

  async function postStart(): Promise<{
    ok: boolean
    sessionToken: string
    wsPath: string
    reused: boolean
  }> {
    const base = resolveApiBase()
    const res = await fetch(`${base}/sandbox/start`, {
      method: 'POST',
      credentials: 'include',
    })
    if (res.status === 401) throw new Error('NO_SESSION')
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}))
      throw new Error(`TOO_MANY: ${body.error ?? 'límite alcanzado'}`)
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(`START_FAILED: ${body.error ?? res.statusText}`)
    }
    return res.json()
  }

  function connectWs(sessionToken: string, wsPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const httpBase = resolveApiBase()
      const url = `${apiToWsUrl(httpBase, wsPath)}?token=${encodeURIComponent(sessionToken)}`
      const sock = new WebSocket(url)
      sock.binaryType = 'arraybuffer'
      ws = sock

      let resolved = false

      sock.onopen = () => {
        // Esperamos al {type:"ready"} del handshake
      }

      sock.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          try {
            const msg = JSON.parse(ev.data)
            if (msg.type === 'ready') {
              if (!resolved) {
                resolved = true
                status = 'ready'
                statusMessage = 'Listo'
                resolve()
                onReady?.()
              }
              return
            }
            if (msg.type === 'error') {
              status = 'error'
              statusMessage = msg.message ?? 'Error desconocido'
              return
            }
            if (msg.type === 'exit') {
              status = 'reconnecting'
              statusMessage = `Conexión cerrada (${msg.reason ?? msg.code}). Reconectando…`
              return
            }
          } catch {
            // No era JSON → texto crudo
          }
          term?.write(ev.data)
        } else {
          const buf = ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data) : new Uint8Array(ev.data as Blob)
          term?.write(buf)
        }
      }

      sock.onerror = () => {
        if (!resolved) {
          resolved = true
          reject(new Error('WS_ERROR'))
        }
      }

      sock.onclose = (ev) => {
        if (!resolved) {
          resolved = true
          reject(new Error(`WS_CLOSED:${ev.code}`))
        }
        if (!destroyed && status !== 'error') {
          status = 'reconnecting'
          statusMessage = `Desconectado (${ev.code}). Reconectando en 2s…`
          scheduleReconnect()
        }
      }
    })
  }

  function scheduleReconnect() {
    if (reconnectTimer || destroyed) return
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null
      if (destroyed) return
      try {
        statusMessage = 'Reconectando…'
        const start = await postStart()
        await connectWs(start.sessionToken, start.wsPath)
        status = 'ready'
        statusMessage = 'Reconectado'
      } catch {
        scheduleReconnect()
      }
    }, 2000)
  }

  async function setupTerminal() {
    if (!containerEl) return

    // Import dinámico: xterm.js usa `self` y rompe en SSR
    const [{ Terminal }, { FitAddon }, xtermCss] = await Promise.all([
      import('xterm'),
      import('@xterm/addon-fit'),
      import('xterm/css/xterm.css'),
    ])
    // xtermCss es side-effect import (CSS); TypeScript necesita la referencia
    void xtermCss

    term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "DejaVu Sans Mono", Consolas, monospace',
      theme: {
        background: '#0b1020',
        foreground: '#e2e8f0',
        cursor: '#22d3ee',
        selectionBackground: '#334155',
        black: '#0b1020',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e2e8f0',
      },
      allowProposedApi: true,
      scrollback: 5000,
      convertEol: true,
    })

    fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerEl)

    // Banner inicial (códigos ANSI para colores)
    term.writeln(`\x1b[1;36m${welcomeMessage}\x1b[0m`)
    term.writeln('\x1b[90mConectando a un contenedor Linux real (Alpine 3.20)…\x1b[0m')
    term.writeln('')

    // Input del usuario → WS
    term.onData((data: string) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return

      if (data === '\x03') {
        ws.send(JSON.stringify({ type: 'signal', signal: 'SIGINT' }))
        return
      }

      ws.send(data)
    })

    // ResizeObserver → fit
    resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon?.fit()
      } catch {
        /* ignore */
      }
    })
    resizeObserver.observe(containerEl)

    requestAnimationFrame(() => {
      try {
        fitAddon?.fit()
      } catch {
        /* ignore */
      }
    })
  }

  async function bootstrap() {
    if (!containerEl) return
    try {
      await setupTerminal()
      const start = await postStart()
      await connectWs(start.sessionToken, start.wsPath)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[sandbox] bootstrap falló:', msg)

      if (msg === 'NO_SESSION') {
        status = 'fallback'
        statusMessage = 'Necesitás iniciar sesión para usar el sandbox real'
        term?.writeln('\x1b[33m⚠ No hay sesión activa. Iniciá sesión arriba a la derecha.\x1b[0m')
        onFallback?.()
        return
      }

      status = 'error'
      statusMessage = `Error: ${msg}`
      term?.writeln(`\x1b[31m✗ No pude conectar al sandbox: ${msg}\x1b[0m`)
      term?.writeln('\x1b[90m  Verificá que el backend esté corriendo y tengas sesión.\x1b[0m')
      onFallback?.()
    }
  }

  onMount(() => {
    bootstrap()
  })

  onDestroy(() => {
    destroyed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (resizeObserver) resizeObserver.disconnect()
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'component-unmounted')
    }
    if (term) {
      try {
        term.dispose()
      } catch {
        /* ignore */
      }
    }
  })

  const statusColor = $derived(
    status === 'ready'
      ? '#22c55e'
      : status === 'connecting' || status === 'reconnecting'
        ? '#eab308'
        : status === 'fallback'
          ? '#f59e0b'
          : '#ef4444',
  )
</script>

<div class="sandbox-shell" style="height: {height};">
  <div class="sandbox-header">
    <span class="sandbox-dot" style="background: {statusColor};"></span>
    <span class="sandbox-title">Sandbox real</span>
    <span class="sandbox-status">{statusMessage}</span>
  </div>
  <div bind:this={containerEl} class="sandbox-terminal" data-testid="sandbox-terminal"></div>
</div>

<style>
  .sandbox-shell {
    display: flex;
    flex-direction: column;
    border: 1px solid #1f2937;
    border-radius: 8px;
    overflow: hidden;
    background: #0b1020;
    margin: 1.25rem 0;
  }

  .sandbox-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: #111827;
    border-bottom: 1px solid #1f2937;
    font-size: 0.85rem;
    font-family: ui-monospace, monospace;
  }

  .sandbox-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
    transition: background-color 0.2s;
  }

  .sandbox-title {
    color: #94a3b8;
    font-weight: 600;
  }

  .sandbox-status {
    color: #64748b;
    margin-left: auto;
    font-size: 0.8rem;
  }

  .sandbox-terminal {
    flex: 1;
    min-height: 0;
    padding: 0.5rem;
  }

  :global(.sandbox-terminal .xterm) {
    height: 100%;
  }

  :global(.sandbox-terminal .xterm-viewport) {
    background: transparent !important;
  }
</style>
