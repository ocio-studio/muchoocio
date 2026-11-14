// ============================================================
//  LÓGICA DE MUCHOOCIO
// ============================================================

const REPRODUCIR_EN_FICHA = true;

// ---------- Utilidades ----------
const $ = (sel) => document.querySelector(sel);

const esc = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const tieneNota = (t) => typeof t.nota === "number";
const formatoNota = (n) => `${n.toFixed(1)}/10`;
const nombreSeccion = (id) => {
  const s = SECCIONES.find((s) => s.id === id);
  return s ? s.singular || s.nombre : id;
};

// ---------- Qué se muestra y dónde ----------
const enRanking = () =>
  TITULOS.filter(tieneNota).sort(
    (a, b) =>
      b.nota - a.nota ||
      (a.desempate ?? Infinity) - (b.desempate ?? Infinity) ||
      a.titulo.localeCompare(b.titulo, "es")
  );
const enSeccion = (id) => TITULOS.filter((t) => t.enSeccion && t.tipo === id);
const seccionesVisibles = () => SECCIONES.filter((s) => enSeccion(s.id).length > 0);

// ---------- Enlaces de Drive y portadas ----------
function idDrive(url) {
  const m = String(url).match(/\/d\/([\w-]+)/) || String(url).match(/[?&]id=([\w-]+)/);
  return m ? m[1] : null;
}

