/**
 * Proxy con seguimiento de redirecciones para los portales oficiales.
 *
 * Los rewrites estáticos devuelven al navegador el 30x del portal tal cual,
 * y su Location apunta al dominio oficial: el navegador lo sigue fuera del
 * proxy y CORS mata la respuesta (le pasa a GVA con las IPs de datacenter).
 * Esta función sigue las redirecciones en el servidor y sirve el cuerpo final
 * ya desde nuestro origen.
 */
const HOSTS = {
  val: 'https://ceice.gva.es',
  clm: 'https://educacion.castillalamancha.es',
  can: 'https://www.gobiernodecanarias.org',
  cyl: 'https://www.educa.jcyl.es',
  mad: 'https://sede.comunidad.madrid',
  cnt: 'https://www.educantabria.es',
  ast: 'https://www.educastur.es',
  nav: 'https://tramitespersonal.navarra.es',
  ext: 'https://profex.educarex.es',
  mel: 'https://www.educacionfpydeportes.gob.es',
};

module.exports = async function handler(req, res) {
  const { region, path, ...params } = req.query;
  const base = HOSTS[region];
  const route = Array.isArray(path) ? path.join('/') : path;

  if (!base || !route || (req.method !== 'GET' && req.method !== 'HEAD')) {
    return res.status(400).json({ error: 'bad request' });
  }

  const url = new URL(`${base}/${route}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        'user-agent': req.headers['user-agent'] ?? 'Mozilla/5.0',
        accept: req.headers['accept'] ?? '*/*',
      },
      redirect: 'follow',
    });

    res.status(upstream.status);
    const type = upstream.headers.get('content-type');
    if (type) res.setHeader('content-type', type);
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('cache-control', 'public, max-age=300');

    if (req.method === 'HEAD') return res.end();
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.status(502).json({ error: String(e?.message ?? e) });
  }
};
