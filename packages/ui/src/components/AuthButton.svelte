<script lang="ts">
  import { onMount } from 'svelte';

  // Lee la URL del API desde una variable de Astro (window.__POLAR_API_URL__).
  // En dev, Astro inyecta import.meta.env.PUBLIC_API_URL.
  // Fallback a localhost:3001 si no está configurada.
  const API: string =
    (typeof window !== 'undefined' && (window as any).__POLAR_API_URL__) ||
    'http://127.0.0.1:3001';

  interface User {
    id: string;
    email: string;
    emailVerified: boolean;
    displayName: string | null;
  }

  let user = $state<User | null>(null);
  let loading = $state(true);
  let modal = $state<'closed' | 'login' | 'register' | 'magic'>('closed');
  let email = $state('');
  let password = $state('');
  let displayName = $state('');
  let message = $state('');
  let messageKind = $state<'info' | 'error'>('info');
  let submitting = $state(false);

  function showInfo(msg: string) { message = msg; messageKind = 'info'; }
  function showError(msg: string) { message = msg; messageKind = 'error'; }

  async function refresh() {
    try {
      const r = await fetch(`${API}/auth/me`, { credentials: 'include' });
      const j = await r.json();
      user = j.user;
    } catch (e) {
      // Si el API no responde, asumimos sin sesión (no rompemos la UI).
      user = null;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    refresh();
  });

  async function submitRegister(e: Event) {
    e.preventDefault();
    if (submitting) return;
    submitting = true;
    showInfo('Creando cuenta...');
    try {
      const r = await fetch(`${API}/auth/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        showError(j.error ?? 'No se pudo crear la cuenta');
        return;
      }
      showInfo('Cuenta creada. Cargando sesión...');
      await refresh();
      closeModal();
    } catch (e: any) {
      showError(e?.message ?? 'Error de red');
    } finally {
      submitting = false;
    }
  }

  async function submitLogin(e: Event) {
    e.preventDefault();
    if (submitting) return;
    submitting = true;
    showInfo('Iniciando sesión...');
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const j = await r.json();
      if (!r.ok) {
        showError(j.error ?? 'No se pudo iniciar sesión');
        return;
      }
      await refresh();
      closeModal();
    } catch (e: any) {
      showError(e?.message ?? 'Error de red');
    } finally {
      submitting = false;
    }
  }

  async function submitMagic(e: Event) {
    e.preventDefault();
    if (submitting) return;
    submitting = true;
    showInfo('Enviando enlace...');
    try {
      const r = await fetch(`${API}/auth/magic-link`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const j = await r.json();
      if (!r.ok) {
        showError(j.error ?? 'No se pudo enviar el enlace');
        return;
      }
      showInfo('Si el correo está registrado, recibirás un enlace en breve. Revisa tu bandeja.');
      setTimeout(closeModal, 1800);
    } catch (e: any) {
      showError(e?.message ?? 'Error de red');
    } finally {
      submitting = false;
    }
  }

  async function logout() {
    try {
      await fetch(`${API}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      user = null;
    } catch (e) {
      // ignorar; UI ya muestra "Iniciar sesión"
    }
  }

  function openLogin()   { modal = 'login';   email = ''; password = ''; displayName = ''; message = ''; }
  function openRegister(){ modal = 'register';email = ''; password = ''; displayName = ''; message = ''; }
  function openMagic()   { modal = 'magic';   email = ''; message = ''; }
  function closeModal()  { modal = 'closed';  message = ''; }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') closeModal();
  }
</script>

<svelte:window onkeydown={handleKey} />

