# Ecological Footprints of Canadian Cities & Provinces

An interactive map that shows, when you click a **city** (green dot) or a Canadian
**province/territory** (amber pin), an overlay whose **area equals that place's
total ecological footprint** — the area of productive ecosystems its population
needs at its national living standards.

It covers Canadian cities and provinces plus a set of American, Mexican, Central
American, and Caribbean cities. Each city uses its own country's per-capita
footprint, so the contrasts are stark: a US city needs about 7.1 gha per person
while a Haitian city needs about 0.64.

Provinces add another contrast: for densely populated ones (Ontario, PEI) the
footprint is *larger* than the province's own land area, while for vast, thinly
populated ones (Quebec, Alberta, Nunavut) it is *smaller*.

It's a static site (HTML/CSS/JS + [Leaflet](https://leafletjs.com/)) with no
build step and no backend, so it hosts for free on GitHub Pages.

## How the footprint is calculated

```
total ecological footprint = population × per-capita footprint (gha)
```

- **Population** — Statistics Canada 2021 Census figures for Canadian cities and
  provinces; approximate metro-area populations for international cities.
- **Per-capita footprint** — each place's national **Ecological Footprint of
  consumption** in global hectares (gha) from the Global Footprint Network's
  **National Footprint and Biocapacity Accounts, 2026 Edition (data year 2023)**.
  Canada is **6.856 gha/person**. A gha is one hectare of world-average biological
  productivity.

The overlay is a circle (or square) whose area equals that total, using
`radius = √(area / π)`. One gha is drawn as one hectare.

## Important caveats (read these)

- **The shape shows scale, not location.** A city's real footprint is spread
  across the whole globe and its oceans — it is *not* the land around the city.
- **Global hectares ≠ physical hectares.** gha are productivity-normalized;
  since Canadian land is generally less productive than the world average, the
  true physical area would be *larger* than what's drawn.
- **The per-capita number is a national average** applied to each city. Real
  cities differ by income, density, climate, and transport. Treat this as an
  educational approximation, not a measurement.

## Editing the data

All data lives in [`cities.json`](cities.json), split into a `cities` array and a
`provinces` array. To add a city, append an entry to `cities` (or a
province/territory to `provinces`):

```json
{ "name": "Saskatoon", "country": "Canada", "lat": 52.1332, "lon": -106.6700,
  "population": 317480, "areaKm2": 5890, "perCapitaEfGha": 6.856 }
```

For provinces, `areaKm2` is the provincial land area; for cities it is the CMA
land area (Canadian) or approximate metro extent (international). Set
`perCapitaEfGha` to that country's figure and add an `efNote` string citing it;
the note shows in the sidebar when the value differs from Canada's default.

## Running locally

Because the page fetches `cities.json`, open it over HTTP rather than as a
`file://` URL:

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Deploying to GitHub Pages

1. Push these files to the root of a public repository.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source: Deploy from a branch**, branch
   `main`, folder `/ (root)`, and save.
4. Your site appears at `https://<username>.github.io/<repo>/` within a minute.

## Data sources

- Statistics Canada, 2021 Census — <https://www12.statcan.gc.ca/census-recensement/2021/>
- Global Footprint Network / FoDaFo, National Footprint and Biocapacity Accounts,
  2026 Edition (data year 2023) — <https://data.footprintnetwork.org/>
