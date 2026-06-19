# Polar School — Visión del proyecto

> Documento vivo. Última actualización: 2026-06-18.

---

## 1. La idea en una frase

**Una plataforma educativa gratuita en español-latino que enseña Linux, Docker, hosting y bases de datos con práctica REAL (no simulada), inspirada en W3Schools, Cisco NetAcad, Platzi, FreeCodeCamp y otros, pero enfocada en infraestructura — un nicho que casi nadie cubre en español.**

---

## 2. Por qué existe (el hueco)

| Quién | Hace bien | Hace mal |
|---|---|---|
| **W3Schools** | Try-it inline, ejemplos copy-paste | Solo web (no infra), UI del 2005, sin práctica real |
| **Cisco NetAcad** | Currículum serio, certificación | Inglés-first, pesado de instalar, corporativo |
| **FreeCodeCamp** | Open source, en español | No toca infra seria (Linux, Docker, sysadmin) |
| **Platzi** | Cursos en español de calidad | Suscripción paga, no hay "gratis para siempre" |
| **Docker PWD** | Playground real ephemeral | 4h de sesión, no guarda progreso, sin currículum |
| **TonyHost / 000webhost / InfinityFree** | Hosting PHP/MySQL gratis | Caídas frecuentes, sin valor educativo, sin soporte |
| **db4free / freesqldatabase** | DB MySQL gratis (5-25 MB) | MySQL viejo, sin docs, mueren solos |
| **YouTube tutoriales ES** | Contenido disperso | Sin currículum, sin práctica, sin certificados |

**El hueco**: nadie enseña infra (Linux, Docker, hosting, DB) en español-latino, con currículum estructurado, práctica real integrada, y precios accesibles para LATAM.

---

## 3. Referencias analizadas (y qué copiamos de cada una)

### W3Schools (`w3schools.com`)
- ✅ **Copia**: Try-it inline en cada lección (editor + ejecución inmediata).
- ✅ **Copia**: Ejemplos copy-paste que funcionan al 100%.
- ❌ **No copiar**: UI anticuada, sin práctica real, paywalls para certificados.

### Cisco Networking Academy (`netacad.com`)
- ✅ **Copia**: Currículum serio con objetivos, ejercicios y quizzes al final de cada módulo.
- ✅ **Copia**: Certificación como aspiración (pero nuestra será gratis o donada).
- ❌ **No copiar**: Inglés-first, Packet Tracer de 2GB, modelo cerrado.

### Platzi (`platzi.com`)
- ✅ **Copia**: Cursos en español de calidad profesional, instructors reales.
- ✅ **Copia**: Cohortes con fechas y "live sessions".
- ❌ **No copiar**: Suscripción mensual obligatoria, contenido gated.

### FreeCodeCamp (`freecodecamp.org`)
- ✅ **Copia**: 100% open source, español disponible, currículum gratis siempre.
- ✅ **Copia**: Certificaciones verificables.
- ❌ **No copiar**: No tiene contenido de infra (su fuerte es web).

### Docker Play with Docker (`labs.play-with-docker.com`)
- ✅ **Copia**: VMs ephemeral que se resetean (4h → nosotros 15min gratis, 4h pago).
- ✅ **Copia**: Acceso a terminal Linux real desde el navegador.
- ❌ **No copiar**: No tiene currículum ni progresión.

### TonyHost / 000webhost / InfinityFree
- ✅ **Copia**: Hosting PHP/MySQL gratis para que la gente publique cosas.
- ❌ **No copiar**: Caídas, soporte nulo, sin aprendizaje asociado.

### db4free.net / freesqldatabase.com
- ✅ **Copia**: DB MariaDB/MySQL gratis (5-25 MB) para practicar SQL.
- ✅ **Copia**: Schema precargado por lección (la DB ya tiene las tablas que el curso necesita).
- ❌ **No copiar**: MySQL viejo, sin documentación, sin sandbox de práctica guiada.

