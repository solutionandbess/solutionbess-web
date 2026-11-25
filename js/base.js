// Comportamiento base del sitio. Mejora progresiva: la página se lee completa sin este archivo.
//   1) la barra queda fija y pasa a sólida al desplazar;
//   2) el menú marca la sección que se está leyendo;
//   3) el video de la portada corre sólo en pantallas anchas, sin ahorro de datos y sin «reducir movimiento»;
//   4) el menú de celular se cierra al elegir una sección o con Escape;
//   5) el flujo de energía del unifilar se anima sólo si la persona lo pide con su botón.
(() => {
  const raiz = document.documentElement;
  raiz.classList.add("js");

  const reducir = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ancha = window.matchMedia("(min-width: 900px)");

  // ---------- 1 y 2. Barra y menú ----------
  const barra = document.getElementById("barra");
  const fijaSolida = barra && barra.classList.contains("estatica");
  const enlaces = [...document.querySelectorAll(".menu a[href^='#']")];
  const secciones = enlaces.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
  let pendiente = false;
  function pintar() {
    pendiente = false;
    if (barra && !fijaSolida) {
      // Con el menú de celular abierto la barra sigue sólida aunque la página esté arriba del todo
      // (offsetWidth descarta un menú que quedó abierto pero oculto al agrandar la ventana).
      const abierto = document.querySelector(".menu-movil[open]");
      barra.classList.toggle("solida", window.scrollY > 24 || !!(abierto && abierto.offsetWidth));
    }
    if (!secciones.length) return;
    const corte = (barra ? barra.offsetHeight : 0) + 140;
    let actual = null;
    secciones.forEach((s) => { if (s.getBoundingClientRect().top <= corte) actual = s; });
    enlaces.forEach((a) => {
      const si = actual && a.getAttribute("href") === "#" + actual.id;
      if (si) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    });
  }
  window.addEventListener("scroll", () => { if (!pendiente) { pendiente = true; requestAnimationFrame(pintar); } }, { passive: true });
  window.addEventListener("resize", () => { if (!pendiente) { pendiente = true; requestAnimationFrame(pintar); } });
  pintar();

  // ---------- 3. Video de la portada ----------
  const video = document.querySelector(".portada-video");
  const foto = document.querySelector(".portada-foto");
  const boton = document.querySelector(".pausa");
  const textoBoton = boton ? boton.querySelector(".pausa-texto") : null;
  let iniciado = false, pausadoPorPersona = false, aLaVista = true;

  const ahorroDeDatos = () => {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || "")));
  };
  const reproducir = () => { if (!video) return; const p = video.play(); if (p && p.catch) p.catch(() => {}); };

  function iniciarVideo() {
    if (iniciado || !video || !ancha.matches || reducir.matches || ahorroDeDatos()) return;
    iniciado = true;
    // El póster es el mismo fotograma que ya eligió <picture>: no descarga nada extra.
    if (foto && (foto.currentSrc || foto.src)) video.poster = foto.currentSrc || foto.src;
    video.addEventListener("playing", () => { video.classList.add("activo"); if (boton) boton.hidden = false; }, { once: true });
    reproducir();
  }

  if (video) {
    if (document.readyState === "complete") iniciarVideo();
    else window.addEventListener("load", iniciarVideo, { once: true });

    if (ancha.addEventListener) ancha.addEventListener("change", () => {
      if (ancha.matches) { iniciarVideo(); if (iniciado && !pausadoPorPersona && aLaVista) reproducir(); }
      else if (iniciado) video.pause();
    });

    if (boton) boton.addEventListener("click", () => {
      pausadoPorPersona = !pausadoPorPersona;
      if (pausadoPorPersona) video.pause(); else reproducir();
      boton.dataset.pausado = String(pausadoPorPersona); // el ícono cambia con este dato; el texto ya dice el estado
      if (textoBoton) textoBoton.textContent = pausadoPorPersona ? "Reanudar video" : "Pausar video";
    });

    // El video descansa cuando la portada sale de la vista o la pestaña queda oculta.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entradas) => {
        aLaVista = entradas[0].isIntersecting;
        if (!iniciado || pausadoPorPersona) return;
        if (aLaVista && ancha.matches) reproducir(); else video.pause();
      }, { threshold: 0.05 }).observe(video);
    }
    document.addEventListener("visibilitychange", () => {
      if (!iniciado || pausadoPorPersona) return;
      if (document.hidden) video.pause(); else if (aLaVista && ancha.matches) reproducir();
    });
  }

  // ---------- 4. Menú de celular ----------
  const menu = document.querySelector(".menu-movil");
  if (menu) {
    menu.addEventListener("click", (ev) => { if (ev.target.closest && ev.target.closest("a")) menu.open = false; });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && menu.open) { menu.open = false; const s = menu.querySelector("summary"); if (s) s.focus(); }
    });
    document.addEventListener("click", (ev) => { if (menu.open && !menu.contains(ev.target)) menu.open = false; });
    menu.addEventListener("toggle", () => { if (barra && !fijaSolida) barra.classList.toggle("solida", menu.open || window.scrollY > 24); });
  }

  // ---------- 5. Flujo de energía del unifilar ----------
  // Quieto por defecto. El botón sólo aparece si la persona no pidió reducir el movimiento, y el dibujo
  // se anima únicamente mientras ella lo deja encendido.
  const flujo = document.querySelector("[data-flujo]");
  const plano = flujo ? flujo.closest(".plano") : null;
  if (flujo && plano && !reducir.matches) {
    flujo.hidden = false;
    flujo.addEventListener("click", () => {
      const enMarcha = plano.classList.toggle("en-marcha");
      flujo.textContent = enMarcha ? "Detener la animación" : "Animar el flujo de energía";
    });
  }
})();
