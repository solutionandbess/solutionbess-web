// «Estima el tamaño de tu batería»: orden de magnitud a partir de un uso, una potencia y una duración.
// Sin dependencias. No calcula dinero ni ahorros: sólo tamaños.
//
// Fórmulas (los supuestos están a la vista en la página):
//   energía útil            = potencia × horas
//   energía instalada, baja = energía útil ÷ (ventana de uso 0,90 × eficiencia de descarga 0,93)
//   energía instalada, alta = la baja + 20 % (para sostener la energía útil con los años sin ampliar)
//   potencia del conversor  ≈ potencia a cubrir
//   equivalencia            = gabinetes de ≈ 250 kWh o contenedores de 20 pies de ≈ 5 MWh (tamaños de referencia,
//                             de dos horas o más: en duraciones menores la cantidad la fija la potencia)
//
// Contrato del HTML:
//   <div data-predim> con
//     radios  name="pd_uso"  (value: recorte | desplazamiento | solar | respaldo | red)
//     <input id="pd-potencia">  <select id="pd-unidad"> (kW | MW)  <input type="range" id="pd-horas">
//     salidas [data-pd=horas|ayuda-potencia|ayuda-horas|pcs|util|instalada|equipos|aviso|resumen]
//     <button type="button" data-pd-enviar>  y, opcional, [data-pd-ejemplo] (rótulo del ejemplo sin JavaScript)
//   Al enviar, emite en document el evento «sb:prefill» que escucha proyecto.js.
(() => {
  const raiz = document.querySelector("[data-predim]");
  if (!raiz) return;
  const $ = (sel) => raiz.querySelector(sel);
  const salida = (n) => raiz.querySelector('[data-pd="' + n + '"]');
  const potencia = $("#pd-potencia"), unidad = $("#pd-unidad"), horas = $("#pd-horas");
  if (!potencia || !horas) return;

  const VENTANA = 0.9, EFICIENCIA = 0.93, RESERVA = 1.2;
  const GABINETE = 250, CONTENEDOR = 5000; // kWh, tamaños de referencia
  const POT_GABINETE = 125, POT_CONTENEDOR = 2500; // kW por equipo de referencia (equipos de dos horas o más)
  const MINIMO = 1, MAXIMO = 2000000; // kW

  const USOS = {
    recorte: { nombre: "Recorte de punta", horas: 2, tipo: "Almacenamiento con baterías (BESS)",
      potencia: "Los kW que quieres recortar de tu demanda máxima.",
      duracion: "Punto de partida habitual: de 1 a 2 horas. Depende de cuánto dura tu pico de demanda." },
    desplazamiento: { nombre: "Desplazamiento de energía", horas: 4, tipo: "Almacenamiento con baterías (BESS)",
      potencia: "La potencia que quieres mover de un horario a otro.",
      duracion: "Punto de partida habitual: de 2 a 4 horas. Depende del largo de tus bloques horarios." },
    solar: { nombre: "Solar con almacenamiento", horas: 4, tipo: "Híbrido solar + baterías o microrred",
      potencia: "La potencia que quieres entregar por la tarde y la noche.",
      duracion: "Punto de partida habitual: unas 4 horas de entrega después de la puesta del sol." },
    respaldo: { nombre: "Respaldo y continuidad", horas: 2, tipo: "Almacenamiento con baterías (BESS)",
      potencia: "La potencia de la carga crítica que debe seguir operando.",
      duracion: "Elige la autonomía que necesita tu carga crítica. Para autonomías largas, la batería se combina con generación." },
    red: { nombre: "Servicios de red", horas: 1, tipo: "Almacenamiento con baterías (BESS)",
      potencia: "La potencia que pondrías a disposición del sistema.",
      duracion: "Punto de partida habitual: de 30 minutos a 1 hora. Lo fija el servicio que pida el operador." },
  };

  // ---------- números ----------
  // Miles: sin separador hasta cuatro cifras y con espacio fino desde cinco; coma decimal.
  const miles = (s) => (s.length > 4 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : s);
  const numero = (n, decimales) => {
    const [e, d] = n.toFixed(decimales).split(".");
    const dec = d ? d.replace(/0+$/, "") : "";
    return miles(e) + (dec ? "," + dec : "");
  };
  const cifras = (n, c) => { if (n <= 0) return 0; const p = 10 ** (c - 1 - Math.floor(Math.log10(n))); return Math.round(n * p) / p; };
  const fPotencia = (kW) => (kW < 1000 ? numero(kW, kW < 10 ? 1 : 0) + " kW" : numero(kW / 1000, kW < 100000 ? 2 : 0) + " MW");
  const escalaEnergia = (kWh) => (kWh < 1000 ? [1, "kWh", kWh < 10 ? 1 : 0] : kWh < 10000000 ? [1000, "MWh", kWh < 100000 ? 1 : 0] : [1000000, "GWh", 1]);
  const fEnergia = (kWh) => { const [div, u, d] = escalaEnergia(kWh); return numero(kWh / div, d) + " " + u; };
  const fRango = (a, b) => {
    if (a < 1000 && b >= 1000) return numero(a, 0) + " a " + numero(b, 0) + " kWh"; // no mezclar unidades ni perder resolución
    const [div, u, d] = escalaEnergia(b);
    const x = numero(a / div, d), y = numero(b / div, d);
    return x === y ? "≈ " + x + " " + u : x + " a " + y + " " + u;
  };
  const fHoras = (h) => (h === 0.5 ? "30 minutos" : h === 1 ? "1 hora" : numero(h, 1) + " horas");

  // Lee «1500», «1 500», «1.500», «1,5» o «1.500,5». Con un solo separador seguido de tres cifras hay dos
  // lecturas posibles: se toma como miles en kW y como decimal en MW. El resultado siempre muestra el valor leído.
  function leer(texto, enMW) {
    let s = String(texto || "").replace(/[\s  ]/g, "");
    if (!/^\d[\d.,]*$/.test(s)) return NaN;
    const puntos = (s.match(/\./g) || []).length, comas = (s.match(/,/g) || []).length;
    if (puntos && comas) {
      const decimal = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
      s = s.split(decimal === "." ? "," : ".").join("").replace(decimal, ".");
    } else if (puntos + comas > 1) {
      if (!/^\d{1,3}([.,]\d{3})+$/.test(s)) return NaN; // separadores mal agrupados
      s = s.replace(/[.,]/g, "");
    } else if (puntos + comas === 1) {
      const [entero, resto] = s.split(/[.,]/);
      s = resto.length === 3 && entero.length <= 3 && entero !== "0" && !enMW ? entero + resto : entero + "." + resto;
    }
    return parseFloat(s);
  }

  // ---------- estado ----------
  const radios = [...raiz.querySelectorAll('input[name="pd_uso"]')];
  const usoActual = () => { const r = radios.find((x) => x.checked); return (r && USOS[r.value]) ? r.value : "recorte"; };
  let horasTocadas = false;
  let ultimo = null;
  let esperaResumen = 0;
  let listo = false; // el resumen para lectores de pantalla no se anuncia en el cálculo inicial de la carga

  function calcular() {
    const uso = USOS[usoActual()];
    const enMW = unidad && unidad.value === "MW";
    const leido = leer(potencia.value, enMW);
    const kW = leido * (enMW ? 1000 : 1);
    const h = parseFloat(horas.value);
    const aviso = salida("aviso");

    if (salida("horas")) salida("horas").textContent = fHoras(h);
    horas.setAttribute("aria-valuetext", fHoras(h));
    if (salida("ayuda-potencia")) salida("ayuda-potencia").textContent = uso.potencia;
    if (salida("ayuda-horas")) salida("ayuda-horas").textContent = uso.duracion;

    const valido = Number.isFinite(kW) && kW >= MINIMO && kW <= MAXIMO;
    if (valido) potencia.removeAttribute("aria-invalid"); else potencia.setAttribute("aria-invalid", "true");
    raiz.classList.toggle("predim-sin-dato", !valido);
    const boton = $("[data-pd-enviar]");
    if (boton) boton.disabled = !valido;
    if (!valido) {
      ["pcs", "util", "instalada", "equipos"].forEach((n) => { if (salida(n)) salida(n).textContent = "—"; });
      if (aviso) aviso.textContent = potencia.value.trim() ? "Escribe una potencia entre 1 kW y 2000 MW." : "Escribe la potencia que quieres cubrir.";
      ultimo = null;
      clearTimeout(esperaResumen);
      if (salida("resumen")) salida("resumen").textContent = "";
      return;
    }
    if (aviso) aviso.textContent = "";

    const util = kW * h;
    const baja = cifras(util / (VENTANA * EFICIENCIA), 3);
    const alta = cifras((util / (VENTANA * EFICIENCIA)) * RESERVA, 3);

    // Cantidad de equipos de referencia. Son equipos de dos horas o más (≈ 125 kW por gabinete y ≈ 2,5 MW por
    // contenedor): en duraciones menores, la cantidad la fija la potencia y no la energía.
    let equipos, porPotencia = false;
    const contar = (tam, pot) => {
      const p = Math.ceil(kW / pot);
      let a = Math.max(1, Math.ceil(baja / tam)), b = Math.max(1, Math.ceil(alta / tam));
      if (p > b) { a = b = p; porPotencia = true; } else if (p > a) a = p;
      return [a, b];
    };
    if (Math.max(alta, kW * 2) <= 20 * GABINETE) {
      const [a, b] = contar(GABINETE, POT_GABINETE);
      equipos = (a === b ? a : a + " a " + b) + (b === 1 ? " gabinete" : " gabinetes") + " de ≈ 250 kWh";
      if (!porPotencia && alta < GABINETE / 2) equipos = "un equipo menor que un gabinete de ≈ 250 kWh";
    } else {
      const [a, b] = contar(CONTENEDOR, POT_CONTENEDOR);
      equipos = (a === b ? miles(String(a)) : miles(String(a)) + " a " + miles(String(b))) + (b === 1 ? " contenedor" : " contenedores") + " de 20 pies de ≈ 5 MWh";
    }
    if (aviso && porPotencia) aviso.textContent = "Con esta duración, la cantidad de equipos la fija la potencia y no la energía: los equipos de referencia son de dos horas o más. Hay equipos de más potencia para usos cortos; se define en la ingeniería.";

    if (salida("pcs")) salida("pcs").textContent = "≈ " + fPotencia(kW);
    if (salida("util")) salida("util").textContent = fEnergia(util);
    if (salida("instalada")) salida("instalada").textContent = fRango(baja, alta);
    if (salida("equipos")) salida("equipos").textContent = equipos;
    // Resumen para lectores de pantalla, con una pausa para no interrumpir mientras se escribe.
    clearTimeout(esperaResumen);
    if (salida("resumen") && listo) esperaResumen = setTimeout(() => { salida("resumen").textContent = "Energía instalada sugerida: " + fRango(baja, alta) + ". Equivale a " + equipos + "."; }, 700);

    ultimo = { uso, kW, h, util, baja, alta };
  }

  radios.forEach((r) => r.addEventListener("change", () => {
    const uso = USOS[usoActual()];
    if (!horasTocadas) horas.value = String(uso.horas);
    calcular();
  }));
  potencia.addEventListener("input", calcular);
  if (unidad) unidad.addEventListener("change", calcular);
  horas.addEventListener("input", () => { horasTocadas = true; calcular(); });
  const formulario = potencia.closest("form");
  if (formulario) formulario.addEventListener("submit", (ev) => ev.preventDefault());

  const boton = $("[data-pd-enviar]");
  if (boton) boton.addEventListener("click", () => {
    if (!ultimo) { potencia.focus(); return; }
    const MARCA = "Estimación preliminar (calculada en la web):";
    const texto = MARCA + " uso principal: " + ultimo.uso.nombre + " · potencia a cubrir: " + fPotencia(ultimo.kW) +
      " · duración: " + fHoras(ultimo.h) + " · energía útil: " + fEnergia(ultimo.util) +
      " · energía instalada sugerida: " + fRango(ultimo.baja, ultimo.alta) + ".";
    // El fragmento llega sólo al navegador y se retira al abrir el formulario.
    const datos = new URLSearchParams({ estimacion: texto, tipo: ultimo.uso.tipo });
    location.assign("/#" + datos);
  });

  raiz.classList.add("predim-activo");
  const ejemplo = $("[data-pd-ejemplo]");
  if (ejemplo) ejemplo.hidden = true;
  calcular();
  listo = true;
})();