### Khan Academy (`khanacademy.org`)
- ✅ **Copia**: Progresión clara, gamificación sutil (streaks, badges).
- ✅ **Copia**: "Mastery" — no avanzas hasta demostrar que entendiste.
- ❌ **No copiar**: Leaderboards tóxicos, presión por velocidad.

### Vercel / Railway / Render / Netlify
- ✅ **Copia**: Deploy con git push, preview deployments.
- ✅ **Copia**: Free tier generoso para proyectos chicos.
- ❌ **No copiar**: El mensaje "todo es automático, no aprendas infra". Nosotros enseñamos a deployar MANUAL primero, y después recomendamos estas herramientas como atajo válido.

---

## 4. Lo que SOMOS

| Aspecto | Decisión |
|---|---|
| **Idioma primero** | Español-PA (neutral LATAM), con jerga técnica estándar. EN/pt-BR después. |
| **Precio del contenido** | Gratis. Siempre. Sin paywalls sobre el conocimiento. |
| **Práctica** | Real, no simulada. Terminal Linux real en navegador (sandbox con Docker ephemeral). |
| **Currículum** | Estructurado, con objetivos, ejercicios, quizzes. Tracks progresivos. |
| **Hosting gratis** | PHP, Node, Python básico + DB 25 MB, sin pedirte curso terminado. |
| **Premium pagado** | Solo lo que cuesta infra: VPS managed, sandbox extendido, mentorías 1-a-1, certificados verificados. |
| **Marca** | Personal ("Polar School") al inicio, se transforma en marca si crece. |
| **Tono** | Directo, técnico, sin bullshit. Ni condescendiente ni corporativo. |
| **Open source** | 100%. Todo el código y currículum en GitHub bajo CC-BY-SA. |
| **Comunidad** | Discord abierto, meetups virtuales en horario LATAM. |

---

## 5. Lo que NO somos (anti-manifiesto)

- ❌ **No somos otro W3Schools**: nuestro contenido es sobre infra, no web.
- ❌ **No somos un SaaS gringo traducido**: somos LATAM-first, con casos de uso y precios locales.
- ❌ **No somos paywalled**: el conocimiento es libre, lo que se cobra es infraestructura opcional.
- ❌ **No somos Cisco**: no necesitamos instalar 2GB de software, no somos una corporación.
- ❌ **No somos YouTube**: no somos tutoriales sueltos, somos currículum estructurado.
- ❌ **No somos Vercel-cult**: enseñamos a deployar manual primero; las plataformas "todo-en-uno" son una opción, no la respuesta única.
- ❌ **No somos una ONG**: somos un negocio con misión declarada, pero no dependemos de grants para sobrevivir.
- ❌ **No somos una startup unicornio aspiracional**: somos sustentables con 15-20 suscriptores pagos al mes.

---

## 6. Audience objetivo

### Primario (mes 1-12)
- **Devs juniors LATAM** (16-30 años) que saben HTML/CSS/JS pero nunca tocaron Linux.
- **Estudiantes de ingeniería** en Panamá, Costa Rica, Colombia, México que quieren skills laborales.
- **Autodidactas** que aprendieron web freeCodeCamp-style y quieren ir más profundo.

### Secundario (mes 6-18)
- **Profesionales cambiando de rubro** (de diseño, administración, soporte) que quieren entrar a tech.
- **Profesores de bootcamps** que necesitan currículum abierto para sus clases.
- **Empresas pequeñas LATAM** que necesitan entrenar devs junior sin pagar Coursera/Platzi.

### No-objetivo (explícito)
- Seniors con 10+ años de experiencia. No es para ellos.
- Gente que solo quiere "click y listo" sin entender. Hay otras plataformas para eso.
- Mercados fuera de LATAM inicialmente (EN/pt-BR vendrá después).

---

## 7. Producto MVP (lo que entregamos)

### Tracks de contenido (todos gratis)

