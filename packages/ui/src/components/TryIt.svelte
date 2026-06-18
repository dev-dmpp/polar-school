<script lang="ts">
  import { onMount } from 'svelte'
  import { createSimulator, type Simulator } from '@polar-school/simulator'

  interface Props {
    initialCommands?: string[]
    prompt?: string
    height?: string
  }

  let { initialCommands = [], prompt = '$', height = '320px' }: Props = $props()

  let sim: Simulator | null = null
  let input = $state('')
  let output = $state<string[]>([])
  let historyIdx = $state(-1)
  let inputEl: HTMLInputElement | undefined = $state()

  const WELCOME = `Simulador de Linux — escribe un comando y pulsa Enter.
Prueba: ls, pwd, cd proyectos, cat README.md, help`

  onMount(() => {
    sim = createSimulator()
    output = [WELCOME]
    if (initialCommands.length > 0) {
      runInitial()
    }
    inputEl?.focus()
  })

  function runInitial() {
    for (const cmd of initialCommands) {
      execute(cmd)
    }
  }

  function execute(cmd: string) {
    if (!sim) return
    output = [...output, `${prompt} ${cmd}`]
    const result = sim.run(cmd)
    if (result.stdout) {
      if (result.stdout === '\x1b[CLEAR\x1b') {
        output = []
        return
      }
      output = [...output, ...result.stdout.split('\n')]
    }
    if (result.stderr) {
      output = [...output, ...result.stderr.split('\n').map((l) => `⚠ ${l}`)]
    }
    setTimeout(() => {
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight
    }, 0)
  }

  let scrollEl: HTMLDivElement | undefined = $state()

  function handleSubmit(e: Event) {
    e.preventDefault()
    const cmd = input.trim()
    if (!cmd) return
    execute(cmd)
    input = ''
    historyIdx = -1
  }

  function handleKey(e: KeyboardEvent) {
    if (!sim) return
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const h = sim.history()
      if (h.length === 0) return
      historyIdx = Math.min(historyIdx + 1, h.length - 1)
      input = h[h.length - 1 - historyIdx]
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIdx <= 0) {
        historyIdx = -1
        input = ''
        return
      }
      const h = sim.history()
      historyIdx = historyIdx - 1
      input = h[h.length - 1 - historyIdx]
    }
  }

  function reset() {
    sim?.reset()
    output = [WELCOME]
    input = ''
  }
</script>

<div class="terminal" style:height>
  <div class="bar">
    <span class="dot dot-r"></span>
    <span class="dot dot-y"></span>
    <span class="dot dot-g"></span>
    <span class="title">terminal</span>
    <button onclick={reset} class="reset" type="button">reset</button>
  </div>
  <div class="body" bind:this={scrollEl}>
    {#each output as line, i (i)}
      <div class="line">{line}</div>
    {/each}
    <form onsubmit={handleSubmit} class="prompt-line">
      <span class="prompt">{prompt}</span>
      <input
        bind:this={inputEl}
        bind:value={input}
        onkeydown={handleKey}
        type="text"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        aria-label="terminal input"
      />
    </form>
  </div>
</div>

<style>
  .terminal {
    background: #1f1d1a;
    color: #f4e9d3;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    font-family: 'JetBrains Mono', 'Fira Code', 'Menlo', monospace;
    font-size: 14px;
    line-height: 1.55;
    display: flex;
    flex-direction: column;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: #2a2622;
    border-bottom: 1px solid #1a1816;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
  }
  .dot-r {
    background: #e26b6b;
  }
  .dot-y {
    background: #e6c46b;
  }
  .dot-g {
    background: #6bcf80;
  }
  .title {
    flex: 1;
    text-align: center;
    font-size: 12px;
    color: #b5a98a;
    font-family: 'Patrick Hand', cursive;
  }
  .reset {
    background: transparent;
    border: 1px solid #4a443c;
    color: #b5a98a;
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
  }
  .reset:hover {
    background: #3a3530;
  }
  .body {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
  }
  .line {
    white-space: pre-wrap;
    word-break: break-word;
  }
  .prompt-line {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .prompt {
    color: #6bcf80;
    font-weight: 600;
  }
  input {
    flex: 1;
    background: transparent;
    border: none;
    color: inherit;
    font: inherit;
    outline: none;
    caret-color: #6bcf80;
  }
</style>
