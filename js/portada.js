// Los enlaces antiguos a secciones de la portada siguen llevando a la guía.
(() => {
  const secciones = new Set([
    "usos", "estimador", "tecnologia", "latinoamerica", "perfiles", "preguntas",
    "uso-recorte", "uso-desplazamiento", "uso-solar", "uso-respaldo", "uso-red", "t-normas",
  ]);
  const paises = new Set("cl ar br mx co pe do pa gt uy py ec bo sv cr pr hn ni ve".split(" "));

  function abrirGuia() {
    const ancla = location.hash.slice(1);
    if (secciones.has(ancla) || (ancla.startsWith("pais-") && paises.has(ancla.slice(5)))) {
      location.replace("/ingenieria" + location.search + location.hash);
    }
  }

  window.addEventListener("hashchange", abrirGuia);
  abrirGuia();
})();