| Track | # Lecciones | Estado |
|---|---|---|
| Linux desde cero | 12 | F1 |
| Linux intermedio (servicios, logs, systemd) | 10 | F2 |
| Docker desde cero | 12 | F1 |
| Docker intermedio (compose, networks, multi-stage) | 10 | F3 |
| Bases de datos SQL (MariaDB + Postgres) | 15 | F3 |
| Tu primer sitio web (HTML/CSS/JS, deploy manual) | 10 | F2 |
| PHP / Node / Python hosting (mini-track c/u) | 5 c/u | F4 |
| Git/GitHub desde cero | 8 | F2 |
| Networking fundamentals | 12 | F5 |
| Seguridad básica | 10 | F5 |
| Cloud desde cero (AWS/GCP free tier) | 12 | F5 |
| Bash scripting | 10 | F3 |

### Servicios gratuitos (sin pedir curso terminado)

| Servicio | Límite |
|---|---|
| Sandbox Linux (terminal real en navegador) | 15 min por sesión |
| Hosting PHP | 100 MB disco, subdomain `*.polar-school.pages.dev` |
| Hosting Node.js | 100 MB, sleep tras 30 min sin tráfico |
| Hosting Python | 100 MB, sleep tras 30 min sin tráfico |
| MariaDB | 25 MB, 1 DB por usuario |
| Postgres | 25 MB, 1 DB por usuario |
| Static hosting | Ilimitado |

### Servicios premium (de pago)

| Producto | Precio sugerido | Por qué |
|---|---|---|
| VPS managed 1 vCPU / 512 MB | $5/mes | Cubre costo de infraestructura |
| Docker VM extendido (4h TTL vs 15 min) | $5/mes | Para sesiones largas |
| Docker VM ilimitado | $15/mes | Sin TTL, recursos garantizados |
| Mentoría 1-a-1 (1h) | $40 | Tiempo de instructor |
| Cohorte estándar (4 semanas, 15 alumnos) | $80 c/u | Instructor en vivo |
| Cohorte premium (1-a-3, 4 semanas) | $250 c/u | Más personalizado |
| Certificado profesional verificado | $20 | PDF firmado + verificación online |
| Donación "pay what you want" | Mínimo $3 | GitHub Sponsors, Lemon Squeezy |

---

## 8. Modelo de negocio (comparativa con competidores)

| Plataforma | Gratis | Pago |
|---|---|---|
| **W3Schools** | Todo el contenido | Certificados, sin ads Pro |
| **Cisco NetAcad** | Cursos, sin cert. oficial | Cert. oficial, cursos avanzados |
| **Platzi** | Nada | Suscripción $X/mes, todo gated |
| **FreeCodeCamp** | Todo | Donaciones |
| **Docker PWD** | Playground 4h | — |
| **TonyHost** | Hosting | Upgrades |
| **Polar School (nosotros)** | Contenido + sandbox + hosting básico | Solo infra extendida y mentoría |

**Nuestra diferencia**: somos el único donde el contenido es 100% gratis Y la práctica es real (sandbox), Y además te damos hosting gratis para aplicar lo aprendido.

---

## 9. Stack técnico

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend | Astro 5 + Svelte 5 (islands) | SSG rápido, islands solo para interactivo (terminal) |
| Backend | Node 22 + Hono | Edge-deploy, simple, rápido |
| DB | PostgreSQL 16 | Cursos, usuarios, progreso |
| Sandbox Linux | Docker-in-Docker + xterm.js | Container efímero por sesión (15 min TTL gratis) |
| Sandbox Docker | Docker Compose ephemeral + DinD | Compose editor → runner |
| Hosting gratis | Caddy + php-fpm + per-user nginx vhost | Para hosting PHP/Node/Python |
| DB playground | MariaDB / Postgres ephemeral 25 MB | Schema precargado por lección |
| Auth | Lucia / Auth.js (magic link) | Simple, sin vendor lock |
| Hosting del proyecto | Cloudflare Pages + Workers | Gratis hasta cierto límite, CDN global |
| DNS dinámico | Cloudflare API | `*.polar-school.pages.dev` para hosting gratis |
| i18n | Paraglide JS | es-PA → es → en → pt-BR |
| Search | Pagefind | Static, sin backend |
| Analytics | Cloudflare Web Analytics | Gratis, sin cookies, GDPR-friendly |
| Donaciones | Lemon Squeezy (Merchant of Record) | Sin formalizar, 5% fee |
| Repo | GitHub | Público, CC-BY-SA |

