import type { Course } from '../types'

export const primerSitioWeb: Course = {
  meta: {
    slug: 'primer-sitio-web',
    title: 'Tu primer sitio web — HTML, CSS y deploy',
    description:
      'Crea un sitio web hoy es más simple que nunca. En este curso armas uno desde cero con HTML, CSS y un poco de JavaScript. Después lo subes a internet gratis con GitHub Pages o Cloudflare Pages. Sin framework, sin servidor: archivos estáticos.',
    level: 'basico',
    totalLessons: 10,
    estimatedHours: 4,
  },
  lessons: [
    {
      slug: '01-que-es-html',
      title: 'Qué es HTML — la estructura de la web',
      description:
        'HTML (HyperText Markup Language) es el lenguaje de marcado que estructura una página web. Un archivo .html es texto plano con ETIQUETAS que el navegador interpreta.',
      command: 'nano',
      difficulty: 'basico',
      category: 'web',
      readTime: 4,
      example:
        '<!-- Un archivo HTML básico -->\n<!DOCTYPE html>\n<html lang="es">\n<head>\n  <meta charset="UTF-8">\n  <title>Mi primer sitio</title>\n</head>\n<body>\n  <h1>Hola mundo</h1>\n  <p>Esta es mi primera página web.</p>\n</body>\n</html>',
      tip: "lang=\"es\" indica que el contenido está en español. charset=\"UTF-8\" permite tildes y emojis correctamente. Estas dos líneas evitan el 80% de los problemas iniciales.",
    },
    {
      slug: '02-estructura-basica',
      title: 'Estructura básica de toda página',
      description:
        'Toda página tiene la misma estructura mínima: DOCTYPE, html, head (info para el navegador) y body (lo que ve el usuario).',
      command: 'nano',
      difficulty: 'basico',
      category: 'web',
      readTime: 5,
      example:
        '<!DOCTYPE html>\n<html lang="es">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Título que aparece en la pestaña</title>\n</head>\n<body>\n  <!-- Acá va todo el contenido visible -->\n  <header>Logo y navegación</header>\n  <main>Contenido principal</main>\n  <footer>Pie de página</footer>\n</body>\n</html>',
      tip: 'Las etiquetas semánticas (header, main, footer, nav, article) ayudan al SEO y a la accesibilidad. Mejor que llenar todo de <div>.',
    },
    {
      slug: '03-textos-y-enlaces',
      title: 'Textos, títulos y enlaces',
      description:
        'Los títulos van de <h1> (más importante) a <h6>. Los párrafos en <p>. Los enlaces con <a href="...">. Las imágenes con <img src="..." alt="...">.',
      command: 'nano',
      difficulty: 'basico',
      category: 'web',
      readTime: 5,
      example:
        '<body>\n  <h1>Bienvenido a mi sitio</h1>\n  <h2>Sobre mí</h2>\n  <p>Soy <strong>desarrollador</strong> y me gusta el café.</p>\n  <p>Escribime a <a href="mailto:hola@ejemplo.com">hola@ejemplo.com</a></p>\n  <p>O mira mi <a href="https://github.com/dev-dmpp" target="_blank">GitHub</a></p>\n  <img src="foto.jpg" alt="Mi foto de perfil">\n</body>',
      tip: "El atributo alt en imágenes es obligatorio para accesibilidad: lo leen los lectores de pantalla y se muestra si la imagen no carga.",
    },
    {
      slug: '04-css-basico',
      title: 'CSS — darle estilo a la página',
      description:
        'CSS (Cascading Style Sheets) controla cómo se VE tu HTML: colores, fuentes, tamaños, márgenes, posición. Se puede poner inline, en el <head>, o en un archivo separado.',
      command: 'nano',
      difficulty: 'basico',
      category: 'web',
      readTime: 5,
      example:
        '/* estilo.css */\nbody {\n  font-family: system-ui, sans-serif;\n  max-width: 720px;\n  margin: 0 auto;\n  padding: 1rem;\n  background: #fafafa;\n  color: #222;\n}\n\nh1 {\n  color: #2563eb;\n  border-bottom: 2px solid #2563eb;\n}\n\n/* se enlaza desde el HTML: */\n/* <link rel="stylesheet" href="estilo.css"> */',
      tip: "La mejor práctica es separar CSS en un archivo .css aparte. Así lo reutilizás en varias páginas y el HTML queda limpio.",
    },
    {
      slug: '05-layout-flex',
      title: 'Layout con Flexbox',
      description:
        'Flexbox es la forma moderna de organizar elementos en una dimensión (fila o columna). display: flex en el padre activa el modo.',
      command: 'nano',
      difficulty: 'intermedio',
      category: 'web',
      readTime: 5,
      example:
        '/* Card horizontal con Flexbox */\n.card {\n  display: flex;\n  gap: 1rem;\n  align-items: center;\n  padding: 1rem;\n  border: 1px solid #ddd;\n  border-radius: 8px;\n}\n\n.card img {\n  width: 80px;\n  height: 80px;\n  border-radius: 50%;\n  object-fit: cover;\n}\n\n.card h3 { margin: 0; }\n.card p { margin: 0; color: #666; }',
      tip: "Para layouts 2D (filas Y columnas) usas CSS Grid. Pero para la mayoría de UI (navbars, cards, listas) Flexbox es suficiente y más simple.",
    },
    {
      slug: '06-javascript-basico',
      title: 'JavaScript básico — interactividad',
      description:
        'JavaScript le da vida a la página: responde a clicks, valida formularios, hace fetch a APIs. Se incluye con <script> al final del body.',
      command: 'nano',
      difficulty: 'intermedio',
      category: 'web',
      readTime: 5,
      example:
        '<!-- Al final del body -->\n<script>\n  // Cambiar el texto al hacer click\n  const boton = document.querySelector("#mi-boton")\n  const salida = document.querySelector("#salida")\n\n  boton.addEventListener("click", () => {\n    salida.textContent = "Hola desde JS! Son las " + new Date().toLocaleTimeString()\n  })\n</script>\n\n<button id="mi-boton">Decir hola</button>\n<p id="salida"></p>',
      tip: "Poner el <script> al final del body hace que la página cargue visualmente más rápido. El HTML se muestra antes de que JS se ejecute.",
    },
    {
      slug: '07-deploy-github-pages',
      title: 'Deploy con GitHub Pages — gratis y simple',
      description:
        'GitHub Pages publica tu sitio estático gratis. Cada push a la rama main se deploya automáticamente. Ideal para portfolios y sitios personales.',
      command: 'git',
      difficulty: 'intermedio',
      category: 'deploy',
      readTime: 6,
      example:
        '# 1. Crea repo en github.com/dev-dmpp/mi-sitio\n# 2. Subir el código\n$ git init\n$ git add .\n$ git commit -m "primer sitio"\n$ git remote add origin https://github.com/dev-dmpp/mi-sitio.git\n$ git push -u origin main\n\n# 3. En GitHub: Settings → Pages → Source: main\n# 4. Listo: tu sitio está en https://dev-dmpp.github.io/mi-sitio',
      tip: "El repo DEBE ser público para GitHub Pages gratuito. Si quieres dominio propio, compras uno y en Settings → Pages lo conectas.",
    },
    {
      slug: '08-deploy-cloudflare-pages',
      title: 'Deploy con Cloudflare Pages — más rápido',
      description:
        'Cloudflare Pages es similar a GitHub Pages pero con CDN global más rápido, deploys por preview en cada PR, y dominio custom gratis. Se conecta con tu repo de GitHub.',
      command: 'git',
      difficulty: 'intermedio',
      category: 'deploy',
      readTime: 5,
      example:
        '# 1. Crea cuenta en pages.cloudflare.com\n# 2. Conectar tu repo de GitHub\n# 3. Configura:\n#    - Build command: (vacío para sitios estáticos)\n#    - Build output: ./  (o /dist, /public)\n#    - Root: /\n# 4. Click "Deploy"\n#\n# Tu sitio queda en: https://mi-sitio.pages.dev',
      tip: "Cloudflare Pages tiene HTTPS automático y dominios custom gratis. Para sitios serios es mejor que GitHub Pages por velocidad.",
    },
    {
      slug: '09-dominio-custom',
      title: 'Conectar un dominio propio',
      description:
        'En vez de dev-dmpp.github.io/mi-sitio quieres mi-sitio.com. Compras el dominio (Namecheap, Cloudflare Registrar) y lo conectas al servicio de hosting.',
      command: 'curl',
      difficulty: 'intermedio',
      category: 'deploy',
      readTime: 5,
      example:
        '# En el registrador del dominio:\n# Tipo: CNAME\n# Nombre: www\n# Valor: dev-dmpp.github.io\n#\n# Tipo: A\n# Nombre: @\n# Valor: 185.199.108.153\n#\n# Esperas unos minutos y https://mi-sitio.com funciona.',
      tip: "Cloudflare Registrar cobra al costo (sin markup). Namecheap y Porkbun son buenas alternativas. Evitá GoDaddy — sus precios de renovación son altos.",
    },
    {
      slug: '10-seo-basico',
      title: 'SEO básico — que Google te encuentre',
      description:
        'SEO (Search Engine Optimization) es hacer que tu sitio aparezca en Google cuando alguien busca algo. Las bases: HTML semántico, títulos con palabras clave, meta description, sitio rápido y responsive.',
      command: 'curl',
      difficulty: 'avanzado',
      category: 'web',
      readTime: 5,
      example:
        '<head>\n  <title>Mi nombre — Desarrollador en Ciudad</title>\n  <meta name="description" content="Portfolio de Polar, desarrollador de software especializado en Linux y cloud.">\n  <meta property="og:title" content="Mi nombre — Desarrollador">\n  <meta property="og:image" content="https://mi-sitio.com/preview.jpg">\n  <link rel="canonical" href="https://mi-sitio.com/">\n</head>',
      tip: "Para verificar tu SEO: Google Search Console (gratis, te dice si Google indexó tu sitio). Para medir velocidad: PageSpeed Insights (también de Google).",
    },
  ],
}
