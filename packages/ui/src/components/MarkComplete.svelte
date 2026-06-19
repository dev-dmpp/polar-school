<script lang="ts">
  import { onMount } from 'svelte';

  const API: string =
    (typeof window !== 'undefined' && (window as any).__POLAR_API_URL__) ||
    'http://127.0.0.1:3001';

  interface Props {
    courseSlug: string;
    lessonSlug: string;
  }

  let { courseSlug, lessonSlug }: Props = $props();

  type Status = 'loading' | 'anonymous' | 'completed' | 'available';
  let status = $state<Status>('loading');
  let pending = $state(false);

  const LOCAL_KEY = 'polar_progress_local';

  function readLocal(): Set<string> {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (!raw) return new Set();
      return new Set(JSON.parse(raw));
    } catch {
      return new Set();
    }
  }
  function writeLocal(set: Set<string>) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify([...set]));
    } catch {
      // ignore
    }
  }
  function key(slug: string): string {
    return `${courseSlug}/${slug}`;
  }

  async function refresh() {
    status = 'loading';
    try {
      const r = await fetch(`${API}/auth/me`, { credentials: 'include' });
      const j = await r.json();
      if (!j.user) {
        status = 'anonymous';
        return;
      }
      const local = readLocal();
      if (local.has(key(lessonSlug))) {
        status = 'completed';
        return;
      }
      const pr = await fetch(`${API}/progress`, { credentials: 'include' });
      const pj = await pr.json();
      const serverHas = (pj.lessons ?? []).some(
        (l: any) => l.courseSlug === courseSlug && l.lessonSlug === lessonSlug,
      );
      if (serverHas) {
        const next = new Set(local);
        next.add(key(lessonSlug));
        writeLocal(next);
        status = 'completed';
      } else {
        status = 'available';
      }
    } catch {
      // API caído → tratar como anónimo para no bloquear la UI
      status = 'anonymous';
    }
  }

  onMount(() => {
    refresh();
  });

  async function mark() {
    if (pending) return;
    pending = true;
    // Optimista: actualizamos local primero
    const local = readLocal();
    local.add(key(lessonSlug));
    writeLocal(local);
    status = 'completed';

    try {
      await fetch(`${API}/progress`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseSlug, lessonSlug }),
      });
    } catch {
      // ya quedó guardado en local; se sincronizará cuando haya sesión
    } finally {
      pending = false;
    }
  }

  async function unmark() {
    if (pending) return;
    pending = true;
    const local = readLocal();
    local.delete(key(lessonSlug));
    writeLocal(local);
    status = 'available';
    try {
      await fetch(`${API}/progress`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseSlug, lessonSlug }),
      });
    } catch {
      // ignore
    } finally {
      pending = false;
    }
  }
</script>

{#if status === 'loading'}
  <div class="mark-wrap" aria-hidden="true">
    <span class="mark-loading"></span>
  </div>
{:else if status === 'anonymous'}
  <div class="mark-wrap anonymous">
    <span>Inicia sesión para guardar tu progreso entre dispositivos.</span>
  </div>
{:else if status === 'completed'}
  <div class="mark-wrap completed">
    <span class="check">✓</span>
    <span class="text">Lección completada</span>
    <button type="button" class="link" onclick={unmark} disabled={pending}>Desmarcar</button>
  </div>
{:else}
  <div class="mark-wrap available">
    <button type="button" class="btn" onclick={mark} disabled={pending}>
      {pending ? 'Guardando...' : 'Marcar como completada'}
    </button>
  </div>
{/if}

<style>
  .mark-wrap {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.9rem 1.2rem;
    border-radius: 10px;
    font-size: 0.95rem;
    margin: 2rem 0;
    border: 2px dashed;
  }
  .mark-wrap.anonymous {
    background: var(--paper-warm, #f5e9c8);
    border-color: var(--wood, #d4c7a8);
    color: var(--ink-soft, #5a4a3a);
  }
  .mark-wrap.completed {
    background: #e3f1d8;
    border-color: #8aab5e;
    border-style: solid;
    color: #4a6a2a;
    font-weight: 600;
  }
  .mark-wrap.available {
    background: transparent;
    border-color: var(--wood, #d4c7a8);
    justify-content: center;
  }
  .check {
    font-size: 1.2rem;
  }
  .btn {
    font: inherit;
    font-weight: 600;
    padding: 0.6em 1.2em;
    background: var(--accent-dark, #8a5a2a);
    color: var(--paper, #fbf6e9);
    border: 1px solid var(--accent-dark, #8a5a2a);
    border-radius: 8px;
    cursor: pointer;
  }
  .btn:hover { background: var(--accent, #c8842a); border-color: var(--accent, #c8842a); }
  .btn:disabled { opacity: 0.6; cursor: progress; }
  .link {
    background: transparent;
    border: none;
    color: var(--ink-soft, #5a4a3a);
    cursor: pointer;
    text-decoration: underline;
    font: inherit;
    font-size: 0.85rem;
    margin-left: auto;
    padding: 0;
  }
  .mark-loading {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--wood, #d4c7a8);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