function urlPortada(p, carpeta = "portadas", ancho = 600) {
  if (!p) return "";
  if (/^https?:\/\//.test(p)) {
    const id = idDrive(p);
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${ancho}` : p;
  }
  return `img/${carpeta}/${p}`;
}

function urlReproductor(url) {
  const id = idDrive(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : url;
}

// ---------- Piezas de la interfaz ----------
function tarjeta(t, posicion) {
  const src = urlPortada(t.portada);
  return `
    <button class="tarjeta" type="button" data-i="${TITULOS.indexOf(t)}" aria-label="${esc(t.titulo)}">
      <span class="tarjeta__img">
        <span class="tarjeta__vacia">${esc(t.titulo)}</span>
        ${src ? `<img src="${esc(src)}" alt="Portada de ${esc(t.titulo)}" loading="lazy">` : ""}
        ${posicion ? `<span class="tarjeta__pos">#${posicion}</span>` : ""}
        ${tieneNota(t) ? `<span class="tarjeta__nota">${formatoNota(t.nota)}</span>` : ""}
      </span>
      <span class="tarjeta__titulo">${esc(t.titulo)}</span>
    </button>`;
}

function estante(titulo, items, conPosicion, enlace, clase = "") {
  return `
    <section class="estante">
      <div class="estante__cab">
        <h2>${esc(titulo)}</h2>
        ${enlace ? `<a href="#${enlace}">Ver todo →</a>` : ""}
      </div>
      <div class="cuadricula ${clase}">
        ${items.map((t, k) => tarjeta(t, conPosicion ? k + 1 : null)).join("")}
      </div>
    </section>`;
}

// ---------- Título animado del Inicio ----------
let tituloYaAnimado = false;

function tituloHero() {
  const palabras = ["Ocio", ...seccionesVisibles().map((s) => s.nombre)];
  if (enRanking().length) palabras.push("Ranking");

  const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (tituloYaAnimado || reducir || palabras.length < 2) {
    return `<h1>Mucho<span class="grad">Ocio</span></h1>`;
  }

  return `
    <h1 class="titulo-animado" aria-label="MuchoOcio" data-palabras="${palabras.length}">
      <span class="titulo-animado__ciclo" aria-hidden="true">
        <span>Mucho</span>
        <span class="titulo-animado__ventana">
          <span class="titulo-animado__lista">
            ${palabras.map((p) => `<span class="titulo-animado__palabra">${esc(p)}</span>`).join("")}
          </span>
        </span>
      </span>
      <span class="titulo-animado__final" aria-hidden="true">Mucho<span class="grad">Ocio</span></span>
    </h1>`;
}

function iniciarTituloAnimado() {
  const h1 = $(".titulo-animado");
  if (!h1) return;
  tituloYaAnimado = true;

  const lista = h1.querySelector(".titulo-animado__lista");
  const n = Number(h1.dataset.palabras);
  const PASO = 800;
  const TRANSICION = 0.18;

  const marcos = [{ offset: 0, transform: "translateY(0%)" }];
  for (let i = 0; i < n - 1; i++) {
    const fin = (i + 1) / n;
    marcos.push({
      offset: fin - TRANSICION / n,
      transform: `translateY(${(-i * 100) / n}%)`,
      easing: "ease-in-out",
    });
    marcos.push({ offset: fin, transform: `translateY(${(-(i + 1) * 100) / n}%)` });
  }
  marcos.push({ offset: 1, transform: `translateY(${(-(n - 1) * 100) / n}%)` });

  lista
    .animate(marcos, { duration: n * PASO, fill: "forwards" })
    .finished.then(() => h1.classList.add("fin"))
    .catch(() => {});
}

// ---------- Ruleta del Ocio (Inicio) ----------
const RULETA_ORIGEN = "seccion";
const RULETA_MAX = 20;
const RULETA_MAX_PROPIAS = 20;
const RULETA_DURACION = 5000;
const RULETA_COLORES = ["#8b5cf6", "#ec4899", "#6366f1", "#d946ef", "#7c3aed", "#f472b6"];

const ruleta = { filtro: "todo", opciones: [], propias: [], seleccion: new Set(), rotacion: 0, girando: false };

const titulosRuleta = () =>
  TITULOS.filter((t) =>
    RULETA_ORIGEN === "ranking" ? tieneNota(t)
    : RULETA_ORIGEN === "seccion" ? t.enSeccion
    : tieneNota(t) || t.enSeccion
  );

const baseRuleta = () =>
  titulosRuleta().filter((t) => ruleta.seleccion.has(TITULOS.indexOf(t)));

function mezclar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function armarOpciones() {
  if (ruleta.filtro === "propia") {
    ruleta.opciones = ruleta.propias.map((texto) => ({ texto, i: null }));
  } else {
    ruleta.opciones = mezclar(baseRuleta())
      .slice(0, RULETA_MAX)
      .map((t) => ({ texto: t.titulo, i: TITULOS.indexOf(t) }));
  }
}

function vistaRuleta() {
  if (titulosRuleta().length < 2) return "";
  return `
    <section class="ruleta" id="ruleta" aria-labelledby="ruleta-titulo">
      <div class="ruleta__cabecera">
        <h2 id="ruleta-titulo">🎲 Ruleta del Ocio</h2>
        <p>¿No sabes qué ver? Deja que la ruleta decida por ti.</p>
      </div>

      <div class="ruleta__zona">
        <div class="ruleta__puntero" aria-hidden="true"></div>
        <svg id="ruleta-rueda" class="ruleta__rueda" viewBox="0 0 400 400" role="img" aria-label="Ruleta de títulos"></svg>
      </div>

      <div class="ruleta__controles">
        <div id="ruleta-chips" class="ruleta__chips"></div>

        <div class="ruleta__modo">
          <details class="ruleta__elegir">
            <summary id="ruleta-elegir-resumen">Elegir títulos</summary>
            <div id="ruleta-lista" class="ruleta__lista"></div>
          </details>

          <div class="ruleta__propia">
            <input id="ruleta-input" type="text" placeholder="Escribe opciones separadas por comas">
            <button id="ruleta-agregar" class="ruleta__btn ruleta__btn--suave" type="button">Agregar</button>
            <button id="ruleta-limpiar" class="ruleta__btn ruleta__btn--suave" type="button">Limpiar</button>
          </div>
        </div>

        <div class="ruleta__acciones">
          <button id="ruleta-girar" class="ruleta__btn" type="button">Girar la ruleta</button>
        </div>

        <div id="ruleta-resultado" class="ruleta__resultado" aria-live="polite"></div>
      </div>
    </section>`;
}

function pintarChips() {
  const chip = (id, texto) =>
    `<button class="ruleta__chip${id === ruleta.filtro ? " activo" : ""}" type="button" data-chip="${esc(id)}">${esc(texto)}</button>`;

  $("#ruleta-chips").innerHTML = chip("todo", "Todo") + chip("propia", "✏️ Mis opciones");
  $("#ruleta").classList.toggle("ruleta--propia", ruleta.filtro === "propia");
}

function pintarLista() {
  const lista = $("#ruleta-lista");
  if (!lista) return;
  lista.innerHTML = titulosRuleta()
    .map((t) => {
      const i = TITULOS.indexOf(t);
      return `<label class="ruleta__opcion">
        <input type="checkbox" data-sel="${i}"${ruleta.seleccion.has(i) ? " checked" : ""}>
        <span>${esc(t.titulo)}</span>
      </label>`;
    })
    .join("");
}

function dibujarRuleta() {
  const rueda = $("#ruleta-rueda");
  const n = ruleta.opciones.length;

  if (!n) {
    rueda.innerHTML = `
      <circle cx="200" cy="200" r="200" fill="#1e1e32"/>
      <text x="200" y="200" text-anchor="middle" dominant-baseline="central" fill="#a3a3bd" font-size="18">Sin opciones</text>`;
    return;
  }

  const paso = 360 / n;
  const punto = (ang, r) => {
    const rad = ((ang - 90) * Math.PI) / 180;
    return [200 + r * Math.cos(rad), 200 + r * Math.sin(rad)];
  };

  const alBorde = true;
  const margenBorde = 18;
  const alejar = 42;
  const radioHub = 28;

  const tam = n > 16 ? 11 : n > 10 ? 13 : 15;
  const espacio = alBorde ? 200 - margenBorde - radioHub - 10 : 200 - alejar - 12;
  const maxLetras = Math.floor(espacio / (tam * 0.58));
  const xTexto = alBorde ? 400 - margenBorde : 200 + alejar;

  let html = "";
  ruleta.opciones.forEach((op, i) => {
    let color = RULETA_COLORES[i % RULETA_COLORES.length];
    if (n > 1 && i === n - 1 && i % RULETA_COLORES.length === 0) color = RULETA_COLORES[2];

    if (n === 1) {
      html += `<circle cx="200" cy="200" r="200" fill="${color}"/>`;
    } else {
      const [x0, y0] = punto(i * paso, 200);
      const [x1, y1] = punto((i + 1) * paso, 200);
      html += `<path d="M200 200 L${x0} ${y0} A200 200 0 ${paso > 180 ? 1 : 0} 1 ${x1} ${y1} Z" fill="${color}" stroke="#0b0b14" stroke-width="2"/>`;
    }

    const medio = i * paso + paso / 2;
    const texto = op.texto.length > maxLetras ? op.texto.slice(0, maxLetras - 1) + "…" : op.texto;
    html += `<text transform="rotate(${medio - 90} 200 200)" x="${xTexto}" y="200"
      text-anchor="${alBorde ? "end" : "start"}" dominant-baseline="central" fill="#fff" font-size="${tam}" font-weight="700">${esc(texto)}</text>`;
  });

  html += `<circle cx="200" cy="200" r="${radioHub}" fill="#0b0b14" stroke="rgba(255,255,255,0.25)" stroke-width="3"/>`;
  rueda.innerHTML = html;
}

function actualizarControles() {
  if (!$("#ruleta")) return;
  const n = ruleta.opciones.length;
  const ocupado = ruleta.girando;
  const total = titulosRuleta().length;
  const elegidos = baseRuleta().length;

  $("#ruleta-girar").disabled = ocupado || n < 2;
  $("#ruleta-agregar").disabled = ocupado;
  $("#ruleta-limpiar").disabled = ocupado;
  $("#ruleta-input").disabled = ocupado;
  document.querySelectorAll(".ruleta__chip, #ruleta-lista input").forEach((b) => (b.disabled = ocupado));

  $("#ruleta-elegir-resumen").textContent = `Elegir títulos (${elegidos} de ${total})`;
}

function mostrarResultado(op) {
  const cont = $("#ruleta-resultado");
  if (!cont) return;

  const t = op.i !== null ? TITULOS[op.i] : null;
  if (!t) {
    cont.innerHTML = `
      <div class="ruleta__ganador">
        <div>
          <p class="ruleta__pregunta">Resultado</p>
          <p class="ruleta__nombre">${esc(op.texto)}</p>
        </div>
      </div>`;
    return;
  }

  const src = urlPortada(t.portada);
  cont.innerHTML = `
    <div class="ruleta__ganador">
      <span class="ruleta__mini">${src ? `<img src="${esc(src)}" alt="">` : ""}</span>
      <div>
        <p class="ruleta__pregunta">Ganador</p>
        <p class="ruleta__nombre">${esc(t.titulo)}</p>
        ${tieneNota(t) ? `<p class="ruleta__nota">${formatoNota(t.nota)}</p>` : ""}
        <button class="ruleta__btn ruleta__btn--chico" type="button" data-ficha="${op.i}">Ver ficha</button>
      </div>
    </div>`;
}

function refrescarRuleta() {
  if (!$("#ruleta")) return;
  armarOpciones();
  pintarChips();
  dibujarRuleta();
  actualizarControles();
  $("#ruleta-resultado").innerHTML = "";
}

function girarRuleta() {
  const n = ruleta.opciones.length;
  if (ruleta.girando || n < 2) return;

  ruleta.girando = true;
  actualizarControles();
  $("#ruleta-resultado").innerHTML = `<p class="ruleta__pregunta">Girando…</p>`;

  const ganador = Math.floor(Math.random() * n);
  const paso = 360 / n;
  const objetivo = ganador * paso + paso * (0.15 + Math.random() * 0.7);
  const actual = ((ruleta.rotacion % 360) + 360) % 360;
  const resto = (((360 - objetivo - actual) % 360) + 360) % 360;
  ruleta.rotacion += 360 * 6 + resto;

  const rueda = $("#ruleta-rueda");
  const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duracion = reducir ? 0 : RULETA_DURACION;
  rueda.style.transitionDuration = `${duracion}ms`;
  rueda.style.transform = `rotate(${ruleta.rotacion}deg)`;

  let temporizador;
  const terminar = () => {
    clearTimeout(temporizador);
    rueda.removeEventListener("transitionend", terminar);
    ruleta.girando = false;
    mostrarResultado(ruleta.opciones[ganador]);
    actualizarControles();
  };

  if (!duracion) return terminar();
  rueda.addEventListener("transitionend", terminar);
  temporizador = setTimeout(terminar, duracion + 400);
}

function agregarPropias() {
  if (ruleta.girando) return;
  const input = $("#ruleta-input");
  const nuevas = input.value.split(",").map((s) => s.trim()).filter(Boolean);
  input.value = "";
  ruleta.propias = [...ruleta.propias, ...nuevas].slice(0, RULETA_MAX_PROPIAS);
  refrescarRuleta();
  input.focus();
}

function iniciarRuleta() {
  const seccion = $("#ruleta");
  if (!seccion) return;

  ruleta.filtro = "todo";
  ruleta.rotacion = 0;
  ruleta.girando = false;
  ruleta.seleccion = new Set(titulosRuleta().map((t) => TITULOS.indexOf(t))); // al empezar, todos elegidos
  pintarLista();
  refrescarRuleta();

  seccion.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-chip]");
    if (chip && !ruleta.girando) {
      ruleta.filtro = chip.dataset.chip;
      return refrescarRuleta();
    }

    const ficha = e.target.closest("[data-ficha]");
    if (ficha) return abrirFicha(Number(ficha.dataset.ficha));

    const boton = e.target.closest("button");
    if (!boton) return;
    if (boton.id === "ruleta-girar") girarRuleta();
    else if (boton.id === "ruleta-agregar") agregarPropias();
    else if (boton.id === "ruleta-limpiar") {
      ruleta.propias = [];
      refrescarRuleta();
    }
  });

  seccion.addEventListener("change", (e) => {
    const caja = e.target.closest("[data-sel]");
    if (!caja) return;
    const i = Number(caja.dataset.sel);
    if (caja.checked) ruleta.seleccion.add(i);
    else ruleta.seleccion.delete(i);
    refrescarRuleta();
  });

  $("#ruleta-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      agregarPropias();
    }
  });
}

// ---------- Próximamente ----------
const PROX_AUTOPLAY = 2500;

const prox = { actual: 0, temporizador: null, pausado: false, arrastre: false };

function vistaProximamente() {
  const n = PROXIMAMENTE.length;
  if (!n) return "";

  const items = PROXIMAMENTE.map((p, i) => {
    const src = urlPortada(p.imagen, "proximamente", 800);
    return `
      <div class="prox__item" data-prox="${i}">
        <span class="tarjeta__vacia">${esc(p.titulo)}</span>
        ${src ? `<img src="${esc(src)}" alt="${esc(p.titulo)}" draggable="false">` : ""}
        <div class="prox__info">
          <p class="prox__titulo">${esc(p.titulo)}</p>
          ${p.fecha ? `<p class="prox__fecha">${esc(p.fecha)}</p>` : ""}
        </div>
      </div>`;
  }).join("");

  const controles =
    n > 1
      ? `<div class="prox__controles">
           <button class="prox__flecha" type="button" data-prox-nav="-1" aria-label="Anterior">
             <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
           </button>
           <span class="prox__contador" id="prox-contador"></span>
           <button class="prox__flecha" type="button" data-prox-nav="1" aria-label="Siguiente">
             <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
           </button>
         </div>`
      : "";

  return `
    <section class="prox" id="prox" aria-roledescription="carrusel" aria-label="Próximamente">
      <div class="estante__cab"><h2>Próximamente</h2></div>
      <div class="prox__escenario" id="prox-escenario" tabindex="0">${items}</div>
      ${controles}
    </section>`;
}

function pintarProximamente() {
  const items = document.querySelectorAll(".prox__item");
  const n = items.length;

  items.forEach((el, i) => {
    let d = i - prox.actual;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;

    el.style.setProperty("--abs", Math.abs(d));
    el.style.setProperty("--lado", Math.sign(d));
    el.classList.toggle("activo", d === 0);
    el.classList.toggle("lejos", Math.abs(d) > 3);
    el.setAttribute("aria-hidden", d === 0 ? "false" : "true");
  });

  const contador = $("#prox-contador");
  if (contador) contador.textContent = `${prox.actual + 1} DE ${n}`;
}

function irAProx(indice) {
  const n = PROXIMAMENTE.length;
  prox.actual = ((indice % n) + n) % n;
  pintarProximamente();
}

function iniciarAvanceProx() {
  clearInterval(prox.temporizador);
  const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!PROX_AUTOPLAY || reducir || PROXIMAMENTE.length < 2) return;

  prox.temporizador = setInterval(() => {
    if (!$("#prox")) return clearInterval(prox.temporizador); // ya no estás en el Inicio
    if (document.hidden || prox.pausado) return;
    irAProx(prox.actual + 1);
  }, PROX_AUTOPLAY);
}

function iniciarProximamente() {
  clearInterval(prox.temporizador);
  const seccion = $("#prox");
  if (!seccion) return;

  prox.actual = 0;
  prox.pausado = false;
  pintarProximamente();
  iniciarAvanceProx();

  seccion.addEventListener("mouseenter", () => (prox.pausado = true));
  seccion.addEventListener("mouseleave", () => (prox.pausado = false));
  seccion.addEventListener("focusin", () => (prox.pausado = true));
  seccion.addEventListener("focusout", () => (prox.pausado = false));

  seccion.addEventListener("click", (e) => {
    if (prox.arrastre) return;
    const nav = e.target.closest("[data-prox-nav]");
    if (nav) return irAProx(prox.actual + Number(nav.dataset.proxNav));
    const item = e.target.closest(".prox__item");
    if (item) irAProx(Number(item.dataset.prox));
  });

  const escenario = $("#prox-escenario");

  escenario.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); irAProx(prox.actual - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); irAProx(prox.actual + 1); }
  });

  let inicioX = null;
  escenario.addEventListener("pointerdown", (e) => {
    inicioX = e.clientX;
    prox.arrastre = false;
  });
  escenario.addEventListener("pointerup", (e) => {
    if (inicioX === null) return;
    const dx = e.clientX - inicioX;
    inicioX = null;
    if (Math.abs(dx) > 40) {
      prox.arrastre = true;
      irAProx(prox.actual + (dx < 0 ? 1 : -1));
      setTimeout(() => (prox.arrastre = false), 50);
    }
  });
  escenario.addEventListener("pointercancel", () => (inicioX = null));
}

// ---------- Vistas ----------
const TOP_INICIO = 4;

function vistaInicio() {
  const top = enRanking().slice(0, TOP_INICIO);

  let html = `
    <section class="hero">
      ${tituloHero()}
      <p>Anime, series, cartoons y películas para el tiempo libre.</p>
    </section>`;

  if (top.length) {
    html += estante("Mejor puntuados", top, true, "ranking", "cuadricula--cuatro");
  } else {
    html += `<p class="vacio">Todavía no hay títulos con nota. Agrégalas en js/datos.js.</p>`;
  }

  html += vistaRuleta();
  html += vistaProximamente();

  return {
    html,
    despues: () => {
      iniciarTituloAnimado();
      iniciarRuleta();
      iniciarProximamente();
    },
  };
}

// Banner de cada página
function banner(titulo, imagen, esquina = "") {
  const src = imagen ? urlAbsoluta(urlPortada(imagen, "banners", 1600)) : "";
  const estilo = src ? ` style="${esc(`--banner-img: url('${src}')`)}"` : "";
  return `
    <header class="banner"${estilo}>
      <h1>${esc(titulo)}</h1>
      ${esquina ? `<span class="banner__esquina">${esc(esquina)}</span>` : ""}
    </header>`;
}

function vistaSeccion(s) {
  const items = enSeccion(s.id);
  return {
    html: `
      ${banner(s.nombre, s.fondo)}
      <section class="estante">
        <div class="cuadricula">${items.map((t) => tarjeta(t, null)).join("")}</div>
      </section>`,
  };
}

let filtroRanking = "todo";
let busquedaRanking = "";

function pintarRanking() {
  const todos = enRanking();
  const q = busquedaRanking.trim().toLowerCase();
  const lista = todos.filter(
    (t) =>
      (filtroRanking === "todo" || t.tipo === filtroRanking) &&
      t.titulo.toLowerCase().includes(q)
  );
  $("#grid-ranking").innerHTML = lista.length
    ? lista.map((t) => tarjeta(t, todos.indexOf(t) + 1)).join("")
    : `<p class="vacio">No hay resultados.</p>`;
}

function vistaRanking() {
  const todos = enRanking();
  const tipos = SECCIONES.filter((s) => todos.some((t) => t.tipo === s.id));
  if (filtroRanking !== "todo" && !tipos.some((s) => s.id === filtroRanking)) {
    filtroRanking = "todo";
  }
  const boton = (id, nombre) =>
    `<button class="filtro${id === filtroRanking ? " activo" : ""}" type="button" data-filtro="${esc(id)}">${esc(nombre)}</button>`;

  const fondoRanking = typeof FONDO_RANKING === "string" ? FONDO_RANKING : "";
  const cuenta = `${todos.length} ${todos.length === 1 ? "título" : "títulos"}`;

  return {
    html: `
      ${banner("Ranking", fondoRanking, cuenta)}
      <section class="estante">
        <div class="controles">
          <input id="buscar" type="search" placeholder="Buscar por título" value="${esc(busquedaRanking)}">
          <div class="filtros">
            ${boton("todo", "Todo")}
            ${tipos.map((s) => boton(s.id, s.nombre)).join("")}
          </div>
        </div>
        <div id="grid-ranking" class="cuadricula"></div>
      </section>`,
    despues: pintarRanking,
  };
}

// ---------- Menú y rutas ----------
function pintarMenu(activo, visibles, hayRanking) {
  const enlace = (id, texto) =>
    `<a href="#${esc(id)}" class="menu__item${id === activo ? " activo" : ""}">${texto}</a>`;

  $("#menu").innerHTML =
    enlace("inicio", "Inicio") +
    visibles.map((s) => enlace(s.id, esc(s.nombre))).join("") +
    (hayRanking ? enlace("ranking", "Ranking") : "");
}

function ruta() {
  const hash = decodeURIComponent(location.hash.slice(1)) || "inicio";
  const visibles = seccionesVisibles();
  const hayRanking = enRanking().length > 0;
  const seccion = visibles.find((s) => s.id === hash);

  let vista, activo;
  if (hash === "ranking" && hayRanking) {
    vista = vistaRanking();
    activo = "ranking";
  } else if (seccion) {
    vista = vistaSeccion(seccion);
    activo = seccion.id;
  } else {
    vista = vistaInicio();
    activo = "inicio";
  }

  $("#contenido").innerHTML = vista.html;
  if (vista.despues) vista.despues();
  pintarMenu(activo, visibles, hayRanking);
  window.scrollTo(0, 0);
}

// ---------- Ficha (ventana flotante) ----------
let capsActuales = [];
let ultimoFoco = null;

const urlAbsoluta = (ruta) => (ruta ? new URL(ruta, document.baseURI).href : "");

function abrirFicha(i) {
  const t = TITULOS[i];
  if (!t) return;

  const src = urlPortada(t.portada);
  const imgNota = urlPortada(t.imagenNota, "notas", 800);
  const fondo = urlAbsoluta(urlPortada(t.fondo, "fondos", 1600));
  const fondoVideo = t.fondoVideo ? urlAbsoluta(urlPortada(t.fondoVideo, "fondos", 1600)) : fondo;
  const estiloFondo = [
    fondo ? `--fondo-ficha: url('${fondo}')` : "",
    fondoVideo ? `--fondo-video: url('${fondoVideo}')` : "",
  ].filter(Boolean).join("; ");
  const hayCalif = Boolean(imgNota) || tieneNota(t);
  capsActuales = t.enSeccion && Array.isArray(t.capitulos) ? t.capitulos : [];

  $("#modal-contenido").innerHTML = `
    <div class="ficha">
      <header class="ficha__cabecera">
        <button class="ficha__volver" type="button" data-volver aria-label="Volver a la ficha" title="Volver a la ficha">
          <i class="fa-solid fa-square-caret-left" aria-hidden="true"></i>
        </button>
        <h2 id="modal-titulo">${esc(t.titulo)}</h2>
      </header>

      <div class="ficha__cuerpo"${estiloFondo ? ` style="${esc(estiloFondo)}"` : ""}>
        <div class="ficha__grid${hayCalif ? "" : " ficha__grid--sin-calif"}">

          <div class="ficha__portada">
            <span class="tarjeta__vacia">${esc(t.titulo)}</span>
            ${src ? `<img src="${esc(src)}" alt="Portada de ${esc(t.titulo)}">` : ""}
          </div>

          <div class="ficha__info">
            <span class="ficha__tipo">${esc(nombreSeccion(t.tipo))}</span>
            <h3>Sinopsis</h3>
            <p class="ficha__sinopsis">${esc(t.sinopsis || "Sin sinopsis todavía.")}</p>
          </div>

          ${
            hayCalif
              ? `<div class="ficha__calif">
                   <h3>Calificación</h3>
                   ${imgNota ? `<img class="ficha__calif-img" src="${esc(imgNota)}" alt="Calificación de ${esc(t.titulo)}${tieneNota(t) ? ": " + formatoNota(t.nota) : ""}">` : ""}
                   ${tieneNota(t) ? `<p class="ficha__nota">${formatoNota(t.nota)}</p>` : ""}
                 </div>`
              : ""
          }
        </div>

        ${
          capsActuales.length
            ? `<div class="ficha__caps">
                 <h3>Capítulos</h3>
                 ${t.temporada ? `<p class="ficha__temporada">${esc(t.temporada)}</p>` : ""}
                 <div id="reproductor" class="reproductor"></div>
                 <div class="lista-caps">
                   ${capsActuales
                     .map((c, k) => `<button class="cap" type="button" data-cap="${k}">${esc(c.nombre)}</button>`)
                     .join("")}
                 </div>
               </div>`
            : ""
        }
      </div>
    </div>`;

  ultimoFoco = document.activeElement;
  $("#modal").classList.add("abierto");
  $("#modal").setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-abierto");
  $(".modal__cerrar").focus();
}

function cerrarFicha() {
  if (!$("#modal").classList.contains("abierto")) return;
  $("#modal").classList.remove("abierto");
  $("#modal").classList.remove("viendo");
  $("#modal").setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-abierto");
  $("#modal-contenido").innerHTML = "";
  if (ultimoFoco) ultimoFoco.focus({ preventScroll: true });
}

function reproducir(k, boton) {
  const c = capsActuales[k];
  if (!c) return;

  if (!REPRODUCIR_EN_FICHA) {
    window.open(c.drive, "_blank", "noopener");
    return;
  }

  $("#reproductor").innerHTML = `
    <iframe src="${esc(urlReproductor(c.drive))}" title="${esc(c.nombre)}"
            allow="autoplay; fullscreen" allowfullscreen></iframe>`;

  document.querySelectorAll(".cap").forEach((b) => b.classList.toggle("activo", b === boton));
  $("#modal").classList.add("viendo");
}

function volverAFicha() {
  $("#modal").classList.remove("viendo");
  const rep = $("#reproductor");
  if (rep) rep.innerHTML = "";
  document.querySelectorAll(".cap").forEach((b) => b.classList.remove("activo"));
}

// ---------- Eventos ----------
document.addEventListener("click", (e) => {
  const tarj = e.target.closest(".tarjeta");
  if (tarj) return abrirFicha(Number(tarj.dataset.i));

  if (e.target.closest("[data-cerrar]")) return cerrarFicha();

  if (e.target.closest("[data-volver]")) return volverAFicha();

  const cap = e.target.closest(".cap");
  if (cap) return reproducir(Number(cap.dataset.cap), cap);

  const filtro = e.target.closest(".filtro");
  if (filtro) {
    filtroRanking = filtro.dataset.filtro;
    document.querySelectorAll(".filtro").forEach((b) => b.classList.toggle("activo", b === filtro));
    pintarRanking();
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "buscar") {
    busquedaRanking = e.target.value;
    pintarRanking();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cerrarFicha();
});

document.addEventListener("click", (e) => {
  const abierto = document.querySelector(".ruleta__elegir[open]");
  if (abierto && !abierto.contains(e.target)) abierto.removeAttribute("open");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.querySelector(".ruleta__elegir[open]")?.removeAttribute("open");
});

document.addEventListener("error", (e) => {
  if (e.target.tagName === "IMG") e.target.remove();
}, true);

window.addEventListener("hashchange", ruta);

// ---------- Avisos ----------
function validarDatos() {
  const ids = SECCIONES.map((s) => s.id);
  ids.forEach((id) => {
    if (id === "inicio" || id === "ranking") {
      console.warn(`MuchoOcio: el id de sección "${id}" está reservado; usa otro.`);
    }
  });
  TITULOS.forEach((t) => {
    if (!ids.includes(t.tipo)) {
      console.warn(`MuchoOcio: "${t.titulo}" tiene tipo "${t.tipo}", que no existe en SECCIONES.`);
    }
    if (!tieneNota(t) && !t.enSeccion) {
      console.warn(`MuchoOcio: "${t.titulo}" no aparece en ningún lado (sin nota y sin enSeccion).`);
    }
  });
}

// ---------- Arranque ----------
validarDatos();
ruta();
