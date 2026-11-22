# Especificación de APIs y Modelo de Datos

Este documento detalla todas las fuentes de datos de **Atlas 3D** —**100% gratuitas, sin API key y con soporte CORS `*` verificado en navegador**— junto con el modelo de datos, claves de caché y fórmulas matemáticas.

---

## 1. Fuentes de Datos y APIs Verificadas

> **Nota histórica**: `restcountries.com/v3.1` fue deprecado por su proveedor y `apicountries.com` bloquea solicitudes desde navegador por falta de CORS. Todas las fuentes listadas abajo funcionan directamente desde navegador con `Access-Control-Allow-Origin: *`.

| Propósito | Fuente / Endpoint | Caché (TTL) | Uso Principal |
| :--- | :--- | :--- | :--- |
| **Catálogo base de países (250)** | `https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json` | 24 h (`atlas:countries:v5`) | Códigos ISO (`cca2`, `cca3`, `ccn3`), nombres ES/EN, capital, región, subregión, área, coordenadas, `borders`, idiomas, monedas, `tld`, `idd`. |
| **Población mundial** | `https://cdn.jsdelivr.net/gh/samayo/country-json@master/src/country-by-population.json` | 24 h (en `atlas:countries:v5`) | Completa la población de cada nación. |
| **Husos horarios (`UTC±HH:MM`)** | `https://cdn.jsdelivr.net/npm/countries-and-timezones@latest/+esm` | 24 h (en `atlas:countries:v5`) | Calcula offsets reales por código `alpha2` para el reloj local en vivo. |
| **Banderas y escudos** | `https://flagcdn.com/{alpha2}.svg`, `https://flagcdn.com/w640/{alpha2}.png`, `https://mainfacts.com/media/images/coats_of_arms/{alpha2}.svg` | HTTP navegador | SVG para tarjetas/listas, PNG CORS `*` para shader WebGL de bandera 3D y SVG de escudos con fallback ISO 3D. |
| **Geometría mundial `50m`** | `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json` (fallback `countries-110m.json`) | Singleton en memoria | Polígonos para overlay del Globo 3D, extrusión `ExtrudeGeometry` (`silhouette3d.js`) y comparador Anti-Mercator. |
| **Texturas satelitales NASA** | `three-globe@2.31.1/example/img/{earth-blue-marble.jpg,earth-night.jpg,earth-topology.png}` | HTTP navegador | Texturas diurna, nocturna (luces de ciudades) y topográfica del Globo 3D. |
| **Clima en vivo** | `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,weather_code,wind_speed_10m,is_day` | 15 min (`atlas:wx:{lat},{lng}`) | Temperatura, viento y código WMO para los mini objetos 3D climáticos. |
| **Resumen cultural ES** | `https://es.wikipedia.org/api/rest_v1/page/summary/{title}` | 7 días (`atlas:wiki:es:{cca3}`) | Extracto enciclopédico en español en el detalle del país. |
| **Tasas de cambio (FX)** | `https://open.er-api.com/v6/latest/USD` (fallback `https://api.frankfurter.app/latest?from=USD`) | 6 h (`atlas:fx:v1`) | Conversor en tiempo real de 166 divisas desde la Moneda 3D. |
| **Mapa cartográfico** | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` + Leaflet 1.9.4 | HTTP navegador | Cara B del inspector con filtro oscuro CSS `.atlas-dark-map` sin marcas de agua. |

---

## 2. Modelo Normalizado (`CountryRecord`) y Caché Local

- `atlas:countries:v5`: Catálogo normalizado incluyendo `flagSvg` y `flagPng` (`w640`), `numericCode` de 3 dígitos (`032`, `036`), `timezones`, `currencies`, `languages`, `borders`, `area` y `density`.
- `atlas:passport:v1`: `{ visited: { [cca3]: "YYYY-MM-DD" }, wishlist: string[] }`.
- `atlas:quiz:v1`: `{ bestStreaks: { flag, capital, silhouette, borders }, totalCorrect, totalPlayed }`.
- `atlas:fx:v1`: `{ base: "USD", rates: Record<string, number>, updatedAt: string }`.

---

## 3. Fórmulas y Proyecciones

### 3.1. Proyección Igual-Área en Kilómetros (`projectFeatureToKm`)
Para la extrusión 3D (`silhouette3d.js`) y la superposición **Anti-Mercator** (`comparator3d.js`), cada punto $(\text{lng}, \text{lat})$ se proyecta compensando $\cos(\text{lat})$ alrededor del centro de masa principal del país (desenvolviendo cruces del antimeridiano $\pm 180^\circ$):

$$x_{\text{km}} = (\text{unwrap}(\text{lng}) - \text{lng}_0) \cdot 111.32 \cdot \cos\!\left(\frac{\pi \cdot \text{lat}}{180}\right), \qquad y_{\text{km}} = (\text{lat} - \text{lat}_0) \cdot 111.32$$

### 3.2. Coordenadas Esféricas del Globo 3D (`latLngToVec3`)
$$\phi = (90 - \text{lat}) \cdot \frac{\pi}{180}, \qquad \theta = (\text{lng} + 180) \cdot \frac{\pi}{180}$$
$$x = -R \sin(\phi)\cos(\theta), \qquad y = R \cos(\phi), \qquad z = R \sin(\phi)\sin(\theta)$$

### 3.3. Haversine, Rumbo (*Bearing*) y Reloj UTC
- **`haversineKm`**: Calcula distancias reales tramo a tramo en el Calculador de Rutas ($R = 6371\text{ km}$).
- **`bearingDeg`**: Calcula el acimut inicial ($0^\circ..360^\circ$) hacia el vecino limítrofe para orientar la aguja de la brújula 3D.
- **`getLocalTimeFromUtc`**: Convierte el offset `UTC±HH:MM` a reloj en vivo (`HH:MM:SS`) e indicador Día (`06:00–18:59`) / Noche.
