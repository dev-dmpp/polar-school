<script lang="ts">
  import { onMount } from 'svelte';

  const API: string =
    (typeof window !== 'undefined' && (window as any).__POLAR_API_URL__) ||
    'http://127.0.0.1:3001';

  interface User {
    id: string;
    email: string;
    emailVerified: boolean;
    displayName: string | null;
  }

  interface CompletedLesson {
    courseSlug: string;
    lessonSlug: string;
    completedAt: string;
  }

  // Lista de cursos. Se mantiene sincronizada con packages/content/src/index.ts.
  // En F4 esto se reemplaza por un endpoint del API que devuelva los cursos.
  interface CourseInfo {
    slug: string;
    title: string;
    totalLessons: number;
  }

  const COURSES: CourseInfo[] = [
    { slug: 'linux-basico', title: 'Linux desde cero', totalLessons: 20 },
    { slug: 'linux-intermedio', title: 'Linux intermedio', totalLessons: 10 },
    { slug: 'docker', title: 'Docker básico', totalLessons: 12 },
    { slug: 'tu-primer-vps', title: 'Tu primer VPS', totalLessons: 10 },
    { slug: 'git-github', title: 'Git y GitHub', totalLessons: 10 },
    { slug: 'linux-avanzado', title: 'Linux avanzado', totalLessons: 10 },
    { slug: 'bases-de-datos', title: 'Bases de datos SQL', totalLessons: 10 },
    { slug: 'primer-sitio-web', title: 'Primer sitio web', totalLessons: 10 },
  ];

  let user = $state<User | null>(null);
  let lessons = $state<CompletedLesson[]>([]);
  let loading = $state(true);
  let loggingOut = $state(false);

  async function refresh() {
    loading = true;
    try {
      const me = await fetch(`${API}/auth/me`, { credentials: 'include' });
      const mej = await me.json();
      user = mej.user;
      if (user) {
        const pr = await fetch(`${API}/progress`, { credentials: 'include' });
        const prj = await pr.json();
        lessons = prj.lessons ?? [];
      } else {
        lessons = [];
      }
    } catch (e) {
      user = null;
      lessons = [];
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    refresh();
  });

  async function logout() {
    loggingOut = true;
    try {
      await fetch(`${API}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}
    await refresh();
    loggingOut = false;
  }

  function progressForCourse(slug: string): { done: number; total: number; pct: number } {
    const course = COURSES.find((c) => c.slug === slug);
    const total = course?.totalLessons ?? 0;
    const done = lessons.filter((l) => l.courseSlug === slug).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done, total, pct };
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('es', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  }
</script>

{#if loading}
  <p class="loading">Cargando tu cuenta...</p>
{:else if !user}
  <div class="empty">
    <h2>No has iniciado sesión</h2>
    <p>Para ver tu progreso guardado entre dispositivos, inicia sesión o crea una cuenta desde el menú superior derecho.</p>
    <p class="empty-hint">Si no quieres crear cuenta, tu progreso también se guarda localmente en este navegador.</p>
  </div>
{:else}
  <section class="profile">
    <h2>{user.displayName ?? user.email}</h2>
    <p class="email">{user.email}</p>
    {#if !user.emailVerified}
      <p class="hint">Tu correo aún no está verificado. Usa el magic link en cualquier momento para verificarlo.</p>
    {/if}
    <button type="button" class="btn-ghost" onclick={logout} disabled={loggingOut}>
      {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
    </button>
  </section>

  <section class="progress">
    <h2>Tu progreso</h2>
    <ul class="course-list">
      {#each COURSES as course (course.slug)}
        {@const p = progressForCourse(course.slug)}
        <li class="course-row">
          <div class="course-head">
            <a class="course-title" href={`/cursos/${course.slug}`}>{course.title}</a>
            <span class="course-meta">{p.done} / {p.total} lecciones · {p.pct}%</span>
          </div>
          <div class="bar" aria-label={`${p.pct}% completado`}>
            <div class="bar-fill" style:width={`${p.pct}%`}></div>
          </div>
        </li>
      {/each}
    </ul>
  </section>

  <section class="recent">
    <h2>Lecciones completadas recientemente</h2>
    {#if lessons.length === 0}
      <p>Aún no marcaste ninguna lección. Empieza por <a href="/cursos/linux-basico">Linux desde cero</a>.</p>
    {:else}
      <ol class="recent-list">
        {#each [...lessons]
          .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
          .slice(0, 12) as l (l.courseSlug + '/' + l.lessonSlug)}
          <li>
            <a href={`/cursos/${l.courseSlug}/${l.lessonSlug}`}>
              {l.courseSlug} · {l.lessonSlug}
            </a>
            <span class="date">{formatDate(l.completedAt)}</span>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
{/if}

<style>
  .loading {
    color: var(--ink-soft, #5a4a3a);
  }
  .empty {
    background: var(--paper-warm, #f5e9c8);
    border: 2px solid var(--wood, #d4c7a8);
    border-radius: 12px;
    padding: 1.5rem;
  }
  .empty h2 {
    margin: 0 0 0.6rem;
    color: var(--ink, #2a2218);
    font-family: var(--font-hand, 'Patrick Hand', cursive);
  }
  .empty-hint {
    font-size: 0.9rem;
    color: var(--ink-soft, #5a4a3a);
  }
  .profile {
    background: var(--paper-warm, #f5e9c8);
    border: 2px solid var(--wood, #d4c7a8);
    border-radius: 12px;
    padding: 1.2rem 1.5rem;
    margin-bottom: 2rem;
  }
  .profile h2 {
    margin: 0 0 0.3rem;
    font-family: var(--font-hand, 'Patrick Hand', cursive);
    color: var(--ink, #2a2218);
  }
  .email {
    margin: 0 0 0.6rem;
    color: var(--ink-soft, #5a4a3a);
    font-size: 0.95rem;
  }
  .hint {
    margin: 0 0 0.8rem;
    color: var(--accent-dark, #8a5a2a);
    font-size: 0.9rem;
  }
  .btn-ghost {
    font: inherit;
    padding: 0.5em 1em;
    background: transparent;
    border: 1px solid var(--wood, #d4c7a8);
    border-radius: 6px;
    cursor: pointer;
  }
  .btn-ghost:hover { background: var(--paper, #fbf6e9); }
  .btn-ghost:disabled { opacity: 0.6; cursor: progress; }

  .progress {
    margin-bottom: 2rem;
  }
  .progress h2,
  .recent h2 {
    font-family: var(--font-hand, 'Patrick Hand', cursive);
    color: var(--ink, #2a2218);
    border-bottom: 2px dashed var(--wood, #d4c7a8);
    padding-bottom: 0.4rem;
  }
  .course-list {
    list-style: none;
    padding: 0;
    margin: 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .course-row {
    background: var(--paper, #fbf6e9);
    border: 2px solid var(--wood, #d4c7a8);
    border-radius: 10px;
    padding: 0.9rem 1.2rem;
  }
  .course-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 0.5rem;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .course-title {
    font-weight: 700;
    color: var(--accent-dark, #8a5a2a);
    text-decoration: none;
  }
  .course-title:hover { text-decoration: underline; }
  .course-meta {
    font-size: 0.85rem;
    color: var(--ink-soft, #5a4a3a);
  }
  .bar {
    background: var(--paper-warm, #f5e9c8);
    border-radius: 999px;
    height: 10px;
    overflow: hidden;
  }
  .bar-fill {
    background: var(--leaf-dark, #5a8a3a);
    height: 100%;
    transition: width 0.3s ease-out;
  }

  .recent-list {
    list-style: decimal;
    padding-left: 1.5rem;
    margin: 1rem 0;
  }
  .recent-list li {
    margin-bottom: 0.4rem;
  }
  .recent-list a {
    color: var(--accent-dark, #8a5a2a);
    text-decoration: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9rem;
  }
  .recent-list a:hover { text-decoration: underline; }
  .recent-list .date {
    margin-left: 0.6rem;
    font-size: 0.8rem;
    color: var(--ink-soft, #5a4a3a);
  }
</style>
