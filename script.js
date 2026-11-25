// Pega aquí la URL de tu Apps Script publicado como "Aplicación web" (ver LEEME.md)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw1l0zXGdljV7vPrvnxoqAWrswFHM2wQfHNqkt0FPXYK75Fq8MBydeF28d0hNwAHkRt/exec';

// Al recargar la página (o volver a ella) se empieza siempre arriba, sin que el navegador recuerde el scroll
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
window.addEventListener('load', () => window.scrollTo(0, 0));
window.addEventListener('pageshow', (e) => { if (e.persisted) window.scrollTo(0, 0); });

// Transición de aparición al hacer scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

// Los elementos ".tarde" (resto del bloque Ceremonia) no aparecen hasta que la persona empieza a deslizar,
// aunque en su móvil quepan en la primera pantalla; así al entrar solo se ve el título "Ceremonia".
// Hacienda y Confirmación: cada elemento (tras el título) aparece según se va bajando, como en Ceremonia.
document.querySelectorAll('#hacienda > :not(h2), #confirmacion > :not(h2):not(form), #rsvp > :not(.hp):not(#estado)')
  .forEach((el) => el.classList.add('tarde'));
const tardios = [...document.querySelectorAll('.tarde')];
function revelarTardios() {
  // Al volver arriba del todo, se vuelve a ocultar todo salvo el título "Ceremonia"
  if (window.scrollY < 10) { tardios.forEach((el) => el.classList.remove('visible')); return; }
  if (window.scrollY < 30) return;
  tardios.forEach((el) => {
    if (!el.classList.contains('visible') && el.getBoundingClientRect().top < window.innerHeight * 0.9) {
      el.classList.add('visible');
    }
  });
}
window.addEventListener('scroll', revelarTardios, { passive: true });
revelarTardios();

// Zoom suave de la foto fija según se avanza en la página: 1 -> 1.1
const foto = document.querySelector('.foto img');
function zoom() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const progreso = max > 0 ? Math.min(1, window.scrollY / max) : 0;
  foto.style.setProperty('--zoom', (1 + 0.1 * progreso).toFixed(4));
}
window.addEventListener('scroll', () => requestAnimationFrame(zoom), { passive: true });
window.addEventListener('resize', zoom);
zoom();