**Sin frameworks de UI**: vanilla CSS o Svelte scoped, sin Tailwind/shadcn/mui.

---

## 10. Plan de fases

| Fase | Duración | Qué se entrega |
|---|---|---|
| **F0: Validación** | 1-2 semanas | Repo + Astro + 1 página con "Linux básico — 20 comandos" + deploy en `polar-school.pages.dev` |
| **F1: Currículum mínimo** | 2-3 semanas | 4 tracks completos (Linux, Docker, primer sitio, bases de datos) ~50 lecciones |
| **F2: Sandbox real** | 3-4 semanas | Terminal Linux ephemeral en navegador (xterm.js + Docker container, 15 min TTL) |
| **F3: Auth + progreso** | 2 semanas | Login con magic link, progreso en la nube, badges básicos |
| **F4: Hosting gratis MVP** | 4+ semanas | PHP + Node + Python + DB 25 MB por usuario |
| **F5: Marketplace + mentorías** | 4+ semanas | Cohortes pagas, marketplace para otros instructores |
| **F6: Multi-idioma** | ongoing | EN, pt-BR |
| **F7: Mobile app PWA** | 2 semanas | Instalar como app, offline-first |

**Total realista a MVP funcional**: 4-6 meses con trabajo full-time solo.

---

## 11. Tu visión personal (lo que me dijiste)

> "Una plataforma educativa gratuita como w3schools pero con un enfoque más amplio o más simple. Compiladores o Linux en vivo full recortado, contenedores que se resetean súper pequeños. Docker y Docker compose en vivo usable real. Bases de datos y hosting PHP/Node gratis pero super pequeño. Una página para aprender lo básico de Linux los comandos principales entender cada uno, de la forma más simple y fácil posible, español first, y docker."

> "Inspirado por w3school, Cisco netacademy, Docker con sus máquinas virtuales de prueba, TonyHost o como se llame la organización de USA que ofrece hosting gratuito, y otros que ofrecían MariaDB gratuita súper pequeñas desde 5 megas, 10, 20, hasta 100."

> "Que ofrecemos o más bien porque aprender aun con opciones all-in-one como Vercel y Railway. Mi país es Panamá, pero para LATAM está bien apuntar en inicio."

> "Primero gratis lo más simple: hosting PHP, Node, Python básico, DB. Y solo por donación/cobro lo que es VPS, Docker VM expandido o ilimitado el tiempo."

> "Decidir si ser org y pedir donaciones, y ya aparte pago/donación por clase privada en vivo. O no ser org, si no una especie de negocio/startup que apoya, y además facilita clases, con cursos de pago tipo Cisco o Platzi."

> "No obligar a terminar los cursos para dar acceso a tener DB gratis, hosting gratis, eso solo es agregado. Para VPS con round-robin, Nginx y eso, podría ser más bien un curso pago con opción a curso en tiempo real y cosas así."

> "Puedo iniciar y comenzar a cobrar por una pasarela de pago o por mi cuenta, pero es que la pasarela de pago no va a aceptar mi registro sin documentación. Quizá puede que sí inicie simplemente ofreciendo conocimiento e ir pidiendo donación, y ya luego veo qué tomo."

> "Excelente, vamos con eso, primero sin comprar dominio .org, solo con Cloudflare Pages más nuestro VPS como backend."

---

## 12. Métricas de éxito

