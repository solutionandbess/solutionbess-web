// Formulario «Cuéntanos tu proyecto» de la portada regional.
// Valida campo por campo, arma un mensaje con país, tipo, etapa y escala, y guarda la solicitud en
// Supabase (proyecto solution-bess-web, tabla solicitudes). La clave publicable está pensada para ir
// en el navegador: la tabla sólo permite agregar filas (ver web/supabase/001_solicitudes.sql).
//
// Contrato del HTML (ver web/latam/BRIEF.md):
//   <form id="form-proyecto" method="post" novalidate data-origen="web-latam"> … campos con name= nombre, empresa, cargo,
//   correo, telefono, pais, tipo, etapa, escala, mensaje, zx_control (trampa), acepta_privacidad …
//   <p id="estado-proyecto" role="status" aria-live="polite"></p></form>
//   <div id="gracias-proyecto" hidden tabindex="-1"> … <span data-gracias="correo"></span> … </div>
// Cada campo obligatorio va dentro de un contenedor .campo; el error se agrega ahí como <p class="error-campo">.
(() => {
  const URL_API = "https://faigzicszfwchejjiwrk.supabase.co/rest/v1/solicitudes";
  const CLAVE_PUBLICA = "sb_publishable_Z0_aF3xhIaPyPPPKGtaAQQ_tGMOI600";
  const CORREO_CONTACTO = "contacto@solutionandbess.com";

  const form = document.getElementById("form-proyecto");
  if (!form) return;
  const estado = document.getElementById("estado-proyecto");
  const gracias = document.getElementById("gracias-proyecto");
  const boton = form.querySelector("button[type=submit]");
  const limpio = (v) => (v == null ? "" : String(v)).trim();
  const campo = (n) => form.elements[n];

  // El botón de envío llega apagado en el HTML: sin este archivo no se envía nada (ni datos en la dirección
  // de la página). Aquí se enciende y se quita el aviso que sólo sirve cuando el script no corre.
  if (boton) boton.disabled = false;
  form.querySelectorAll("[data-sin-script]").forEach((n) => n.remove());

  const OBLIGATORIOS = {
    nombre: "Escribe tu nombre.",
    empresa: "Escribe el nombre de tu empresa u organización.",
    correo: "Escribe un correo válido, por ejemplo nombre@empresa.com.",
    pais: "Elige el país del proyecto.",
    tipo: "Elige el tipo de proyecto.",
    acepta_privacidad: "Marca la casilla para que podamos responderte.",
  };
  const ES_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function valido(nombre) {
    const el = campo(nombre);
    if (!el) return true;
    if (el.type === "checkbox") return el.checked;
    const v = limpio(el.value);
    if (nombre === "correo") return ES_CORREO.test(v) && v.length <= 200;
    if (nombre === "nombre" || nombre === "empresa") return v.length >= 2;
    return v.length > 0;
  }

  function marcar(nombre, mensaje) {
    const el = campo(nombre);
    if (!el) return;
    const caja = el.closest(".campo") || el.parentElement;
    const idError = "error-" + nombre;
    let p = document.getElementById(idError);
    if (mensaje) {
      if (!p) { p = document.createElement("p"); p.className = "error-campo"; p.id = idError; caja.appendChild(p); }
      p.textContent = mensaje;
      el.setAttribute("aria-invalid", "true");
      el.setAttribute("aria-describedby", idError);
    } else {
      if (p) p.remove();
      el.removeAttribute("aria-invalid");
      el.removeAttribute("aria-describedby");
    }
  }

  Object.keys(OBLIGATORIOS).forEach((n) => {
    const el = campo(n);
    if (!el) return;
    const revisar = () => { if (el.getAttribute("aria-invalid") && valido(n)) marcar(n, null); };
    el.addEventListener("input", revisar);
    el.addEventListener("change", revisar);
  });

  function decir(clase, texto, conCorreo) {
    estado.className = "estado" + (clase ? " " + clase : "");
    estado.textContent = texto;
    if (conCorreo) {
      const a = document.createElement("a");
      a.href = "mailto:" + CORREO_CONTACTO + "?subject=" + encodeURIComponent("Proyecto de ingeniería");
      a.textContent = CORREO_CONTACTO;
      estado.append(" ", a, ".");
    }
  }

  // Otros módulos de la página (por ejemplo, el predimensionador) pueden dejar datos listos en el formulario:
  //   document.dispatchEvent(new CustomEvent("sb:prefill", { detail: { mensaje: "…", tipo: "…" } }))
  document.addEventListener("sb:prefill", (ev) => {
    const d = ev.detail || {};
    if (d.tipo && campo("tipo")) {
      const op = [...campo("tipo").options].find((o) => o.value === d.tipo);
      if (op) { campo("tipo").value = d.tipo; marcar("tipo", null); }
    }
    if (d.mensaje && campo("mensaje")) {
      const actual = limpio(campo("mensaje").value);
      campo("mensaje").value = (actual ? actual + "\n\n" : "") + d.mensaje;
    }
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (boton.disabled) return;

    // Trampa para robots: una persona no ve este campo. Si llega con algo no se guarda,
    // pero se muestra el correo por si fue un autocompletado del navegador.
    if (limpio(campo("zx_control") && campo("zx_control").value)) {
      decir("ok", "Gracias. Si no recibes nuestra respuesta, escríbenos a", true);
      return;
    }

    let primero = null;
    Object.entries(OBLIGATORIOS).forEach(([n, mensaje]) => {
      const ok = valido(n);
      marcar(n, ok ? null : mensaje);
      if (!ok && !primero) primero = campo(n);
    });
    if (primero) {
      decir("error", "Revisa los campos marcados.");
      primero.focus();
      return;
    }

    const valor = (n) => (campo(n) ? limpio(campo(n).value) : "");
    const ficha = [
      ["País", valor("pais")], ["Proyecto", valor("tipo")], ["Etapa", valor("etapa")], ["Escala", valor("escala")],
    ].filter(([, v]) => v).map(([k, v]) => k + ": " + v).join(" · ");
    const texto = valor("mensaje");
    const mensaje = (ficha + (texto ? "\n\n" + texto : "")).slice(0, 2000);

    const fila = {
      nombre: valor("nombre").slice(0, 120),
      empresa: valor("empresa").slice(0, 160),
      cargo: valor("cargo").slice(0, 120) || null,
      correo: valor("correo"),
      telefono: valor("telefono").slice(0, 40) || null,
      mensaje,
      acepta_privacidad: true,
      origen: (form.dataset.origen || "web-latam").slice(0, 60),
    };

    boton.disabled = true;
    decir("", "Enviando…");
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 15000);
    try {
      const r = await fetch(URL_API, {
        method: "POST",
        headers: { apikey: CLAVE_PUBLICA, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(fila),
        signal: corte.signal,
      });
      if (!r.ok) throw new Error(String(r.status));
      if (gracias) {
        gracias.querySelectorAll("[data-gracias=correo]").forEach((e) => { e.textContent = fila.correo; });
        form.hidden = true;
        gracias.hidden = false;
        gracias.focus();
      } else {
        form.reset();
        decir("ok", "Gracias. Recibimos tu proyecto y te escribiremos a tu correo.");
      }
    } catch (e) {
      decir("error", "No pudimos enviar tu mensaje. Tus datos siguen en el formulario: inténtalo de nuevo o escríbenos a", true);
    } finally {
      clearTimeout(reloj);
      boton.disabled = false;
    }
  });
})();
