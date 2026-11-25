// «Latinoamérica»: mapa esquemático de países que funciona como selector de fichas.
// Sin dependencias. Sin JavaScript, las casillas son enlaces a las fichas y todas las fichas se ven en lista.
//
// Contrato del HTML:
//   <div data-latam>
//     <div class="mapa"> <a class="pais" href="#pais-cl" data-pais="cl">…</a> … </div>
//     <div class="fichas"> <article class="ficha" id="pais-cl" data-pais="cl">…</article> … </div>
//   </div>
//   Opcional: <select data-latam-lista> con <option value="cl">Chile</option>… (selector alternativo en celular).
//   Opcional: más enlaces .pais[data-pais] fuera del mapa (por ejemplo <nav class="otros">): eligen ficha igual
//   que las casillas, pero no participan de las flechas del teclado.
(() => {
  const raiz = document.querySelector("[data-latam]");
  if (!raiz) return;
  const casillas = [...raiz.querySelectorAll(".pais[data-pais]")];
  const fichas = [...raiz.querySelectorAll(".ficha[data-pais]")];
  if (!casillas.length || !fichas.length) return;
  const lista = raiz.querySelector("[data-latam-lista]");
  const caja = raiz.querySelector(".fichas");
  const tiene = (codigo) => fichas.some((f) => f.dataset.pais === codigo);

  function elegir(codigo) {
    if (!tiene(codigo)) return;
    fichas.forEach((f) => { f.hidden = f.dataset.pais !== codigo; });
    casillas.forEach((c) => {
      const si = c.dataset.pais === codigo;
      c.classList.toggle("es-actual", si);
      if (si) c.setAttribute("aria-current", "true"); else c.removeAttribute("aria-current");
    });
    if (lista && lista.value !== codigo) lista.value = codigo;
  }

  casillas.forEach((c) => {
    if (!tiene(c.dataset.pais)) return;
    c.addEventListener("click", (ev) => { ev.preventDefault(); elegir(c.dataset.pais); });
  });
  if (lista) lista.addEventListener("change", () => elegir(lista.value));

  // Flechas del teclado, sólo dentro del mapa: mueven el foco a la casilla más cercana en esa dirección,
  // según su posición en pantalla.
  const delMapa = casillas.filter((c) => c.closest(".mapa"));
  raiz.addEventListener("keydown", (ev) => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    const desde = document.activeElement;
    if (!dir || !delMapa.includes(desde)) return;
    const a = desde.getBoundingClientRect();
    const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let mejor = null, costo = Infinity;
    delMapa.forEach((c) => {
      if (c === desde) return;
      const b = c.getBoundingClientRect();
      const dx = b.left + b.width / 2 - ax, dy = b.top + b.height / 2 - ay;
      const avance = dx * dir[0] + dy * dir[1];
      if (avance <= 1) return;
      const desvio = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]);
      const k = avance + desvio * 2.5;
      if (k < costo) { costo = k; mejor = c; }
    });
    if (mejor) { mejor.focus(); ev.preventDefault(); }
  });

  raiz.classList.add("con-selector");
  const inicial = (location.hash.match(/^#pais-([a-z]{2})$/) || [])[1];
  elegir(inicial && tiene(inicial) ? inicial : (raiz.dataset.inicial || fichas[0].dataset.pais));
  // La región se vuelve «viva» recién después de la primera selección: así el lector de pantalla no lee la
  // ficha inicial al cargar y sí anuncia cada cambio de país que haga la persona.
  if (caja) setTimeout(() => caja.setAttribute("aria-live", "polite"), 0);
  window.addEventListener("hashchange", () => {
    const h = (location.hash.match(/^#pais-([a-z]{2})$/) || [])[1];
    if (h && tiene(h)) elegir(h);
  });
})();