### Mes 1-3 (F0-F1): Validación
- **Lectores únicos**: 500+
- **Donaciones**: aunque sea $50 total (prueba que alguien paga)
- **Tiempo promedio en página**: >3 min (lectura real, no rebote)
- **Comentarios cualitativos**: 5+ personas dicen "lo recomendaría"

### Mes 4-6 (F2-F3): Engagement
- **Usuarios que completan 1 track**: 50+
- **Usuarios activos semanales**: 200+
- **Sesiones de sandbox iniciadas**: 500+
- **Donaciones recurrentes**: $100+/mes

### Mes 7-12 (F4-F5): Monetización
- **Suscriptores pagos**: 15-20 (punto de equilibrio)
- **MRR (Monthly Recurring Revenue)**: $200-500
- **Cohortes cerradas**: 2-3 por trimestre
- **Hosts activos en hosting gratis**: 50+

### Año 2: Escala
- **MRR**: $2000-5000
- **Usuarios activos mensuales**: 5000+
- **Tracks completados**: 12+
- **Marketplace con otros instructores**: 5+ cursos

---

## 13. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Nadie dona | Alta | Bajo (no pierdes plata) | Validas con F0 antes de invertir |
| Costos de VPS explotan | Media | Medio | Empiezas con 1 VPS, escalás cuando hay tracción |
| Burnout del founder | Alta | Alto | Pace realista, F0-F1 en 2 meses no en 2 semanas |
| Alguien copia el currículum | Alta | Bajo | Es CC-BY-SA, está bien. Tu moat es la comunidad y el sandbox |
| Lemon Squeezy cambia fees | Baja | Bajo | Migrar a TiloPay/PayPal es 1 día |
| Panamá cierra el registro de S.A. a extranjeros | Muy baja | Medio | Operás desde EE.UU. con Stripe Atlas si pasa |
| La gente prefiere YouTube gratis | Alta | Bajo | Sí, y está bien. Llegamos a los que valoran currículum + práctica |
| Otro proyecto igual surge en LATAM | Media | Medio | Nos diferenciamos por el sandbox real + hosting gratis |

---

## 14. Open questions (a decidir)

| # | Pregunta | Estado |
|---|---|---|
| 1 | ¿Nombre final del producto? | Provisional: "Polar School" |
| 2 | ¿Dominio `.org` o `.com` o nada? | Provisional: ninguno (Cloudflare Pages URL) |
| 3 | ¿Tú solo o buscas co-founders? | Provisional: solo,招募 después |
| 4 | ¿Lemon Squeezy + PayPal como pasarelas iniciales? | Sí, decidido |
| 5 | ¿Formalizar como S.A. cuándo? | Cuando haya tracción real ($200+/mes) |
| 6 | ¿Currículum open source desde día 1? | Sí, CC-BY-SA |
| 7 | ¿Sandbox desde F0 o solo contenido al inicio? | Solo contenido al inicio (F0-F1), sandbox en F2 |
| 8 | ¿Cohorte becada gratuita además de las pagas? | Sí, 1/mes con 10 cupos |
| 9 | ¿Comunidad en Discord desde F0? | Sí, link en la página |
| 10 | ¿Multi-idioma desde F0 o solo es al inicio? | Solo es al inicio, multi-idioma en F6 |

---

## 15. Inspiración one-liner

> **"La infraestructura que el mundo te enseña en inglés, en español. Sin Vercel-cults. Sin Cisco-installs-de-2GB. Directo al grano."**

---

## 16. Créditos

- **Founder**: David "Polar" Pollard (Panamá, Panamá)
- **Stack base**: Astro, Svelte, Cloudflare, PostgreSQL, Docker
- **Inspiración**: W3Schools, Cisco NetAcad, Platzi, FreeCodeCamp, Docker PWD, TonyHost, db4free, Khan Academy, Mozilla MDN
- **Hueco identificado por**: la ausencia de contenido serio de infra en español-latino

---

*Próximo paso: implementar F0. Ver [`README.md`](./README.md) para instrucciones de desarrollo.*
