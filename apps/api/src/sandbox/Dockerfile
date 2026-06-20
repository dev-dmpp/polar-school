# Polar School — sandbox image
# Imagen base para terminales interactivas de los alumnos.
# Una sola imagen cubre los 8 cursos. Comandos "raros" (systemctl,
# journalctl, docker, certbot, apt) los cubre el simulador JS.

FROM alpine:3.20

# ─────────────────────────────────────────────────────────
# Paquetes: ver brief F5. ~52 MB uncompressed, ~76 MB on-disk.
# ─────────────────────────────────────────────────────────
RUN apk add --no-cache \
      bash bash-completion \
      git \
      nano \
      curl wget \
      openssh-client \
      procps \
      coreutils util-linux \
      findutils grep \
      gnupg \
      tini

# bash como shell default (busybox ash sigue disponible como sh).
RUN sed -i 's|/bin/ash|/bin/bash|' /etc/passwd

# Mensaje de bienvenida (visible en docker run -it, no en attach).
RUN { \
      echo '🐧 Polar School Sandbox'; \
      echo 'Alpine Linux 3.20 — entorno educativo aislado'; \
      echo 'Sin red, sin persistencia. Lo que hagas aquí muere al salir.'; \
      echo ''; \
    } > /etc/motd

# tini como PID 1 (reap zombies, manejo limpio de señales).
# Runtime: dockerode usará `docker run ... /bin/bash` (interactivo, con TTY).
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/bin/bash"]
