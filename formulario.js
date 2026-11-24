// Formulario de solicitudes: guarda cada envío en Supabase (proyecto solution-bess-web).
// La clave publicable está pensada para ir en el navegador: la tabla sólo permite agregar filas,
// no leerlas ni borrarlas (ver web/supabase/001_solicitudes.sql).
(() => {
  const URL_API = "https://faigzicszfwchejjiwrk.supabase.co/rest/v1/solicitudes";
  const CLAVE_PUBLICA = "sb_publishable_Z0_aF3xhIaPyPPPKGtaAQQ_tGMOI600";
  const form = document.getElementById("formulario");
  const estado = document.getElementById("estado");
  if (!form) return;

  const limpio = (v) => (v || "").trim();

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const d = new FormData(form);
    if (limpio(d.get("sitio_web"))) return;            // trampa para robots: un humano no ve este campo
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const opcional = (k) => limpio(d.get(k)) || null;
    const fila = {
      nombre: limpio(d.get("nombre")),
      empresa: limpio(d.get("empresa")),
      cargo: opcional("cargo"),
      correo: limpio(d.get("correo")),
      telefono: opcional("telefono"),
      vencimiento: d.get("vencimiento") || null,
      mensaje: opcional("mensaje"),
      acepta_privacidad: d.get("acepta_privacidad") === "on",
      origen: "web",
    };
    const boton = form.querySelector("button[type=submit]");
    boton.disabled = true;
    estado.className = "estado";
    estado.textContent = "Enviando…";
    try {
      const r = await fetch(URL_API, {
        method: "POST",
        headers: { apikey: CLAVE_PUBLICA, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(fila),
      });
      if (!r.ok) throw new Error(String(r.status));
      form.reset();
      estado.className = "estado ok";
      estado.textContent = "Gracias. Recibimos tu solicitud y te escribiremos a tu correo con el alcance y el valor del diagnóstico.";
    } catch (e) {
      estado.className = "estado error";
      estado.textContent = "No pudimos enviar la solicitud. Escríbenos a consultor.bess@gmail.com.";
    } finally {
      boton.disabled = false;
    }
  });
})();
