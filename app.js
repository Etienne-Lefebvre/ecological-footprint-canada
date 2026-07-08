"use strict";

// ---------------------------------------------------------------------------
// Ecological Footprints of Canadian Cities & Provinces
// Static, client-side only. Loads cities.json, draws a footprint overlay whose
// AREA equals population * per-capita EF (gha treated as hectares for drawing).
// ---------------------------------------------------------------------------

const HECTARE_M2 = 10000; // 1 hectare = 10,000 m^2

// Per-place-type presentation (colour + area label).
const TYPES = {
  city:     { color: "#3fb950", areaLabel: "city area" },
  province: { color: "#d29922", areaLabel: "provincial land area" },
};

// --- number formatting helpers ---------------------------------------------
const fmtInt = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 });

function formatArea(km2) {
  if (km2 >= 1000) return `${fmtInt.format(Math.round(km2))} km²`;
  return `${fmt1.format(km2)} km²`;
}

function formatRatio(ratio) {
  if (ratio == null) return "n/a";
  if (ratio >= 1) return `${fmtInt.format(Math.round(ratio))}× larger`;
  return `${fmt2.format(ratio)}× (smaller than its own area)`;
}

// EF math -------------------------------------------------------------------
// total EF in gha -> treat as hectares -> km^2 and an equivalent circle radius.
function footprintFor(place) {
  const totalGha = place.population * place.perCapitaEfGha; // global hectares
  const totalHa = totalGha; // 1 gha ≈ 1 ha for drawing scale
  const totalM2 = totalHa * HECTARE_M2;
  const totalKm2 = totalM2 / 1e6;
  const radiusM = Math.sqrt(totalM2 / Math.PI); // circle of equal area
  const ratioToArea = place.areaKm2 ? totalKm2 / place.areaKm2 : null;
  return { totalGha, totalKm2, radiusM, ratioToArea };
}

// State ---------------------------------------------------------------------
let map;
let overlayLayer = null; // current footprint shape
let labelMarker = null;
let selected = null; // { place, type }
let drawAsSquare = false;

// Build a square (as a rectangle of equal area) centred on the place, so the
// "square" toggle is an honest equal-area alternative to the circle.
function squareBounds(place, areaM2) {
  const sideM = Math.sqrt(areaM2);
  const halfM = sideM / 2;
  const latRad = (place.lat * Math.PI) / 180;
  const dLat = halfM / 111320; // metres per degree latitude
  const dLon = halfM / (111320 * Math.cos(latRad));
  return [
    [place.lat - dLat, place.lon - dLon],
    [place.lat + dLat, place.lon + dLon],
  ];
}

function clearOverlay() {
  if (overlayLayer) { map.removeLayer(overlayLayer); overlayLayer = null; }
  if (labelMarker) { map.removeLayer(labelMarker); labelMarker = null; }
}

function drawOverlay(place, type) {
  clearOverlay();
  const fp = footprintFor(place);
  const areaM2 = fp.totalKm2 * 1e6;
  const color = TYPES[type].color;

  // interactive:false lets clicks pass through the fill to the markers beneath
  // it, so you can still select a city whose dot sits inside another footprint.
  const style = { color, weight: 2, fillColor: color, fillOpacity: 0.18, interactive: false };

  if (drawAsSquare) {
    overlayLayer = L.rectangle(squareBounds(place, areaM2), style);
  } else {
    overlayLayer = L.circle([place.lat, place.lon], { ...style, radius: fp.radiusM });
  }
  overlayLayer.addTo(map);

  // floating label at the place centre
  labelMarker = L.marker([place.lat, place.lon], {
    icon: L.divIcon({
      className: "",
      html: `<div class="footprint-label">${place.name}: ${formatArea(fp.totalKm2)}</div>`,
      iconSize: null,
    }),
    interactive: false,
  }).addTo(map);

  map.fitBounds(overlayLayer.getBounds(), { padding: [40, 40], maxZoom: 7 });
}