{#if loading}
  <span class="auth-loading" aria-hidden="true"></span>
{:else if user}
  <div class="auth-signed">
    <span class="user-email" title={user.email}>{user.displayName ?? user.email}</span>
    <a class="account-link" href="/cuenta">Mi cuenta</a>
    <button type="button" class="btn btn-ghost" onclick={logout}>Salir</button>
  </div>
{:else}
  <div class="auth-signed-out">
    <button type="button" class="btn btn-ghost" onclick={openLogin}>Entrar</button>
    <button type="button" class="btn btn-primary" onclick={openRegister}>Crear cuenta</button>
  </div>
{/if}

{#if modal !== 'closed'}
  <div class="modal-backdrop" onclick={closeModal} role="presentation">
    <div
      class="modal"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <button type="button" class="modal-close" onclick={closeModal} aria-label="Cerrar">×</button>

      {#if modal === 'login'}
        <h2 id="auth-modal-title">Iniciar sesión</h2>
        <form onsubmit={submitLogin}>
          <label>
            <span>Correo</span>
            <input type="email" bind:value={email} required autocomplete="email" />
          </label>
          <label>
            <span>Contraseña</span>
            <input type="password" bind:value={password} required minlength="8" autocomplete="current-password" />
          </label>
          <button type="submit" class="btn btn-primary" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p class="modal-foot">
          ¿No tienes cuenta?
          <button type="button" class="link" onclick={openRegister}>Crear una</button>
        </p>
        <p class="modal-foot">
          ¿Olvidaste tu contraseña?
          <button type="button" class="link" onclick={openMagic}>Recibir enlace mágico</button>
        </p>
      {:else if modal === 'register'}
        <h2 id="auth-modal-title">Crear cuenta</h2>
        <form onsubmit={submitRegister}>
          <label>
            <span>Correo</span>
            <input type="email" bind:value={email} required autocomplete="email" />
          </label>
          <label>
            <span>Nombre (opcional)</span>
            <input type="text" bind:value={displayName} maxlength="60" autocomplete="name" />
          </label>
          <label>
            <span>Contraseña (mínimo 8 caracteres)</span>
            <input type="password" bind:value={password} required minlength="8" autocomplete="new-password" />
          </label>
          <button type="submit" class="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creando...' : 'Crear cuenta'}
          </button>
        </form>
        <p class="modal-foot">
          ¿Ya tienes cuenta?
          <button type="button" class="link" onclick={openLogin}>Iniciar sesión</button>
        </p>
      {:else if modal === 'magic'}
        <h2 id="auth-modal-title">Recibir enlace mágico</h2>
        <p class="modal-intro">Te enviamos un enlace por correo. Válido por 15 minutos.</p>
        <form onsubmit={submitMagic}>
          <label>
            <span>Correo</span>
            <input type="email" bind:value={email} required autocomplete="email" />
          </label>
          <button type="submit" class="btn btn-primary" disabled={submitting}>
            {submitting ? 'Enviando...' : 'Enviar enlace'}
          </button>
        </form>
        <p class="modal-foot">
          <button type="button" class="link" onclick={openLogin}>Volver a iniciar sesión</button>
        </p>
      {/if}

      {#if message}
        <p class="modal-msg" class:error={messageKind === 'error'}>{message}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .auth-loading {
    display: inline-block;
    width: 1.2rem;
    height: 1.2rem;
    border: 2px solid var(--wood, #d4c7a8);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .auth-signed,
  .auth-signed-out {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }
  .user-email {
    font-size: 0.9rem;
    color: var(--ink-soft, #5a4a3a);
    max-width: 14ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .account-link {
    font-size: 0.9rem;
    color: var(--accent-dark, #8a5a2a);
    text-decoration: none;
    font-weight: 600;
  }
  .account-link:hover {
    text-decoration: underline;
  }

  .btn {
    font: inherit;
    font-size: 0.9rem;
    padding: 0.4em 0.9em;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.12s;
  }
  .btn-primary {
    background: var(--accent-dark, #8a5a2a);
    color: var(--paper, #fbf6e9);
    border-color: var(--accent-dark, #8a5a2a);
  }
  .btn-primary:hover { background: var(--accent, #c8842a); border-color: var(--accent, #c8842a); }
  .btn-primary:disabled { opacity: 0.6; cursor: progress; }
  .btn-ghost {
    background: transparent;
    color: var(--ink, #2a2218);
    border-color: var(--wood, #d4c7a8);
  }
  .btn-ghost:hover { background: var(--paper-warm, #f5e9c8); }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(20, 15, 10, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }
  .modal {
    background: var(--paper, #fbf6e9);
    border-radius: 12px;
    padding: 1.5rem;
    max-width: 420px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    position: relative;
  }
  .modal h2 {
    margin: 0 0 1rem;
    color: var(--ink, #2a2218);
    font-family: var(--font-hand, 'Patrick Hand', cursive);
    font-size: 1.5rem;
  }
  .modal-intro {
    color: var(--ink-soft, #5a4a3a);
    font-size: 0.95rem;
    margin: 0 0 1rem;
  }
  .modal-close {
    position: absolute;
    top: 0.6rem;
    right: 0.8rem;
    background: transparent;
    border: none;
    font-size: 1.6rem;
    color: var(--ink-soft, #5a4a3a);
    cursor: pointer;
    line-height: 1;
  }
  .modal form {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
  .modal label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
    color: var(--ink-soft, #5a4a3a);
    font-weight: 600;
  }
  .modal input {
    font: inherit;
    padding: 0.5em 0.7em;
    border: 1px solid var(--wood, #d4c7a8);
    border-radius: 6px;
    background: var(--paper-warm, #f5e9c8);
    color: var(--ink, #2a2218);
  }
  .modal input:focus {
    outline: 2px solid var(--accent, #c8842a);
    outline-offset: 1px;
  }
  .modal-foot {
    margin: 0.8rem 0 0;
    font-size: 0.85rem;
    color: var(--ink-soft, #5a4a3a);
    text-align: center;
  }
  .link {
    background: transparent;
    border: none;
    color: var(--accent-dark, #8a5a2a);
    cursor: pointer;
    text-decoration: underline;
    font: inherit;
    padding: 0;
  }
  .modal-msg {
    margin: 0.8rem 0 0;
    padding: 0.6rem 0.8rem;
    border-radius: 6px;
    background: var(--paper-warm, #f5e9c8);
    font-size: 0.85rem;
    color: var(--ink, #2a2218);
  }
  .modal-msg.error {
    background: #fde2dc;
    color: #8a2a18;
  }
</style>
