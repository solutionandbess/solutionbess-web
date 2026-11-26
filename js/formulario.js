// Formulario del Diagnóstico de renovación (Chile).
// Valida campo por campo y guarda cada solicitud en Supabase (proyecto solution-bess-web, tabla solicitudes).
// La clave publicable está pensada para ir en el navegador: la tabla sólo permite agregar filas,
// no leerlas ni borrarlas (ver web/supabase/001_solicitudes.sql).
//
// Contrato del HTML:
//   <form id="formulario" method="post" novalidate> … campos con name= nombre, empresa, cargo, correo, telefono,
//   vencimiento, mensaje, zx_control (trampa), acepta_privacidad … <p id="estado" role="status" aria-live="polite"></p></form>
// Cada campo obligatorio va dentro de un contenedor .campo; el error se agrega ahí como <p class="error-campo">.
// El botón de envío llega apagado en el HTML y este archivo lo enciende: sin JavaScript no se envía nada.
(() => {
  const URL_API = "https://faigzicszfwchejjiwrk.supabase.co/rest/v1/solicitudes";
  const CLAVE_PUBLICA = "sb_publishable_Z0_aF3xhIaPyPPPKGtaAQQ_tGMOI600";
  const CORREO_CONTACTO = "contacto@solutionandbess.com";

  const form = document.getElementById("formulario");
  if (!form) return;
  const estado = document.getElementById("estado");
  const boton = form.querySelector("button[type=submit]");
  const limpio = (v) => (v == null ? "" : String(v)).trim();
  const campo = (n) => form.elements[n];

  if (boton) boton.disabled = false;
  form.querySelectorAll("[data-sin-script]").forEach((n) => n.remove());

  const OBLIGATORIOS = {
    nombre: "Escribe tu nombre.",
    empresa: "Escribe el nombre de tu empresa.",
    correo: "Escribe un correo válido, por ejemplo nombre@empresa.com.",
    vencimiento: "Elige cuándo vence tu contrato.",
    acepta_privacidad: "Marca la casilla para que podamos responderte.",
  };
  const ES_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function valido(nombre) {
    const el = campo(nombre);
    if (!el) return false;
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
    if (!estado) return;
    estado.className = "estado" + (clase ? " " + clase : "");
    estado.textContent = texto;
    if (conCorreo) {
      const a = document.createElement("a");
      a.href = "mailto:" + CORREO_CONTACTO + "?subject=" + encodeURIComponent("Diagnóstico de renovación");
      a.textContent = CORREO_CONTACTO;
      estado.append(" ", a, ".");
    }
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!boton || boton.disabled) return;

    // Trampa para robots: una persona no ve este campo. Si llega con algo no se guarda,
    // pero se muestra el correo por si fue un autocompletado del navegador.
    const trampa = campo("zx_control");
    if (limpio(trampa?.value)) {
      trampa.value = "";
      decir("error", "No se envió el formulario. Tus datos siguen aquí. Vuelve a intentarlo o escríbenos a", true);
      return;
    }

    let primero = null;
    Object.entries(OBLIGATORIOS).forEach(([n, mensaje]) => {
      const ok = valido(n);
      marcar(n, ok ? null : mensaje);
      if (!ok && primero === null) primero = campo(n) ?? false;
    });
    if (primero !== null) {
      if (primero) {
        decir("error", "Revisa los campos marcados.");
        primero.focus();
      } else {
        decir("error", "El formulario no está disponible. Escríbenos a", true);
      }
      return;
    }

    const valor = (n) => (campo(n) ? limpio(campo(n).value) : "");
    const fila = {
      nombre: valor("nombre").slice(0, 120),
      empresa: valor("empresa").slice(0, 160),
      cargo: valor("cargo").slice(0, 120) || null,
      correo: valor("correo"),
      telefono: valor("telefono").slice(0, 40) || null,
      vencimiento: valor("vencimiento") || null,
      mensaje: valor("mensaje").slice(0, 2000) || null,
      acepta_privacidad: true,
      origen: "web",
    };

    const editables = [...form.querySelectorAll("input:enabled, select:enabled, textarea:enabled")];
    editables.forEach((el) => { el.disabled = true; });
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
      form.reset();
      decir("ok", "Gracias. Recibimos tu solicitud y te escribiremos a tu correo con el alcance y el valor del diagnóstico.");
    } catch (e) {
      decir("error", "No pudimos enviar tu solicitud. Tus datos siguen en el formulario: inténtalo de nuevo o escríbenos a", true);
    } finally {
      clearTimeout(reloj);
      editables.forEach((el) => { el.disabled = false; });
      boton.disabled = false;
    }
  });
})();
