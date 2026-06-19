import type { Course } from '../types'

export const linuxAvanzado: Course = {
  meta: {
    slug: 'linux-avanzado',
    title: 'Linux avanzado — procesos, red, permisos y tareas',
    description:
      'Cuando algo se rompe en tu servidor, las herramientas son las mismas: procesos (ps, kill), puertos abiertos (ss), permisos (chmod/chown recursivo) y tareas programadas (cron). Aprende a diagnosticar y arreglar.',
    level: 'avanzado',
    totalLessons: 10,
    estimatedHours: 4,
  },
  lessons: [
    {
      slug: '01-ps-aux',
      title: 'ps aux — ver todos los procesos del sistema',
      description:
        'Un proceso es un programa corriendo. Con ps aux ves TODOS los procesos: usuario, PID, CPU, memoria, comando y hace cuánto arrancaron.',
      command: 'ps',
      difficulty: 'avanzado',
      category: 'procesos',
      readTime: 5,
      example:
        '$ ps aux\nUSER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\nroot         1  0.0  0.1 168920 11844 ?        Ss   Jun15   0:01 /sbin/init\nroot       387  0.0  0.2  72340  9324 ?        Ss   Jun15   0:00 sshd: /usr/sbin/sshd\npolar      421  0.0  0.1  21032  5120 pts/0    Ss   10:00   0:00 -bash\npolar      587  0.0  0.0  38820  3456 pts/0    R+   12:34   0:00 ps aux',
      tip: 'STAT muestra el estado: S (sleeping), R (running), Z (zombie — malo). Si ves muchos Z, hay un proceso que no se limpió.',
    },
    {
      slug: '02-kill',
      title: 'kill — terminar procesos',
      description:
        'Cuando un proceso se cuelga o consume demasiada memoria, lo terminas con kill. Necesitas el PID que te da ps o top.',
      command: 'kill',
      difficulty: 'avanzado',
      category: 'procesos',
      readTime: 4,
      example:
        '$ kill 587\n[simulado] Proceso 587 terminado (SIGTERM)\n\n$ kill -9 421\n[simulado] Proceso 421 terminado forzosamente (SIGKILL)',
      tip: 'kill envía SIGTERM (terminar amablemente). Si el proceso no responde, kill -9 manda SIGKILL (forzar). Usá -9 como último recurso.',
    },
    {
      slug: '03-chmod-r',
      title: 'chmod -R — cambiar permisos en carpetas enteras',
      description:
        'Con -R (recursivo) chmod aplica el cambio a una carpeta y todo lo que está adentro: subcarpetas, archivos, todo.',
      command: 'chmod',
      difficulty: 'avanzado',
      category: 'permisos',
      readTime: 5,
      example:
        '$ chmod -R 755 /var/www/mi-sitio\n\n$ ls -la /var/www/mi-sitio\ndrwxr-xr-x  root root  config/\n-rwxr-xr-x  root root  index.html\n-rwxr-xr-x  root root  app.js',
      tip: '755 es el permiso estándar para sitios web: el dueño puede escribir, el resto solo leer y ejecutar. Para archivos privados usas 600 o 700.',
    },
    {
      slug: '04-chown',
      title: 'chown — cambiar el dueño de un archivo',
      description:
        'chmod controla los permisos. chown controla QUIÉN es el dueño. Útil cuando subes archivos como root y necesitas que otro usuario los pueda editar.',
      command: 'chown',
      difficulty: 'avanzado',
      category: 'permisos',
      readTime: 5,
      example:
        '$ chown polar:www-data /var/www/mi-sitio\n$ chown -R polar:developers /home/polar/proyecto\n\n$ ls -la archivo.txt\n-rw-r--r-- 1 polar developers archivo.txt',
      tip: 'La sintaxis usuario:grupo cambia ambos. Si solo quieres cambiar el usuario, puedes omitir el grupo: chown polar archivo.txt',
    },
    {
      slug: '05-useradd-groupadd',
      title: 'useradd y groupadd — crear usuarios y grupos',
      description:
        'En un servidor profesional cada servicio o persona tiene su usuario. useradd crea usuarios, groupadd crea grupos para asignar permisos colectivos.',
      command: 'useradd',
      difficulty: 'avanzado',
      category: 'permisos',
      readTime: 5,
      example:
        '$ sudo useradd -m visitante\n$ sudo groupadd developers\n$ sudo usermod -aG developers polar\n$ groups polar\npolar : polar sudo www-data docker developers',
      tip: 'El flag -m en useradd crea el home directory automáticamente. Sin -m el usuario existe pero no tiene carpeta home, lo que rompe muchas herramientas.',
    },
    {
      slug: '06-ss-tulpn',
      title: 'ss -tulpn — ver puertos abiertos',
      description:
        'Si un servicio no responde, primero verifica que esté escuchando. ss -tulpn muestra todos los puertos TCP/UDP abiertos y qué proceso los usa.',
      command: 'ss',
      difficulty: 'avanzado',
      category: 'red',
      readTime: 5,
      example:
        '$ ss -tulpn\nState     Recv-Q  Send-Q   Local Address:Port     Peer Address:Port   Process\nLISTEN    0       128            0.0.0.0:22            0.0.0.0:*       users:(("sshd",pid=387,fd=3))\nLISTEN    0       511            0.0.0.0:80            0.0.0.0:*       users:(("nginx",pid=612,fd=6))\nLISTEN    0       4096           127.0.0.1:5432        0.0.0.0:*       users:(("postgres",pid=890,fd=4))',
      tip: "El -p necesita permisos de root para mostrar el nombre del proceso. Sin -p ves los puertos pero no quién los abrió.",
    },
    {
      slug: '07-netstat',
      title: 'netstat — el clásico (ahora reemplazado por ss)',
      description:
        'netstat hacía lo mismo que ss pero quedó como deprecated en muchas distros. Lo encuentras en tutoriales viejos, conviene entender su salida.',
      command: 'netstat',
      difficulty: 'avanzado',
      category: 'red',
      readTime: 4,
      example:
        '$ netstat -tulpn\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\ntcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      387/sshd\ntcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      612/nginx\ntcp        0      0 127.0.0.1:5432          0.0.0.0:*               LISTEN      890/postgres',
      tip: "En sistemas nuevos ss es más rápido y muestra más info. Pero si lees un tutorial viejo con netstat, ya sabes interpretarlo.",
    },
    {
      slug: '08-ping',
      title: 'ping — verificar conectividad de red',
      description:
        'ping envía paquetes a un host y mide cuánto tardan en volver. La primera prueba cuando algo no responde: ¿hay red hasta el destino?',
      command: 'ping',
      difficulty: 'avanzado',
      category: 'red',
      readTime: 4,
      example:
        '$ ping -c 3 google.com\nPING google.com (142.250.190.46) 56(84) bytes of data.\n64 bytes from 142.250.190.46: icmp_seq=1 ttl=56 time=14.2 ms\n64 bytes from 142.250.190.46: icmp_seq=2 ttl=56 time=13.8 ms\n64 bytes from 142.250.190.46: icmp_seq=3 ttl=56 time=15.1 ms\n\n--- google.com ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss',
      tip: "El flag -c 3 limita a 3 paquetes. Sin -c, ping corre para siempre y hay que cancelarlo con Ctrl+C.",
    },
    {
      slug: '09-crontab',
      title: 'crontab -l — ver tareas programadas',
      description:
        'cron ejecuta comandos automáticamente en horarios definidos. crontab -l lista las tuyas. El formato es: minuto hora día mes día-semana comando.',
      command: 'crontab',
      difficulty: 'avanzado',
      category: 'automatizacion',
      readTime: 5,
      example:
        '$ crontab -l\n# m h dom mon dow command\n0 3 * * * /usr/local/bin/backup.sh\n*/15 * * * * /usr/bin/php /var/www/cron.php\n@reboot systemctl restart nginx.service',
      tip: "El campo */15 significa \"cada 15\". @reboot es un shortcut para \"al iniciar el sistema\". Para editar: crontab -e.",
    },
    {
      slug: '10-which-env',
      title: 'which y env — entender el entorno',
      description:
        'which te dice dónde está un ejecutable. env muestra las variables de entorno (HOME, PATH, USER). Dos comandos cortos pero claves para debuggear.',
      command: 'which',
      difficulty: 'avanzado',
      category: 'sistema',
      readTime: 4,
      example:
        '$ which node\n/usr/bin/node\n\n$ which python3\n/usr/bin/python3\n\n$ env\nUSER=polar\nHOME=/home/polar\nPATH=/usr/local/bin:/usr/bin:/bin\nSHELL=/bin/bash',
      tip: "Si un comando \"no existe\" pero sabes que está instalado, which te dice dónde buscarlo. env | grep PATH te muestra dónde se buscan los ejecutables.",
    },
  ],
}
