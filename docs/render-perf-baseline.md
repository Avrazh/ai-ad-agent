# Render Performance Baseline
Date: 2026-03-12

## Setup
- 1080×1920 px output
- Puppeteer + Chromium (local dev, Windows)
- JPEG screenshot @ quality 90 (switched from PNG on 2026-03-12)

## Cold Start (first two renders on server start, concurrent)
| Step | Render 1 | Render 2 |
|------|----------|----------|
| image-resize (uncached) | 290ms | 1311ms |
| font-css | 35ms | 0ms (cached) |
| get-browser | 4807ms | 3659ms (waited for same launch) |
| new-page | 385ms | 574ms |
| set-content | 504ms | 666ms |
| font-fit | 41ms | 23ms |
| screenshot | 1479ms | 1234ms |
| **TOTAL** | **7463ms** | **8947ms** |

## Hot Path (cached image, warm browser) — tone/layout/language switches
| Render | new-page | set-content | font-fit | screenshot | TOTAL |
|--------|----------|-------------|----------|------------|-------|
| regenerate (tone 1) | 292ms | 283ms | 69ms | 1701ms | 2390ms |
| regenerate (tone 2) | 97ms | 198ms | 39ms | 1567ms | 1959ms |
| regenerate (tone 3) | 87ms | 328ms | 32ms | 1563ms | 2059ms |
| regenerate (tone 4) | 83ms | 226ms | 35ms | 1605ms | 1989ms |
| regenerate (tone 5) | 88ms | 192ms | 40ms | 1534ms | 1885ms |
| switch (layout) | 105ms | 227ms | 67ms | 1758ms | 2195ms |
| switch (language) | 110ms | 331ms | 100ms | 1575ms | 2160ms |

## Hot Path Averages
| Step | Avg | Range |
|------|-----|-------|
| new-page | 123ms | 83–292ms |
| set-content | 255ms | 192–328ms |
| font-fit | 55ms | 32–100ms |
| screenshot (JPEG) | 1615ms | 1534–1758ms |
| **TOTAL hot** | **~2090ms** | 1885–2390ms |

## Before/After: PNG → JPEG (screenshot step only)
| | PNG (before) | JPEG (after) | Δ |
|--|---|---|---|
| screenshot cold | ~2451ms | ~1479ms | −972ms |
| screenshot warm | ~2210ms | ~1615ms avg | −595ms |

Note: first-ever screenshot after browser launch is always slower (~1.5–2s)
due to Chromium GPU/compositor pipeline warmup. This is unavoidable.

## Remaining Bottlenecks
1. **screenshot: ~1600ms** — bulk of remaining time; Chromium must composite a
   large base64 image before encoding. JPEG encoding itself is fast (~200ms);
   the rest is rendering cost.
2. **set-content: ~255ms avg** — all 10 font families embedded (~4–6MB base64).
   Selective fonts (only 1–2 families per template) could cut this by ~50%.
3. **new-page: ~123ms avg** — acceptable; page pool could eliminate but adds risk.

---

## After Selective Fonts (2026-03-12)
Only Inter + Playfair Display + theme.fontHeadline loaded per render (Tangerine, Abril Fatface, Bodoni Moda dropped).

| Render | new-page | set-content | font-fit | screenshot | TOTAL |
|--------|----------|-------------|----------|------------|-------|
| regenerate | 98ms | 375ms | 19ms | 1482ms | 2012ms |
| regenerate | 164ms | 189ms | 37ms | 1434ms | 1859ms |
| switch | 150ms | 192ms | 66ms | 1567ms | 2010ms |
| generate | 115ms | 265ms | 87ms | 1227ms | 1861ms |
| switch | 81ms | 274ms | 111ms | 1463ms | 1969ms |
| **avg** | **122ms** | **259ms** | **64ms** | **1435ms** | **1942ms** |

**vs previous baseline avg:** set-content 255ms → 259ms (no change), screenshot 1615ms → 1435ms (-11%)

### Conclusion: selective fonts had negligible effect on set-content
Root cause: Inter alone is 686KB (77% of font payload) and is always included.
The 3 removed families (Tangerine, Abril, Bodoni) were only ~91KB total.

### Summary of all optimizations to date
| Change | Benefit |
|--------|---------|
| PNG → JPEG screenshot | screenshot: 2210ms → ~1440ms avg (-35%) |
| Selective fonts | Minimal (~-6% TOTAL, within noise) |
| Total hot-path improvement | ~2800ms → ~1940ms (-31%) |

### Remaining bottleneck
screenshot is ~1435ms — this is Chromium compositing cost, not just encoding.
No further easy wins without architectural changes (page pool, pre-rendered cache, etc).
