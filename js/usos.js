// «Para qué sirve una batería»: pestañas con cinco usos y una curva ilustrativa por uso.
// Sin dependencias. El contenido (títulos y textos) está en el HTML; este archivo sólo arma las pestañas
// y dibuja los gráficos en SVG. Si no corre, la página muestra los cinco usos como una lista normal.
//
// Reglas de los gráficos (skill dataviz): un solo eje; la serie «con batería» lleva el acento y la otra
// va en gris; líneas de 2 px; rellenos como lavado; grilla de línea fina y continua; leyenda siempre
// visible; cursor con lectura de todas las series; mismas lecturas con teclado; tabla de datos equivalente.
// Paleta validada con validate_palette.js sobre blanco: #0A8FA3, #B8830F, #3B6FB6 (pasa las seis pruebas).
// El gris de contexto (#6E7F8B, serie «sin batería») no se distingue de la serie principal por color sino
// por trazo: va discontinuo en el gráfico y en la leyenda.
(() => {
  const raiz = document.querySelector("[data-usos]");
  if (!raiz) return;

  const NS = "http://www.w3.org/2000/svg";
  const css = getComputedStyle(document.documentElement);
  const color = (nombre, respaldo) => (css.getPropertyValue(nombre) || "").trim() || respaldo;
  const C = {
    con: color("--viz-1", "#0A8FA3"),
    descarga: color("--viz-2", "#B8830F"),
    carga: color("--viz-3", "#3B6FB6"),
    sin: color("--viz-gris", "#6E7F8B"),
    grilla: color("--viz-grilla", "#E3E9EC"),
    texto: color("--viz-texto", "#4F6170"),
    tinta: color("--viz-tinta", "#0A1F3A"),
    superficie: color("--viz-superficie", "#FFFFFF"),
  };

  // ---------- utilidades numéricas ----------
  const suave = (t, a, b) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
  const campana = (t, centro, ancho, alto) => alto * Math.exp(-(((t - centro) / ancho) ** 2));
  const meseta = (t, a, b, borde = 0.6) => suave(t, a - borde / 2, a + borde / 2) * (1 - suave(t, b - borde / 2, b + borde / 2));
  const rango = (desde, hasta, paso) => { const v = []; for (let x = desde; x <= hasta + 1e-9; x += paso) v.push(Math.round(x * 1000) / 1000); return v; };

  // Miles: sin separador hasta cuatro cifras y con espacio fino desde cinco (norma panhispánica), para que
  // se lea igual en países que usan punto o coma.
  const entero = (n) => { const s = String(Math.round(Math.abs(n))); const g = s.length > 4 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : s; return (n < 0 ? "−" : "") + g; };
  const decimal = (n, d) => { const f = Math.abs(n).toFixed(d).replace(".", ","); return (n < 0 && +Math.abs(n).toFixed(d) !== 0 ? "−" : "") + f; };
  const hora = (t) => { const h = Math.floor(t + 1e-9); const m = Math.round((t - h) * 60); return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"); };

  // ---------- los cinco casos (curvas ilustrativas, no son datos de clientes) ----------
  const horas = rango(0, 24, 0.5);
  const CASOS = {
    recorte: (() => {
      const limite = 950;
      // Balance del día: la batería carga unos 570 kWh de madrugada y entrega unos 490 kWh en las dos puntas (86 %).
      const sin = horas.map((t) => 620 + 300 * suave(t, 6, 9) - 300 * suave(t, 20, 23) + campana(t, 11.5, 0.9, 260) + campana(t, 18.8, 0.7, 190));
      const con = horas.map((t, i) => Math.min(sin[i], limite) + campana(t, 3, 1.5, 215));
      return { x: horas, sin, con, unidad: "kW", ejeY: "Demanda de la planta (kW)", tipoX: "hora", cada: 1,
        nombreSin: "Demanda sin batería", nombreCon: "Demanda con batería",
        lineas: [{ y: limite, texto: "Límite de recorte" }],
        descripcion: "Curva ilustrativa de la demanda de una planta durante un día. Sin batería, dos picos superan el límite. Con batería, la demanda queda en el límite y la batería se recarga de madrugada." };
    })(),
    desplazamiento: (() => {
      // Balance del día: carga unos 1215 kWh de madrugada y entrega unos 1040 kWh en las horas caras (86 %),
      // sin crear una compra máxima nueva (880 kW con y sin batería).
      const sin = horas.map((t) => 540 + 340 * suave(t, 6.5, 9) - 340 * suave(t, 22, 24));
      const con = horas.map((t, i) => sin[i] + 270 * meseta(t, 1, 5.5) - 260 * meseta(t, 18, 22));
      return { x: horas, sin, con, unidad: "kW", ejeY: "Compra a la red (kW)", tipoX: "hora",
        nombreSin: "Compra sin batería", nombreCon: "Compra con batería",
        bandas: [{ desde: 18, hasta: 22, texto: "Horas de precio alto" }],
        descripcion: "Curva ilustrativa de la compra de energía a la red durante un día. Con batería, la compra sube de madrugada, cuando la batería carga, y baja entre las 18 y las 22, cuando la batería entrega." };
    })(),
    solar: (() => {
      const limite = 6;
      const sin = horas.map((t) => (t > 6.5 && t < 18.5 ? 10 * Math.sin((Math.PI * (t - 6.5)) / 12) ** 1.3 : 0));
      // Balance del día: guarda unos 16,5 MWh al mediodía y entrega unos 14 MWh al anochecer (85 %).
      const con = horas.map((t, i) => Math.min(sin[i], limite) + 3.5 * meseta(t, 18.5, 22.5));
      return { x: horas, sin, con, unidad: "MW", decimales: 1, ejeY: "Potencia (MW)", tipoX: "hora",
        nombreSin: "Generación solar disponible", nombreCon: "Inyección con batería", haciaAfuera: true,
        lineas: [{ y: limite, texto: "Límite de inyección" }],
        descripcion: "Curva ilustrativa de un parque solar con límite de inyección. Al mediodía, la generación que supera el límite carga la batería. Entre las 18:30 y las 22:30, la batería la entrega a la red." };
    })(),
    respaldo: (() => {
      const x = rango(12, 18, 0.125);
      const sin = x.map((t) => (t >= 14 && t < 15.5 ? 0 : 500));
      const con = x.map(() => 500);
      return { x, sin, con, unidad: "kW", ejeY: "Potencia que recibe la carga crítica (kW)", tipoX: "hora", escalon: true,
        nombreSin: "Suministro sin batería", nombreCon: "Suministro con batería", haciaAfuera: true,
        bandas: [{ desde: 14, hasta: 15.5, texto: "Corte de red" }],
        descripcion: "Curva ilustrativa de un corte de red de una hora y media. Sin batería, la carga crítica se queda sin suministro. Con batería, sigue recibiendo su potencia durante todo el corte." };
    })(),
    red: (() => {
      const x = rango(0, 60, 0.5);
      // Las dos curvas parten con la misma pendiente (la fija la inercia del sistema); con batería la caída
      // se frena antes y el mínimo es menor.
      const sinBat = (t) => (t < 5 ? 0 : -(0.42 * (1 - Math.exp(-(t - 5) / 3)) * Math.exp(-(t - 5) / 14) + 0.12 * (1 - Math.exp(-(t - 5) / 10))));
      const conBat = (t) => (t < 5 ? 0 : -(0.42 * (1 - Math.exp(-(t - 5) / 3)) * Math.exp(-(t - 5) / 4.5) + 0.09 * (1 - Math.exp(-(t - 5) / 10))));
      return { x, sin: x.map(sinBat), con: x.map(conBat), unidad: "Hz", decimales: 2, ejeY: "Desviación de la frecuencia (Hz)", tipoX: "segundo",
        nombreSin: "Sistema sin batería", nombreCon: "Sistema con batería", sinRelleno: true,
        marcas: [{ x: 5, texto: "Sale una central" }],
        descripcion: "Curva ilustrativa de la frecuencia de un sistema eléctrico tras la salida de una central. Con una batería que responde en menos de un segundo, la caída se frena antes y es menor." };
    })(),
  };

  // ---------- dibujo ----------
  const el = (nombre, atributos, padre) => {
    const e = document.createElementNS(NS, nombre);
    for (const k in atributos) e.setAttribute(k, atributos[k]);
    if (padre) padre.appendChild(e);
    return e;
  };
  const html = (nombre, clase, texto, padre) => {
    const e = document.createElement(nombre);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    if (padre) padre.appendChild(e);
    return e;
  };
  const pasoLindo = (maximo, cuantos) => {
    const bruto = maximo / cuantos; const pot = 10 ** Math.floor(Math.log10(bruto)); const r = bruto / pot;
    return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * pot;
  };

  function dibujar(figura, clave) {
    const d = CASOS[clave];
    if (!d) return;
    const leyendaVieja = figura.querySelector(".viz-leyenda");
    const estabaAbierta = figura.querySelector(".viz-tabla") && !figura.querySelector(".viz-tabla").hidden;
    figura.querySelectorAll(".viz-lienzo, .viz-leyenda, .viz-acciones, .viz-tabla").forEach((n) => n.remove());
    const pie = figura.querySelector("figcaption");

    const lienzo = html("div", "viz-lienzo");
    figura.insertBefore(lienzo, pie);
    const W = Math.max(300, Math.round(lienzo.clientWidth || figura.clientWidth || 640));
    const angosto = W < 520;
    const H = angosto ? 250 : 320;
    const m = { arriba: 26, derecha: 14, abajo: 34, izquierda: d.unidad === "Hz" ? 52 : 46 };
    const ancho = W - m.izquierda - m.derecha, alto = H - m.arriba - m.abajo;
    const dec = d.decimales || 0;
    const fmt = (v) => (dec ? decimal(v, dec) : entero(v));

    const todos = d.sin.concat(d.con);
    const minimo = Math.min(...todos, ...(d.lineas || []).map((l) => l.y)), maximo = Math.max(...todos, ...(d.lineas || []).map((l) => l.y));
    let y0, y1, paso;
    if (minimo < 0) { paso = pasoLindo(-minimo, 4); y0 = -Math.ceil(-minimo / paso) * paso; y1 = 0; }
    else if (minimo > maximo * 0.4) {
      // Las curvas viven lejos del cero: el eje parte de un valor redondo cercano (son líneas, no barras).
      paso = pasoLindo((maximo - minimo) * 1.6, 4);
      y0 = Math.max(0, Math.floor((minimo - paso * 0.4) / paso) * paso);
      y1 = Math.ceil((maximo - paso * 0.02) / paso) * paso;
    }
    else { paso = pasoLindo(maximo * 1.08, 4); y0 = 0; y1 = Math.ceil((maximo - paso * 0.02) / paso) * paso; }
    // Las marcas del eje llevan decimales sólo si el paso los necesita.
    const decEje = Number.isInteger(paso) ? 0 : dec;
    const fmtEje = (v) => (decEje ? decimal(v, decEje) : entero(v));
    const x0 = d.x[0], x1 = d.x[d.x.length - 1];
    const px = (v) => m.izquierda + ((v - x0) / (x1 - x0)) * ancho;
    const py = (v) => m.arriba + (1 - (v - y0) / (y1 - y0)) * alto;

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", tabindex: "0", class: "viz-svg", "aria-label": d.descripcion + " Los valores exactos están en la tabla de datos que sigue al gráfico." }, lienzo);

    // bandas de contexto (por detrás de todo)
    (d.bandas || []).forEach((b) => {
      el("rect", { x: px(b.desde), y: m.arriba, width: px(b.hasta) - px(b.desde), height: alto, fill: C.tinta, opacity: 0.05 }, svg);
      // El rótulo va centrado sobre la banda, pero nunca se sale del lienzo (en celular la banda queda pegada al borde).
      const rot = el("text", { y: m.arriba - 9, "text-anchor": "middle", class: "viz-rotulo" }, svg);
      rot.textContent = b.texto;
      const medio = ((rot.getComputedTextLength && rot.getComputedTextLength()) || b.texto.length * 7.4) / 2;
      rot.setAttribute("x", Math.max(m.izquierda + medio, Math.min(W - 2 - medio, (px(b.desde) + px(b.hasta)) / 2)));
    });

    // grilla y eje Y
    for (let v = y0; v <= y1 + paso / 1000; v += paso) {
      const y = Math.round(py(v)) + 0.5;
      el("line", { x1: m.izquierda, x2: W - m.derecha, y1: y, y2: y, stroke: C.grilla, "stroke-width": 1 }, svg);
      el("text", { x: m.izquierda - 8, y: y + 4, "text-anchor": "end", class: "viz-eje" }, svg).textContent = fmtEje(Math.abs(v) < 1e-9 ? 0 : v);
    }
    // eje X
    const pasoX = d.tipoX === "segundo" ? (angosto ? 20 : 10) : x1 - x0 <= 8 ? (angosto ? 2 : 1) : angosto ? 6 : 4;
    for (let v = Math.ceil(x0 / pasoX) * pasoX; v <= x1 + 1e-9; v += pasoX) {
      el("text", { x: px(v), y: H - m.abajo + 18, "text-anchor": v === x1 ? "end" : v === x0 ? "start" : "middle", class: "viz-eje" }, svg).textContent = d.tipoX === "segundo" ? v + " s" : v + " h";
    }

    // rellenos entre las dos curvas: descarga (la batería entrega) y carga (la batería toma)
    const camino = (ys) => d.x.map((t, i) => {
      if (d.escalon && i > 0) return `L${px(t).toFixed(1)},${py(ys[i - 1]).toFixed(1)} L${px(t).toFixed(1)},${py(ys[i]).toFixed(1)}`;
      return (i ? "L" : "M") + px(t).toFixed(1) + "," + py(ys[i]).toFixed(1);
    }).join(" ");
    if (!d.sinRelleno) {
      const entre = (arriba, abajo) => {
        let p = "";
        if (d.escalon) {
          // curva escalonada: un rectángulo por tramo, con el valor que rige desde ese instante
          for (let i = 0; i < d.x.length - 1; i++) {
            if (arriba[i] <= abajo[i]) continue;
            p += "M" + px(d.x[i]).toFixed(1) + "," + py(arriba[i]).toFixed(1) + "H" + px(d.x[i + 1]).toFixed(1) + "V" + py(abajo[i]).toFixed(1) + "H" + px(d.x[i]).toFixed(1) + "Z ";
          }
          return p || "M0,0";
        }
        d.x.forEach((t, i) => { p += (i ? "L" : "M") + px(t).toFixed(1) + "," + py(Math.max(arriba[i], abajo[i])).toFixed(1) + " "; });
        for (let i = d.x.length - 1; i >= 0; i--) p += "L" + px(d.x[i]).toFixed(1) + "," + py(abajo[i]).toFixed(1) + " ";
        return p + "Z";
      };
      // Por defecto las curvas son lo que se toma de la red: si «con batería» queda por debajo, la batería entrega.
      // En los casos «hacia afuera» (lo que se inyecta o lo que recibe la carga) el sentido es el contrario.
      el("path", { d: entre(d.sin, d.con), fill: d.haciaAfuera ? C.carga : C.descarga, opacity: 0.2 }, svg);
      el("path", { d: entre(d.con, d.sin), fill: d.haciaAfuera ? C.descarga : C.carga, opacity: 0.2 }, svg);
    }

    // líneas de referencia (límites) y marcas de instante
    (d.lineas || []).forEach((l) => {
      const y = Math.round(py(l.y)) + 0.5;
      el("line", { x1: m.izquierda, x2: W - m.derecha, y1: y, y2: y, stroke: C.tinta, "stroke-width": 1, opacity: 0.55 }, svg);
      // En pantallas angostas la curva pasa por encima del rótulo: ahí el límite se nombra en la leyenda.
      if (!angosto) el("text", { x: m.izquierda + 4, y: y - 6, class: "viz-rotulo" }, svg).textContent = l.texto;
    });
    (d.marcas || []).forEach((k) => {
      el("line", { x1: px(k.x), x2: px(k.x), y1: m.arriba, y2: m.arriba + alto, stroke: C.tinta, "stroke-width": 1, opacity: 0.55 }, svg);
      el("text", { x: px(k.x) + 7, y: m.arriba + 15, class: "viz-rotulo" }, svg).textContent = k.texto;
    });

    // las dos series: contexto en gris y a trazos (no depende sólo del color) y, encima, la serie con batería
    el("path", { d: camino(d.sin), fill: "none", stroke: C.sin, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "butt", "stroke-dasharray": "6 4" }, svg);
    el("path", { d: camino(d.con), fill: "none", stroke: C.con, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);

    // cursor
    const cursor = el("g", { class: "viz-cursor", visibility: "hidden" }, svg);
    const hilo = el("line", { y1: m.arriba, y2: m.arriba + alto, stroke: C.tinta, "stroke-width": 1, opacity: 0.5 }, cursor);
    const p1 = el("circle", { r: 5, fill: C.sin, stroke: C.superficie, "stroke-width": 2 }, cursor);
    const p2 = el("circle", { r: 5, fill: C.con, stroke: C.superficie, "stroke-width": 2 }, cursor);
    el("rect", { x: m.izquierda, y: m.arriba, width: ancho, height: alto, fill: "transparent", class: "viz-zona" }, svg);

    const globo = html("div", "viz-globo", null, lienzo);
    globo.hidden = true;
    let indice = -1;
    const mostrar = (i) => {
      indice = Math.max(0, Math.min(d.x.length - 1, i));
      const t = d.x[indice], a = d.sin[indice], b = d.con[indice];
      const X = px(t);
      hilo.setAttribute("x1", X); hilo.setAttribute("x2", X);
      p1.setAttribute("cx", X); p1.setAttribute("cy", py(a));
      p2.setAttribute("cx", X); p2.setAttribute("cy", py(b));
      cursor.setAttribute("visibility", "visible");
      globo.textContent = "";
      html("p", "viz-globo-t", d.tipoX === "segundo" ? decimal(t, 1) + " s" : hora(t), globo);
      const fila = (clase, nombre, valor) => { const f = html("p", "viz-globo-f", null, globo); html("span", "viz-llave " + clase, null, f); html("strong", null, valor, f); html("span", "viz-globo-n", nombre, f); };
      fila("viz-llave-con", d.nombreCon, fmt(b) + " " + d.unidad);
      fila("viz-llave-sin", d.nombreSin, fmt(a) + " " + d.unidad);
      if (!d.sinRelleno) {
        const dif = a - b; const umbral = dec ? 0.05 : 0.5;
        if (Math.abs(dif) >= umbral) html("p", "viz-globo-b", ((dif > 0) !== !!d.haciaAfuera ? "La batería entrega " : "La batería carga ") + fmt(Math.abs(dif)) + " " + d.unidad, globo);
      }
      globo.hidden = false;
      const anchoGlobo = globo.offsetWidth || 190;
      const izquierda = X + 14 + anchoGlobo > W ? X - 14 - anchoGlobo : X + 14;
      // Si no cabe a ningún lado del cursor (celular, franja central), baja debajo del eje para no tapar el dato.
      const sinLugar = izquierda < 0;
      globo.style.left = (sinLugar ? Math.max(0, Math.min(W - anchoGlobo, X - anchoGlobo / 2)) : izquierda) + "px";
      globo.style.top = (sinLugar ? H - m.abajo + 24 : m.arriba + 4) + "px";
    };
    const ocultar = () => { cursor.setAttribute("visibility", "hidden"); globo.hidden = true; indice = -1; };
    const desdePuntero = (ev) => {
      const r = svg.getBoundingClientRect();
      const valor = x0 + ((ev.clientX - r.left) * (W / r.width) - m.izquierda) / ancho * (x1 - x0);
      let mejor = 0;
      d.x.forEach((t, i) => { if (Math.abs(t - valor) < Math.abs(d.x[mejor] - valor)) mejor = i; });
      mostrar(mejor);
    };
    svg.addEventListener("pointermove", desdePuntero);
    svg.addEventListener("pointerdown", desdePuntero);
    svg.addEventListener("pointerleave", () => { if (document.activeElement !== svg) ocultar(); });
    svg.addEventListener("focus", () => { if (indice < 0) mostrar(Math.round(d.x.length / 2)); });
    svg.addEventListener("blur", ocultar);
    svg.addEventListener("keydown", (ev) => {
      const salto = ev.shiftKey ? 4 : 1;
      if (ev.key === "ArrowRight") { mostrar((indice < 0 ? 0 : indice) + salto); ev.preventDefault(); }
      else if (ev.key === "ArrowLeft") { mostrar((indice < 0 ? 0 : indice) - salto); ev.preventDefault(); }
      else if (ev.key === "Home") { mostrar(0); ev.preventDefault(); }
      else if (ev.key === "End") { mostrar(d.x.length - 1); ev.preventDefault(); }
      else if (ev.key === "Escape") ocultar();
    });

    // leyenda (siempre visible) y tabla equivalente
    const leyenda = leyendaVieja || html("ul", "viz-leyenda");
    leyenda.textContent = "";
    const item = (clase, texto) => { const li = html("li", null, null, leyenda); html("span", "viz-llave " + clase, null, li); html("span", null, texto, li); };
    item("viz-llave-con", d.nombreCon);
    item("viz-llave-sin", d.nombreSin);
    if (!d.sinRelleno) {
      const umbral = dec ? 0.05 : 0.5;
      const sinArriba = d.sin.some((a, i) => a - d.con[i] > umbral), conArriba = d.con.some((b, i) => b - d.sin[i] > umbral);
      if (d.haciaAfuera ? conArriba : sinArriba) item("viz-llave-descarga", "La batería entrega");
      if (d.haciaAfuera ? sinArriba : conArriba) item("viz-llave-carga", "La batería carga");
    }
    if (angosto) (d.lineas || []).forEach((l) => item("viz-llave-limite", l.texto));
    figura.insertBefore(leyenda, pie);

    const acciones = html("p", "viz-acciones");
    const boton = html("button", "viz-ver-datos", "Ver los datos en una tabla", acciones);
    boton.type = "button";
    figura.insertBefore(acciones, pie);
    const tabla = html("div", "viz-tabla");
    tabla.hidden = !estabaAbierta;
    const t = html("table", null, null, tabla);
    html("caption", null, "Valores de la curva ilustrativa", t);
    const cab = html("tr", null, null, html("thead", null, null, t));
    [d.tipoX === "segundo" ? "Segundo" : "Hora", d.nombreSin + " (" + d.unidad + ")", d.nombreCon + " (" + d.unidad + ")"].forEach((x) => { html("th", null, x, cab).scope = "col"; });
    const cuerpo = html("tbody", null, null, t);
    const cada = d.cada || (d.tipoX === "segundo" ? 10 : x1 - x0 <= 8 ? 4 : 2);
    d.x.forEach((v, i) => {
      if (i % cada) return;
      const tr = html("tr", null, null, cuerpo);
      html("th", null, d.tipoX === "segundo" ? entero(v) + " s" : hora(v), tr).scope = "row";
      html("td", null, fmt(d.sin[i]), tr);
      html("td", null, fmt(d.con[i]), tr);
    });
    figura.insertBefore(tabla, pie);
    const rotular = () => { boton.textContent = tabla.hidden ? "Ver los datos en una tabla" : "Ocultar la tabla"; boton.setAttribute("aria-expanded", String(!tabla.hidden)); };
    boton.addEventListener("click", () => { tabla.hidden = !tabla.hidden; rotular(); });
    rotular();
  }

  // ---------- pestañas ----------
  const paneles = [...raiz.querySelectorAll("[data-uso]")];
  if (!paneles.length) return;
  const barra = raiz.querySelector(".usos-tabs") || raiz.insertBefore(document.createElement("div"), paneles[0]);
  barra.className = "usos-tabs";
  barra.setAttribute("role", "tablist");
  barra.setAttribute("aria-label", "Usos de una batería");
  raiz.classList.add("con-pestanas");

  const botones = paneles.map((panel, i) => {
    const titulo = panel.querySelector("h3");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "usos-tab";
    b.id = "tab-" + panel.id;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-controls", panel.id);
    b.textContent = titulo ? titulo.textContent : "Uso " + (i + 1);
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", b.id);
    panel.setAttribute("tabindex", "0");
    barra.appendChild(b);
    return b;
  });

  let activo = -1;
  const redibujar = () => {
    const panel = paneles[activo];
    const figura = panel && panel.querySelector("figure[data-viz]");
    if (figura) { figura.hidden = false; dibujar(figura, figura.dataset.viz); }
  };
  const activar = (i, conFoco) => {
    activo = (i + paneles.length) % paneles.length;
    paneles.forEach((p, k) => { p.hidden = k !== activo; });
    botones.forEach((b, k) => { b.setAttribute("aria-selected", String(k === activo)); b.tabIndex = k === activo ? 0 : -1; });
    if (conFoco) botones[activo].focus();
    redibujar();
  };
  botones.forEach((b, i) => {
    b.addEventListener("click", () => activar(i, false));
    b.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowRight" || ev.key === "ArrowDown") { activar(activo + 1, true); ev.preventDefault(); }
      else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") { activar(activo - 1, true); ev.preventDefault(); }
      else if (ev.key === "Home") { activar(0, true); ev.preventDefault(); }
      else if (ev.key === "End") { activar(paneles.length - 1, true); ev.preventDefault(); }
    });
  });
  activar(0, false);

  let anchoPrevio = raiz.clientWidth, espera = 0;
  const alCambiarTamano = () => {
    if (Math.abs(raiz.clientWidth - anchoPrevio) < 8) return;
    anchoPrevio = raiz.clientWidth;
    clearTimeout(espera);
    espera = setTimeout(redibujar, 120);
  };
  if ("ResizeObserver" in window) new ResizeObserver(alCambiarTamano).observe(raiz);
  else window.addEventListener("resize", alCambiarTamano);
})();
