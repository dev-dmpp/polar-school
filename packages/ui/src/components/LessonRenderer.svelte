<script lang="ts">
  /**
   * LessonRenderer — switcher central de playground según lesson.kind.
   *
   * Antes (B1): cada [slug].astro metía TryIt o SandboxTerminal hardcodeado
   * por slug. Eso mezclaba routing de página con decisión de playground.
   *
   * Ahora (B2): una sola pieza decide qué renderizar según `kind`.
   *
   * Reglas:
   *   terminal-linux       → SandboxTerminal (real, Alpine)
   *   playground-html      → placeholder "HtmlPlayground (próximamente)" hasta B3
   *   playground-git       → ReadingOnly "Próximamente"
   *   playground-docker    → ReadingOnly "Próximamente"
   *   reading-only         → no renderiza nada (la página decide si mostrar
   *                          un placeholder externo)
   *
   * Por qué TS exhaustivo: como LessonKind es una union, si más adelante
   * agregamos un kind nuevo, TS nos obliga a manejarlo acá.
   */
  import type { LessonKind } from '@polar-school/content'
  import SandboxTerminal from './SandboxTerminal.svelte'
  import ReadingOnly from './ReadingOnly.svelte'

  interface Props {
    kind: LessonKind
    title?: string
    /** Sandbox height override. Default 380px. */
    height?: string
    /** Si true, muestra un header con el nombre del playground. */
    showHeader?: boolean
  }

  let { kind, title, height = '380px', showHeader = true }: Props = $props()
</script>

{#if kind === 'terminal-linux'}
  {#if showHeader}
    <div class="playground-header">
      <span class="dot"></span>
      <h3>🐳 Sandbox Linux real · Alpine 3.20</h3>
    </div>
  {/if}
  <SandboxTerminal client:only="svelte" {height} />
{:else if kind === 'playground-html'}
  {#if showHeader}
    <div class="playground-header">
      <span class="dot html"></span>
      <h3>🌐 Playground HTML · live preview</h3>
    </div>
  {/if}
  <ReadingOnly
    message="HtmlPlayground está en construcción (iteración B3). Mientras tanto, podés probar HTML en tu editor local y refrescar esta página."
    cta="Próximamente"
  />
{:else if kind === 'playground-git'}
  {#if showHeader}
    <div class="playground-header">
      <span class="dot git"></span>
      <h3>🌿 Playground Git</h3>
    </div>
  {/if}
  <ReadingOnly
    message="El playground interactivo de Git está en diseño. Por ahora seguí las lecciones con tu terminal local."
    cta="Próximamente"
  />
{:else if kind === 'playground-docker'}
  {#if showHeader}
    <div class="playground-header">
      <span class="dot docker"></span>
      <h3>🐳 Playground Docker</h3>
    </div>
  {/if}
  <ReadingOnly
    message="El playground interactivo de Docker está en diseño. Por ahora seguí las lecciones con tu terminal local."
    cta="Próximamente"
  />
{:else if kind === 'reading-only'}
  <!-- No renderiza nada: la lección no tiene playground interactivo. -->
{/if}

{#if title && showHeader}
  <p class="lesson-context">Leccion: <strong>{title}</strong></p>
{/if}

<style>
  .playground-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.6rem;
  }
  .playground-header h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--ink, #1f2937);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
  }
  .dot.html {
    background: #f59e0b;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
  }
  .dot.git {
    background: #f97316;
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.18);
  }
  .dot.docker {
    background: #0ea5e9;
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.18);
  }
  .lesson-context {
    margin-top: 0.4rem;
    font-size: 0.85rem;
    color: var(--ink-soft, #6b7280);
  }
</style>