// Sidebar readout -----------------------------------------------------------
function updateReadout(place, type) {
  const fp = footprintFor(place);
  document.getElementById("readout-city").textContent =
    place.country && place.country !== "Canada" ? `${place.name}, ${place.country}` : place.name;
  document.querySelector("#readout .hint").hidden = true;
  const stats = document.getElementById("readout-stats");
  stats.hidden = false;

  document.getElementById("dt-ratio").textContent = `Compared to ${TYPES[type].areaLabel}`;

  document.getElementById("stat-pop").textContent = fmtInt.format(place.population);
  document.getElementById("stat-percap").textContent = `${fmt1.format(place.perCapitaEfGha)} gha / person`;
  document.getElementById("stat-total").textContent =
    `${formatArea(fp.totalKm2)} (${fmtInt.format(Math.round(fp.totalGha))} gha)`;
  document.getElementById("stat-radius").textContent =
    `${fmt1.format(fp.radiusM / 1000)} km`;
  document.getElementById("stat-ratio").textContent = formatRatio(fp.ratioToArea);

  const note = document.getElementById("ef-note");
  if (place.efNote) { note.hidden = false; note.textContent = place.efNote; }
  else { note.hidden = true; note.textContent = ""; }
}

// Popup content -------------------------------------------------------------
function popupHtml(place, type) {
  const fp = footprintFor(place);
  const areaLabel = type === "province" ? "provincial area" : "city area";
  return `<b>${place.name}</b>${place.country ? `, ${place.country}` : ""}<br />
    Population: ${fmtInt.format(place.population)}<br />
    Footprint: <b>${formatArea(fp.totalKm2)}</b><br />
    ${fp.ratioToArea ? `≈ ${formatRatio(fp.ratioToArea)} than the ${areaLabel}` : ""}`;
}

function selectPlace(place, type) {
  selected = { place, type };
  updateReadout(place, type);
  drawOverlay(place, type);
}

// Marker icons --------------------------------------------------------------
function provincePinIcon() {
  return L.divIcon({
    className: "",
    html:
      '<svg class="province-pin" width="22" height="30" viewBox="0 0 22 30" ' +
      'xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M11 0C4.9 0 0 4.9 0 11c0 7.7 11 19 11 19s11-11.3 11-19C22 4.9 17.1 0 11 0z" ' +
      'fill="#d29922" stroke="#0f1419" stroke-width="1.5"/>' +
      '<circle cx="11" cy="11" r="4" fill="#0f1419"/></svg>',
    iconSize: [22, 30],
    iconAnchor: [11, 30],
    popupAnchor: [0, -28],
  });
}

// Init ----------------------------------------------------------------------
async function init() {
  map = L.map("map", { minZoom: 3, worldCopyJump: true }).setView([59.5, -96.35], 4);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
      '&copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);

  let data;
  try {
    const res = await fetch("cities.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    document.getElementById("readout-city").textContent = "Failed to load data";
    document.querySelector("#readout .hint").textContent =
      "cities.json could not be loaded. If opening the file directly, serve it over HTTP instead.";
    console.error(err);
    return;
  }

  // fill methodology sources
  document.getElementById("src-pop").textContent = data.meta.populationSource;
  document.getElementById("src-ef").textContent = data.meta.efSource;

  // Province pins (drawn first so city dots sit visually on top)
  (data.provinces || []).forEach((prov) => {
    const marker = L.marker([prov.lat, prov.lon], { icon: provincePinIcon() })
      .addTo(map)
      .bindPopup(popupHtml(prov, "province"));
    marker.on("click", () => selectPlace(prov, "province"));
  });

  // City markers
  const cityStyle = {
    radius: 6,
    color: "#000",
    weight: 2,
    fillColor: "#3fb950",
    fillOpacity: 1,
  };
  (data.cities || []).forEach((city) => {
    const marker = L.circleMarker([city.lat, city.lon], cityStyle)
      .addTo(map)
      .bindPopup(popupHtml(city, "city"));
    marker.on("click", () => selectPlace(city, "city"));
  });

  // Fit the initial view to every marker (Canada down to the Caribbean).
  const allPoints = [...(data.cities || []), ...(data.provinces || [])].map(
    (p) => [p.lat, p.lon]
  );
  if (allPoints.length) {
    map.fitBounds(L.latLngBounds(allPoints), { padding: [30, 30] });
  }

  document.getElementById("toggle-shape").addEventListener("change", (e) => {
    drawAsSquare = e.target.checked;
    if (selected) drawOverlay(selected.place, selected.type);
  });
}

init();
