import type { Course } from '../types'

export const docker: Course = {
  meta: {
    slug: 'docker',
    title: 'Docker desde cero — containers sin dolor',
    description:
      'Docker empaqueta una aplicación y todas sus dependencias en un container. Aprende a correr, listar, parar y borrar containers e imágenes.',
    level: 'basico',
    totalLessons: 12,
    estimatedHours: 4,
  },
  lessons: [
    {
      slug: '01-hello-world',
      title: 'docker run hello-world — tu primer container',
      description:
        'docker run descarga una imagen (si no la tienes) y la arranca en un container. hello-world confirma que Docker está bien instalado.',
      command: 'docker run',
      difficulty: 'basico',
      category: 'contenedores',
      readTime: 4,
      kind: 'playground-docker',      example: '$ docker run hello-world\nUnable to find image \'hello-world:latest\' locally\nlatest: Pulling from library/hello-world\n[simulado] Hello from Docker!\nThis message shows that your installation appears to be working correctly.',
      tip: 'Si ves "Hello from Docker!" Docker funciona. Si dice "permission denied", tu usuario no está en el grupo docker (sudo usermod -aG docker $USER y reinicia sesión).',
    },
    {
      slug: '02-ps',
      title: 'docker ps — ver containers corriendo',
      description:
        'docker ps lista los containers activos. -a (--all) muestra también los detenidos. Tu herramienta principal para saber qué corre ahora.',
      command: 'docker ps',
      difficulty: 'basico',
      category: 'contenedores',
      readTime: 3,
      kind: 'playground-docker',      example: '$ docker ps\nCONTAINER ID   IMAGE          COMMAND   CREATED       STATUS       PORTS     NAMES\na1b2c3d4e5f6   nginx:latest   "nginx"   2 hours ago   Up 2 hours   80/tcp    web',
      tip: 'docker ps -a muestra todos (corriendo + detenidos). El CONTAINER ID es lo que usas para parar, borrar o inspeccionar un container.',
    },
    {
      slug: '03-images',
      title: 'docker images — qué tienes descargado',
      description:
        'Cada vez que corres docker run, Docker descarga la imagen y la guarda en tu máquina. docker images lista todas.',
      command: 'docker images',
      difficulty: 'basico',
      category: 'imagenes',
      readTime: 3,
      kind: 'playground-docker',      example: '$ docker images\nREPOSITORY   TAG       IMAGE ID       CREATED       SIZE\nnginx        latest    a1b2c3d4e5f6   2 hours ago   187MB\nhello-world  latest    b7c5d4e3f2a1   3 months ago  13,3kB',
      tip: 'Con el tiempo se acumulan imágenes y ocupan disco. docker image prune las borra. docker system prune borra todo lo no usado (cuidado).',
    },
    {
      slug: '04-pull',
      title: 'docker pull — descargar imágenes sin correrlas',
      description:
        'A veces quieres descargar la imagen primero (para verificar que existe, o para uso posterior). docker pull hace eso.',
      command: 'docker pull',
      difficulty: 'basico',
      category: 'imagenes',
      readTime: 2,
      kind: 'playground-docker',      example: '$ docker pull nginx\nUsing default tag: latest\nlatest: Pulling from library/nginx\nStatus: Downloaded newer image for nginx:latest',
      tip: 'Por defecto usa el tag "latest". Para versiones específicas: docker pull nginx:1.24 o docker pull ubuntu:22.04.',
    },
    {
      slug: '05-run-d',
      title: 'docker run -d — containers en background',
      description:
        'Sin -d el container arranca y bloquea tu terminal. Con -d (detached) corre en background y te devuelve el control.',
      command: 'docker run -d',
      difficulty: 'basico',
      category: 'contenedores',
      readTime: 3,
      kind: 'playground-docker',      example: '$ docker run -d --name web -p 8080:80 nginx:latest\na1b2c3d4e5f6...\n\n[simulado] Container "web" corriendo en background, puerto 8080 mapeado al 80 del container.',
      tip: 'Forma común para servidores: docker run -d --name NOMBRE -p PUERTO_HOST:PUERTO_CONTAINER IMAGEN. El -p mapea puertos.',
    },
    {
      slug: '06-stop-start',
      title: 'docker stop y start — lifecycle de un container',
      description:
        'stop detiene un container (sin borrarlo). start lo vuelve a arrancar. restart lo recicla (útil después de cambiar config).',
      command: 'docker stop',
      difficulty: 'basico',
      category: 'contenedores',
      readTime: 3,
      kind: 'playground-docker',      example: '$ docker stop web\nweb\n\n$ docker start web\nweb\n\n$ docker restart web\nweb',
      tip: 'stop envía SIGTERM (señal de cierre amable). Si no responde en 10s, envía SIGKILL. Para forzar: docker kill NOMBRE.',
    },
    {
      slug: '07-rm',
      title: 'docker rm — borrar containers',
      description:
        'Cuando ya no necesitas un container (o falló y quieres recrearlo), rm lo borra. No borra la imagen.',
      command: 'docker rm',
      difficulty: 'basico',
      category: 'contenedores',
      readTime: 2,
      kind: 'playground-docker',      example: '$ docker rm web\nweb\n\n$ docker rm -f $(docker ps -aq)\n[simulado] Borrados todos los containers (forzado).',
      tip: 'Si el container está corriendo, rm falla. Usa -f para forzar, o primero docker stop. docker container prune borra todos los detenidos.',
    },
    {
      slug: '08-rmi',
      title: 'docker rmi — borrar imágenes',
      description:
        'rmi (remove image) borra imágenes que ya no usas para liberar espacio. Falla si algún container la está usando.',
      command: 'docker rmi',
      difficulty: 'basico',
      category: 'imagenes',
      readTime: 2,
      kind: 'playground-docker',      example: '$ docker rmi nginx:latest\nUntagged: nginx:latest\n\n$ docker image prune -a\n[simulado] Borradas todas las imágenes sin uso.',
      tip: 'Liberar espacio suele ser: docker container prune (containers parados) + docker image prune -a (imágenes no usadas).',
    },
    {
      slug: '09-logs',
      title: 'docker logs — ver qué dice tu container',
      description:
        'docker logs muestra stdout/stderr del proceso principal del container. Tu primer lugar a mirar cuando algo no anda.',
      command: 'docker logs',
      difficulty: 'basico',
      category: 'contenedores',
      readTime: 3,
      kind: 'playground-docker',      example: '$ docker logs web\n192.168.1.50 - - [19/Jun/2026:12:01:12 +0000] "GET / HTTP/1.1" 200 1234\n192.168.1.51 - - [19/Jun/2026:12:01:15 +0000] "GET /style.css HTTP/1.1" 200 567',
      tip: 'docker logs -f NOMBRE sigue los logs en vivo (como tail -f). --tail 50 muestra las últimas 50 líneas. --since "10m" filtra por tiempo.',
    },
    {
      slug: '10-exec',
      title: 'docker exec — entrar a un container corriendo',
      description:
        'A veces necesitas una shell adentro del container para debuggear. docker exec abre una terminal interactiva.',
      command: 'docker exec',
      difficulty: 'basico',
      category: 'contenedores',
      readTime: 3,
      kind: 'playground-docker',      example: '$ docker exec -it web bash\nroot@a1b2c3d4:/# ls /\nbin  boot  dev  etc  home  lib  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var',
      tip: '-it = interactivo + TTY (te da una shell usable). Para containers Alpine/minimal usa sh en lugar de bash. Para correr un comando puntual: docker exec web ls /.',
    },
    {
      slug: '11-build',
      title: 'docker build — crear tus propias imágenes',
      description:
        'Con un Dockerfile describes qué va dentro de una imagen. docker build la construye. Es como "empaquetar tu código en una caja transportable".',
      command: 'docker build',
      difficulty: 'basico',
      category: 'imagenes',
      readTime: 5,
      kind: 'playground-docker',      example: '$ docker build -t mi-app:1.0 .\n[+] Building 12.3s (8/8) FINISHED\n => [simulado] Imagen mi-app:1.0 creada a partir de tu Dockerfile',
      tip: '-t NOMBRE:TAG etiqueta la imagen. El . al final es el contexto (carpeta actual con el Dockerfile). Cada instrucción del Dockerfile es una "capa" cacheada.',
    },
    {
      slug: '12-compose',
      title: 'docker compose — múltiples containers juntos',
      description:
        'docker compose levanta una app completa (web + db + cache) con un solo comando desde un archivo docker-compose.yml.',
      command: 'docker compose',
      difficulty: 'basico',
      category: 'orquestacion',
      readTime: 5,
      kind: 'playground-docker',      example: '$ docker compose up -d\n[+] Running 3/3\n ✔ Network myapp_default  Created\n ✔ Container myapp-web-1   Started\n ✔ Container myapp-db-1    Started',
      tip: 'docker compose down detiene y borra todo. docker compose logs -f sigue logs de todos. docker compose ps lista servicios.',
    },
  ],
}
