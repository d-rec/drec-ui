import * as L from 'leaflet';

/**
 * Unified map pin icon used across all map views.
 * Accepts an optional color (default: status-neutral red).
 * When `highlighted` is true, renders a larger pin with a gold fill and glow
 * so a selected site stands out from neighbors.
 */
export function mapPinIcon(color = '#e53e3e', highlighted = false): L.DivIcon {
  if (highlighted) {
    const fill = '#dc2626';
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="54" viewBox="0 0 24 36">
        <defs>
          <filter id="pin-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 24 12 24S24 20.25 24 12C24 5.373 18.627 0 12 0z"
              fill="${fill}" stroke="#fff" stroke-width="2" filter="url(#pin-glow)"/>
        <circle cx="12" cy="12" r="5" fill="#fff" fill-opacity="0.95"/>
      </svg>`;
    return L.divIcon({
      html: svg,
      className: 'map-pin-highlighted',
      iconSize: [36, 54],
      iconAnchor: [18, 54],
    });
  }
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 24 12 24S24 20.25 24 12C24 5.373 18.627 0 12 0z"
            fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" fill="#fff" fill-opacity="0.85"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
  });
}
