"use strict";

// ---------------------------------------------------------------------------
// Ecological Footprints of Canadian Cities
// Static, client-side only. Loads cities.json, draws a footprint overlay whose
// AREA equals population * per-capita EF (gha treated as hectares for drawing).
// ---------------------------------------------------------------------------

const HECTARE_M2 = 10000; // 1 hectare = 10,000 m^2

// --- number formatting helpers ---------------------------------------------
const fmtInt = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 });
const fmt1 = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 1 });

function formatArea(km2) {
  if (km2 >= 1000) return `${fmtInt.format(Math.round(km2))} km²`;
  return `${fmt1.format(km2)} km²`;
}

// EF math -------------------------------------------------------------------
// total EF in gha -> treat as hectares -> km^2 and an equivalent circle radius.
function footprintFor(city) {
  const totalGha = city.population * city.perCapitaEfGha; // global hectares
  const totalHa = totalGha; // 1 gha ≈ 1 ha for drawing scale
  const totalM2 = totalHa * HECTARE_M2;
  const totalKm2 = totalM2 / 1e6;
  const radiusM = Math.sqrt(totalM2 / Math.PI); // circle of equal area
  const ratioToCma = city.areaKm2 ? totalKm2 / city.areaKm2 : null;
  return { totalGha, totalKm2, radiusM, ratioToCma };
}

// State ---------------------------------------------------------------------
let map;
let overlayLayer = null; // current footprint shape
let labelMarker = null;
let selectedCity = null;
let drawAsSquare = false;

// Build a square (as a rectangle of equal area) centred on the city, so the
// "square" toggle is an honest equal-area alternative to the circle.
function squareBounds(city, areaM2) {
  const sideM = Math.sqrt(areaM2);
  const halfM = sideM / 2;
  const latRad = (city.lat * Math.PI) / 180;
  const dLat = halfM / 111320; // metres per degree latitude
  const dLon = halfM / (111320 * Math.cos(latRad));
  return [
    [city.lat - dLat, city.lon - dLon],
    [city.lat + dLat, city.lon + dLon],
  ];
}

function clearOverlay() {
  if (overlayLayer) { map.removeLayer(overlayLayer); overlayLayer = null; }
  if (labelMarker) { map.removeLayer(labelMarker); labelMarker = null; }
}

function drawOverlay(city) {
  clearOverlay();
  const fp = footprintFor(city);
  const areaM2 = fp.totalKm2 * 1e6;

  const style = {
    color: "#3fb950",
    weight: 2,
    fillColor: "#3fb950",
    fillOpacity: 0.18,
  };

  if (drawAsSquare) {
    overlayLayer = L.rectangle(squareBounds(city, areaM2), style);
  } else {
    overlayLayer = L.circle([city.lat, city.lon], { ...style, radius: fp.radiusM });
  }
  overlayLayer.addTo(map);

  // floating label at the city centre
  labelMarker = L.marker([city.lat, city.lon], {
    icon: L.divIcon({
      className: "",
      html: `<div class="footprint-label">${city.name}: ${formatArea(fp.totalKm2)}</div>`,
      iconSize: null,
    }),
    interactive: false,
  }).addTo(map);

  map.fitBounds(overlayLayer.getBounds(), { padding: [40, 40], maxZoom: 7 });
}

// Sidebar readout -----------------------------------------------------------
function updateReadout(city) {
  const fp = footprintFor(city);
  document.getElementById("readout-city").textContent = city.name;
  document.querySelector("#readout .hint").hidden = true;
  const stats = document.getElementById("readout-stats");
  stats.hidden = false;

  document.getElementById("stat-pop").textContent = fmtInt.format(city.population);
  document.getElementById("stat-percap").textContent = `${fmt1.format(city.perCapitaEfGha)} gha / person`;
  document.getElementById("stat-total").textContent =
    `${formatArea(fp.totalKm2)} (${fmtInt.format(Math.round(fp.totalGha))} gha)`;
  document.getElementById("stat-radius").textContent =
    `${fmt1.format(fp.radiusM / 1000)} km`;
  document.getElementById("stat-ratio").textContent =
    fp.ratioToCma ? `${fmtInt.format(Math.round(fp.ratioToCma))}× larger` : "n/a";

  const note = document.getElementById("ef-note");
  if (city.efNote) { note.hidden = false; note.textContent = city.efNote; }
  else { note.hidden = true; note.textContent = ""; }
}

// City popup content --------------------------------------------------------
function popupHtml(city) {
  const fp = footprintFor(city);
  return `<b>${city.name}</b><br />
    Population: ${fmtInt.format(city.population)}<br />
    Footprint: <b>${formatArea(fp.totalKm2)}</b><br />
    ${fp.ratioToCma ? `≈ ${fmtInt.format(Math.round(fp.ratioToCma))}× the CMA land area` : ""}`;
}

function selectCity(city) {
  selectedCity = city;
  updateReadout(city);
  drawOverlay(city);
}

// Init ----------------------------------------------------------------------
async function init() {
  map = L.map("map", { minZoom: 3, worldCopyJump: true }).setView([56.13, -96.35], 4);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
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
    document.getElementById("readout-city").textContent = "Failed to load city data";
    document.querySelector("#readout .hint").textContent =
      "cities.json could not be loaded. If opening the file directly, serve it over HTTP instead.";
    console.error(err);
    return;
  }

  // fill methodology sources
  document.getElementById("src-pop").textContent = data.meta.populationSource;
  document.getElementById("src-ef").textContent = data.meta.efSource;

  const markerStyle = {
    radius: 6,
    color: "#e6edf3",
    weight: 2,
    fillColor: "#3fb950",
    fillOpacity: 1,
  };

  data.cities.forEach((city) => {
    const marker = L.circleMarker([city.lat, city.lon], markerStyle)
      .addTo(map)
      .bindPopup(popupHtml(city));
    marker.on("click", () => selectCity(city));
  });

  document.getElementById("toggle-shape").addEventListener("change", (e) => {
    drawAsSquare = e.target.checked;
    if (selectedCity) drawOverlay(selectedCity);
  });
}

init();
