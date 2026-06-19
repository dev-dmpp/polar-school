import type { Course } from '../types'

export const linuxIntermedio: Course = {
  meta: {
    slug: 'linux-intermedio',
    title: 'Linux intermedio — servicios, logs y sistema',
    description:
      'Tu servidor Linux corre servicios (Nginx, SSH, cron). Aprende a controlarlos, leer sus logs, y diagnosticar problemas con df, du, free y top.',
    level: 'intermedio',
    totalLessons: 10,
    estimatedHours: 3,
  },
  lessons: [
    {
      slug: '01-systemctl-status',
      title: 'systemctl status — el estado de tus servicios',
      description:
        'En Linux moderno casi todo es un "servicio" (daemon) gestionado por systemd. Aprende a ver su estado actual.',
      command: 'systemctl',
      difficulty: 'intermedio',
      category: 'servicios',
      readTime: 4,
      example: '$ systemctl status nginx.service\n● nginx.service - A high performance web server and reverse proxy server\n     Loaded: loaded (/lib/systemd/system/nginx.service; enabled)\n     Active: active (running) since Mon 2026-06-15 10:00:00 UTC',
      tip: 'Los 3 campos clave: Loaded (está instalado y configurado), Active (corriendo ahora), y el PID (qué proceso es).',
    },
    {
      slug: '02-systemctl-start-stop',
      title: 'systemctl start/stop/restart — controlar servicios',
      description:
        'Iniciar, detener y reiniciar servicios manualmente. Útil cuando un servicio se cuelga o cambias su configuración.',
      command: 'systemctl',
      difficulty: 'intermedio',
      category: 'servicios',
      readTime: 4,
      example: '$ sudo systemctl restart nginx.service\n[simulado] El servicio nginx se reinició y ahora corre con la configuración nueva.',
      tip: 'Si cambias un archivo de configuración, restart es lo normal. Si solo quieres aplicar cambios sin cortar conexiones, prueba reload (no todos los servicios lo soportan).',
    },
    {
      slug: '03-systemctl-enable',
      title: 'systemctl enable/disable — arrancar al iniciar el sistema',
      description:
        'enable configura un servicio para que systemd lo arranque automáticamente cada vez que el servidor prende.',
      command: 'systemctl',
      difficulty: 'intermedio',
      category: 'servicios',
      readTime: 3,
      example: '$ sudo systemctl enable nginx.service\nSynchronizing state of nginx.service with SysV service script.',
      tip: 'enable no inicia el servicio ahora, solo lo configura para el próximo reinicio. Si quieres ambos, usa enable --now.',
    },
    {
      slug: '04-journalctl',
      title: 'journalctl — leer los logs del sistema',
      description:
        'systemd guarda todos los logs en un diario central. journalctl te permite buscar, filtrar y seguir logs en tiempo real.',
      command: 'journalctl',
      difficulty: 'intermedio',
      category: 'logs',
      readTime: 5,
      example: '$ journalctl -u nginx.service --since "1 hour ago"\n-- Logs begin at Mon 2026-06-15 00:00:00 UTC --\nJun 19 12:01:12 polar nginx[1234]: 192.168.1.50 - - "GET / HTTP/1.1" 200 1234',
      tip: 'Filtros útiles: -u servicio (logs de un servicio), --since "fecha", -f (follow, como tail -f), -n N (últimas N líneas).',
    },
    {
      slug: '05-service-legacy',
      title: 'service — la forma legacy de iniciar servicios',
      description:
        'Antes de systemd se usaba el sistema init SysV. service es un wrapper que sigue funcionando y traduce a systemd por atrás.',
      command: 'service',
      difficulty: 'intermedio',
      category: 'servicios',
      readTime: 2,
      example: '$ sudo service nginx status\n * nginx is running',
      tip: 'Para servidores nuevos siempre usa systemctl. service aparece en tutoriales viejos, en scripts antiguos, y en imágenes Docker minimalistas sin systemd.',
    },
    {
      slug: '06-tail-f',
      title: 'tail -f — seguir logs en vivo',
      description:
        'Para debuggear en tiempo real, ver qué pasa en un log mientras un usuario navega tu sitio o un servicio falla.',
      command: 'tail',
      difficulty: 'intermedio',
      category: 'logs',
      readTime: 3,
      example: '$ tail -f /var/log/nginx/access.log\n192.168.1.50 - - [19/Jun/2026:12:01:12 +0000] "GET / HTTP/1.1" 200 1234\n192.168.1.51 - - [19/Jun/2026:12:01:15 +0000] "GET /style.css HTTP/1.1" 200 567',
      tip: 'Ctrl+C para salir del modo follow. -n 50 muestra las últimas 50 líneas antes de seguir. Equivalente en systemd: journalctl -f.',
    },
    {
      slug: '07-texto-utils',
      title: 'head, wc, sort, uniq — procesar texto como un pro',
      description:
        'Cuatro comandos para inspeccionar archivos de texto sin abrirlos: ver el principio, contar, ordenar, deduplicar.',
      command: 'sort',
      difficulty: 'intermedio',
      category: 'texto',
      readTime: 6,
      example: '$ cat logs.txt | sort | uniq | wc -l\n47',
      tip: 'Combinados con pipes (|) son brutales para analizar logs: cat + sort + uniq + wc te da el resumen en una línea.',
    },
    {
      slug: '08-tar',
      title: 'tar — comprimir y extraer archivos',
      description:
        'tar agrupa varios archivos en uno solo (.tar). Combinado con gzip (.tar.gz) comprime. Es el formato estándar para backups.',
      command: 'tar',
      difficulty: 'intermedio',
      category: 'compresion',
      readTime: 4,
      example: '$ tar -czf backup.tar.gz proyectos/\n[simulado] backup.tar.gz creado (compresión con gzip)\n\n$ tar -xzf backup.tar.gz\nExtraídas 5 entradas',
      tip: 'Flags clave: -c crear, -x extraer, -t listar, -z gzip, -j bzip2, -f archivo. Casi siempre: -czf para crear, -xzf para extraer.',
    },
    {
      slug: '09-df-du',
      title: 'df y du — espacio en disco',
      description:
        'df muestra espacio libre por partición, du muestra cuánto ocupa cada carpeta. Juntos diagnostican "no me queda espacio".',
      command: 'df',
      difficulty: 'intermedio',
      category: 'disco',
      readTime: 4,
      example: '$ df -h\nS.Archivos     Tamaño Usados  Disp Uso% Montado en\n/dev/sda1        50G    12G   36G  25% /\ntmpfs            2G     0M    2G   0% /dev/shm\n\n$ du -sh proyectos/\n4,0K\tproyectos/',
      tip: 'Si df muestra 100% uso, busca carpetas grandes con du -sh /* | sort -h y borra lo que no necesites (logs viejos, cache, node_modules).',
    },
    {
      slug: '10-free-top',
      title: 'free y top — memoria y procesos',
      description:
        'free muestra RAM usada y libre, top muestra procesos en vivo ordenados por CPU/RAM. Tus aliados cuando algo se pone lento.',
      command: 'free',
      difficulty: 'intermedio',
      category: 'memoria',
      readTime: 5,
      example: '$ free -h\n              total      used      free    shared  buff/cache   available\nMem:          4,0Gi    1,0Gi    2,0Gi     256Mi     800Mi    2,8Gi\nSwap:           0B        0B        0B\n\n$ top\n  PID USUARIO   PR  NI    VIRT    RES  SHR S  %CPU  %MEM\n 1234 polar     20   0  1024M   128M   16M S   0,5   3,1   bash',
      tip: 'Si free dice "available" mucho menor que "total", tu sistema está usando swap (disco como RAM), lo cual es lento. Busca el proceso pesado con top y reinícialo.',
    },
  ],
}