// Menú: al hacer clic, la sección se centra en vertical respecto a la foto fija de la izquierda
const fotoFija = document.querySelector('.foto');
document.querySelectorAll('.menu a').forEach((a) => {
  a.addEventListener('click', (e) => {
    const el = document.querySelector(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault();
    const cab = document.querySelector('.top').offsetHeight;
    // centro de la foto en pantalla cuando está fija (sticky)
    const centroFoto = parseFloat(getComputedStyle(fotoFija).top) + fotoFija.offsetHeight / 2;
    const arriba = el.offsetParent.getBoundingClientRect().top + window.scrollY + el.offsetTop; // ignora la animación de aparición
    let destino = arriba + el.offsetHeight / 2 - centroFoto;       // bloque centrado con la foto
    const margenSup = cab + 16;
    if (arriba - destino < margenSup) destino = arriba - margenSup; // si no cabe, alineado arriba (junto a la foto)
    window.scrollTo({ top: Math.max(0, destino), behavior: 'smooth' });
  });
});

// Mapas: calles y edificios en gris, sin nombres, con un círculo ocre; al hacer clic abren Google Maps
// Mapa vectorial gratuito (OpenFreeMap): se descargan los estilos, se quitan todas las capas de texto y se pintan en gris
const GRISES = {
  background: '#ececec', landuse_residential: '#ececec', park: '#e2e2e2', water: '#b9d9ec',
  building: '#cdcdcd',
};
const AZUL_RIO = '#8cc3e6'; // ríos y agua en azul claro
fetch('https://tiles.openfreemap.org/styles/positron')
  .then((r) => r.json())
  .then((estilo) => {
    estilo.layers = estilo.layers.filter((l) => l.type !== 'symbol' && l.id !== 'waterway'); // sin nombres de calles ni lugares, y sin ríos/arroyos
    estilo.layers.forEach((l) => {
      if (GRISES[l.id]) {
        const prop = l.type === 'background' ? 'background-color' : 'fill-color';
        l.paint = { ...l.paint, [prop]: GRISES[l.id] };
        if (l.id === 'building') { l.paint['fill-opacity'] = 1; delete l.minzoom; }
      } else if (l.type === 'line' && /^highway_(minor|major_inner|path)/.test(l.id)) {
        l.paint = { ...l.paint, 'line-color': '#ffffff' };
      }
    });
    document.querySelectorAll('.lienzo').forEach((el) => {
      const centro = [parseFloat(el.dataset.lng), parseFloat(el.dataset.lat)]; // punto [lng, lat]
      const vista = el.dataset.mapLng ? [parseFloat(el.dataset.mapLng), parseFloat(el.dataset.mapLat)] : centro; // centro del mapa
      const mapa = new maplibregl.Map({
        container: el, style: estilo, center: vista, zoom: parseFloat(el.dataset.zoom),
        interactive: false, attributionControl: false,
      });
      const punto = document.createElement('div');
      punto.className = 'punto';
      new maplibregl.Marker({ element: punto }).setLngLat(centro).addTo(mapa);
    });
  })
  .catch(() => { document.querySelectorAll('.lienzo').forEach((el) => { el.style.background = '#eee'; }); });

const form = document.getElementById('rsvp');
const estado = document.getElementById('estado');
const detalles = document.getElementById('detalles');

// Oculta los detalles si no asiste
// Muestra u oculta (y activa/desactiva) los campos que dependen de otras respuestas.
// Los campos ocultos quedan desactivados para que no se envíen.
function mostrar(el, visible) {
  el.hidden = !visible;
  el.querySelectorAll('input, textarea').forEach((c) => { c.disabled = !visible; });
}
function actualizar() {
  const asiste = form.asistencia.value !== 'No';
  mostrar(detalles, asiste);
  if (asiste) {
    mostrar(document.getElementById('acompanante-box'), form.con_acompanante.value === 'Sí');
    const trayecto = document.getElementById('trayecto-box'); // desactivado por ahora en el HTML
    if (trayecto) mostrar(trayecto, form.autobus.value === 'Sí');
  }
}
form.addEventListener('change', actualizar);
actualizar();

// Cada campo con data-col="Título" se envía como una columna con ese título, siempre en el orden de la página
// (vacío si está oculto o sin marcar). Para añadir una pregunta basta con ponerle name y data-col en el HTML.
function datosParaEnviar() {
  const datos = new URLSearchParams();
  const orden = [];
  form.querySelectorAll('[data-col]').forEach((el) => {
    const col = el.dataset.col;
    if (!datos.has(col)) { datos.set(col, ''); orden.push(col); }
    if (el.disabled) return;
    if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
    datos.set(col, el.value.trim());
  });
  datos.set('_orden', orden.join('|')); // Apps Script no conserva el orden de los campos, así que se envía aparte
  return datos;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  estado.className = '';
  if (!form.nombre.value.trim() || !form.apellidos.value.trim() || !form.asistencia.value) {
    estado.textContent = 'Por favor, indica tu nombre, tus apellidos y si asistirás.';
    estado.className = 'error';
    return;
  }
  if (!form.acompanante_nombre.disabled && (!form.acompanante_nombre.value.trim() || !form.acompanante_apellidos.value.trim())) {
    estado.textContent = 'Indica el nombre y los apellidos de tu acompañante.';
    estado.className = 'error';
    return;
  }
  if (form.trayecto && !form.trayecto[0].disabled && !form.trayecto.value) {
    estado.textContent = 'Elige si necesitas el autobús de ida, de vuelta o de ida y vuelta.';
    estado.className = 'error';
    return;
  }
  if (form.web.value) return; // honeypot

  if (SCRIPT_URL.startsWith('PEGA_AQUI')) {
    estado.textContent = 'El formulario aún no está conectado a Google Sheets.';
    estado.className = 'error';
    return;
  }

  const btn = form.querySelector('button');
  btn.disabled = true;
  estado.textContent = 'Enviando…';

  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', // Apps Script no devuelve cabeceras CORS
      body: datosParaEnviar(),
    });
    estado.textContent = '¡Gracias! Hemos recibido tu respuesta.';
    estado.className = 'ok';
    form.reset();
    actualizar();
  } catch (err) {
    estado.textContent = 'No se pudo enviar. Inténtalo de nuevo.';
    estado.className = 'error';
  } finally {
    btn.disabled = false;
  }
});
