<script lang="ts">
  /**
   * ReadingOnly — placeholder amigable para lecciones sin playground todavía.
   *
   * Se usa dentro de LessonRenderer cuando kind = playground-html | git | docker.
   * Estilo coherente con el resto de la UI (paper-warm, wood border).
   */
  interface Props {
    message?: string
    cta?: string
  }

  let { message = 'Esta lección no tiene playground interactivo todavía.', cta = 'Próximamente' }: Props = $props()
</script>

<div class="reading-only">
  <div class="badge">{cta}</div>
  <p>{message}</p>
  <slot />
</div>

<style>
  .reading-only {
    background: var(--paper-warm, #fdf6e3);
    border: 2px dashed var(--wood, #d4a574);
    border-radius: 12px;
    padding: 1.5rem;
    text-align: center;
    color: var(--ink-soft, #4b5563);
  }
  .badge {
    display: inline-block;
    background: var(--wood, #d4a574);
    color: var(--paper, #fafaf7);
    font-family: var(--font-hand, 'Caveat', cursive);
    font-size: 1.05rem;
    font-weight: 700;
    padding: 0.3em 0.9em;
    border-radius: 6px;
    margin-bottom: 0.6rem;
  }
  p {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.5;
  }
</style>
