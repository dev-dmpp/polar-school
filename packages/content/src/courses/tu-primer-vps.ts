import type { Course } from '../types'

export const tuPrimerVps: Course = {
  meta: {
    slug: 'tu-primer-vps',
    title: 'Tu primer sitio en un VPS — manual, sin plataforma',
    description:
      'Compra un VPS, conecta por SSH, instala Nginx, sube tu sitio, configura HTTPS con Let\'s Encrypt, y haz deploy con git. Sin Vercel, sin Railway.',
    level: 'intermedio',
    totalLessons: 10,
    estimatedHours: 4,
  },
  lessons: [
    {
      slug: '01-comprar-vps',
      title: 'Comprar un VPS — qué mirar (RAM, CPU, datacenter)',
      description:
        'Un VPS (Virtual Private Server) es una máquina Linux en la nube. Aprende a elegir: recursos, datacenter cercano, y proveedor confiable.',
      command: 'ssh',
      difficulty: 'intermedio',
      category: 'ssh',
      readTime: 5,
      example: '# Proveedores serios con servidores en LATAM:\n# - DigitalOcean (datacenter NYC, SFO)\n# - Linode (Akamai, datacenter en Miami)\n# - Vultr (NY, Miami, São Paulo, México)\n# - Hetzner (Europa, mejor precio/rendimiento)\n\n# Para empezar: 1 vCPU, 1 GB RAM, 25 GB SSD — $5/mes',
      tip: 'Elige datacenter cerca de tus usuarios (São Paulo/Miami para LATAM). IPv6 incluido es útil. Evita "VPS ilimitados" — suelen ser oversold.',
    },
    {
      slug: '02-ssh',
      title: 'ssh — tu primera conexión al servidor',
      description:
        'SSH te da una terminal remota en tu VPS. La usas para todo: instalar paquetes, editar archivos, ver logs, reiniciar servicios.',
      command: 'ssh',
      difficulty: 'intermedio',
      category: 'ssh',
      readTime: 4,
      example: '$ ssh root@203.0.113.42\nThe authenticity of host \'203.0.113.42\' can\'t be established.\nED25519 key fingerprint is SHA256:abc123...\nAre you sure you want to continue connecting? yes\n\nroot@polar:~# whoami\nroot',
      tip: 'Siempre entra como root la primera vez para crear un usuario no-root. Después configuras ssh-copy-id para entrar sin contraseña con una llave SSH.',
    },
    {
      slug: '03-apt-update',
      title: 'apt update && apt upgrade — actualizar el sistema',
      description:
        'Antes de instalar nada, actualiza la lista de paquetes y los paquetes mismos. Es lo primero en cualquier servidor nuevo.',
      command: 'apt',
      difficulty: 'intermedio',
      category: 'paquetes',
      readTime: 3,
      example: '$ sudo apt update && sudo apt upgrade -y\nObj:1 http://archive.ubuntu.com focal InRelease\nLeyendo lista de paquetes... Todos los paquetes están actualizados.\n0 actualizados, 0 nuevos, 0 para eliminar.',
      tip: 'update baja la lista de qué hay disponible. upgrade instala las versiones nuevas. Útiles juntos al inicio y como mantenimiento mensual.',
    },
    {
      slug: '04-adduser',
      title: 'adduser — crear un usuario no-root',
      description:
        'Trabaja siempre como root es peligroso (un comando mal escrito puede borrar el sistema). Crea un usuario normal y usa sudo cuando necesites root.',
      command: 'adduser',
      difficulty: 'intermedio',
      category: 'permisos',
      readTime: 4,
      example: '$ sudo adduser deploy\nAgregando usuario \'deploy\'...\nCreando directorio home \'/home/deploy\'...\n[simulado — en un sistema real escribirías: passwd deploy]\n\n$ sudo usermod -aG sudo deploy',
      tip: 'usermod -aG sudo le da permisos sudo al nuevo usuario. Después deshabilitas el login root editando /etc/ssh/sshd_config (PermitRootLogin no).',
    },
    {
      slug: '05-nginx',
      title: 'Instalar Nginx — tu primer servidor web',
      description:
        'Nginx sirve archivos estáticos y hace de proxy reverso. Es lo que muestra tu sitio al mundo. Instalar es una línea.',
      command: 'apt install',
      difficulty: 'intermedio',
      category: 'webserver',
      readTime: 4,
      example: '$ sudo apt install nginx -y\nLeyendo lista de paquetes...\nSe instalarán los siguientes paquetes NUEVOS:\n  nginx\n0 actualizados, 1 nuevos, 0 para eliminar.\n\n$ sudo systemctl status nginx\n● nginx.service - active (running)',
      tip: 'Después de instalar, Nginx ya está corriendo y sirve una página de prueba en http://TU_IP. El config principal está en /etc/nginx/nginx.conf.',
    },
    {
      slug: '06-subir-archivos',
      title: 'Subir archivos — scp o git clone',
      description:
        'Tu sitio tiene que llegar al servidor. Dos formas comunes: scp para uno o pocos archivos, git clone para repositorios.',
      command: 'scp',
      difficulty: 'intermedio',
      category: 'ssh',
      readTime: 4,
      example: '# Opción 1: scp para pocos archivos\n$ scp -r sitio/* deploy@203.0.113.42:/var/www/sitio/\nindex.html 100% 1234 1,2KB/s 00:00\n\n# Opción 2: git clone para un repo\n$ ssh deploy@203.0.113.42 "git clone https://github.com/usuario/sitio.git /var/www/sitio"',
      tip: 'scp es rápido para 1-10 archivos. Para deploys frecuentes, mejor un repo git y un git pull desde el servidor. La sección 10 muestra el workflow completo.',
    },
    {
      slug: '07-nginx-config',
      title: 'Configura Nginx — server block para tu dominio',
      description:
        'Nginx necesita saber qué carpeta sirve y bajo qué dominio. Eso va en un archivo en /etc/nginx/sites-available/.',
      command: 'nano',
      difficulty: 'intermedio',
      category: 'webserver',
      readTime: 6,
      example: '$ sudo nano /etc/nginx/sites-available/polar.school\n\nserver {\n    listen 80;\n    server_name polar.school www.polar.school;\n    root /var/www/polar.school;\n    index index.html;\n\n    location / {\n        try_files $uri $uri/ =404;\n    }\n}\n\n$ sudo ln -s /etc/nginx/sites-available/polar.school /etc/nginx/sites-enabled/\n$ sudo nginx -t\nnginx: la configuración es correcta\n$ sudo systemctl reload nginx',
      tip: 'sites-available tiene configs, sites-enabled tiene symlinks a los activos. Así puedes tener varios sitios sin que estén "prendidos" hasta que los actives.',
    },
    {
      slug: '08-ufw',
      title: 'ufw — firewall básico',
      description:
        'Un firewall bloquea todo el tráfico que no esperas. ufw es el firewall simple de Ubuntu. Activa SSH, HTTP y HTTPS, deja el resto cerrado.',
      command: 'ufw',
      difficulty: 'intermedio',
      category: 'seguridad',
      readTime: 4,
      example: '$ sudo ufw allow OpenSSH\nRegla agregada\n\n$ sudo ufw allow \"Nginx Full\"\nRegla agregada\nRegla agregada (v6)\n\n$ sudo ufw enable\nEl firewall está activo y se inicia al arrancar el sistema\n\n$ sudo ufw status\nEstado: activo\n22/tcp                     ALLOW       Anywhere\n80/tcp                     ALLOW       Anywhere\n443/tcp                    ALLOW       Anywhere',
      tip: 'Si activas ufw sin permitir SSH, te quedas afuera del servidor. SIEMPRE allow OpenSSH primero. Para resetear desde un KVM/IPMI: sudo ufw disable.',
    },
    {
      slug: '09-certbot',
      title: 'certbot — HTTPS gratis con Let\'s Encrypt',
      description:
        'HTTPS encripta el tráfico y da el candadito verde en el navegador. Let\'s Encrypt da certificados gratis. certbot los instala y renueva automáticos.',
      command: 'certbot',
      difficulty: 'intermedio',
      category: 'seguridad',
      readTime: 5,
      example: '$ sudo apt install certbot python3-certbot-nginx -y\n$ sudo certbot --nginx -d polar.school -d www.polar.school\n\nSaving debug log to /var/log/letsencrypt/letsencrypt.log\nRequesting a certificate for polar.school and www.polar.school\n\nSuccessfully received certificate.\nCertificate is saved at: /etc/letsencrypt/live/polar.school/fullchain.pem\nKey is saved at:         /etc/letsencrypt/live/polar.school/privkey.pem\n\n[certbot también configura Nginx para redirigir HTTP → HTTPS]',
      tip: 'certbot agrega un cronjob que renueva el certificado automáticamente cada 60 días. Verifica con: sudo certbot renew --dry-run.',
    },
    {
      slug: '10-git-deploy',
      title: 'Deploy con git pull — workflow simple',
      description:
        'Para deployar cambios: commiteás localmente, haces git pull en el servidor, Nginx recarga. Es el workflow mínimo que escala bastante bien.',
      command: 'git pull',
      difficulty: 'intermedio',
      category: 'deploy',
      readTime: 5,
      example: '# Local: hacer cambios\n$ nano index.html\n$ git add .\n$ git commit -m "nueva sección sobre contacto"\n$ git push origin main\n\n# Servidor: traer los cambios\n$ ssh deploy@203.0.113.42\n$ cd /var/www/sitio && git pull origin main\nYa está actualizado.\n\n# Si cambian assets (CSS/JS), a veces hay que limpiar cache:\n# (no aplica a Nginx — sirve lo nuevo directo)',
      tip: 'Para sitios estáticos esto es suficiente. Para apps con build (Node, Astro), el flujo es: build local → commit del dist → git pull → reload del servicio.',
    },
  ],
}
