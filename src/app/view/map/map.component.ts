import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';
import { SatellitePreviewComponent } from '../../shared/satellite-preview/satellite-preview.component';

export interface MapMarker {
  latitude: number;
  longitude: number;
  externalId?: string;
  siteName?: string;
}

export function satelliteTileUrl(lat: number, lng: number, zoom: number = 18): string {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return `https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${zoom}`;
}

export interface SatellitePreview {
  tiles: { url: string; left: number; top: number }[];
  offsetX: number;
  offsetY: number;
}

/** Returns a 2x2 tile grid + offsets to render a 256px view centered on the coordinate. */
export function satellitePreview(lat: number, lng: number, zoom: number = 19): SatellitePreview {
  const n = Math.pow(2, zoom);
  const xFrac = (lng + 180) / 360 * n;
  const latRad = lat * Math.PI / 180;
  const yFrac = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;

  const tileX = Math.floor(xFrac);
  const tileY = Math.floor(yFrac);
  const pixelX = (xFrac - tileX) * 256;
  const pixelY = (yFrac - tileY) * 256;

  const startTileX = pixelX < 128 ? tileX - 1 : tileX;
  const startTileY = pixelY < 128 ? tileY - 1 : tileY;

  const compositeX = (tileX - startTileX) * 256 + pixelX;
  const compositeY = (tileY - startTileY) * 256 + pixelY;

  const tiles: { url: string; left: number; top: number }[] = [];
  for (let dy = 0; dy < 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      tiles.push({
        url: `https://mt1.google.com/vt/lyrs=s&x=${startTileX + dx}&y=${startTileY + dy}&z=${zoom}`,
        left: dx * 256,
        top: dy * 256,
      });
    }
  }

  return { tiles, offsetX: -(compositeX - 128), offsetY: -(compositeY - 128) };
}

@Component({
  standalone: false,
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements OnInit, OnDestroy {
  @Input() markers: MapMarker[] = [];
  @Input() zoom: number = 2;
  @Input() satellite = false;
  @Input() scrollWheelZoom = false;
  @Input() satPreviewEnabled = true;
  @Input() centerPin = false;
  @Output() markerClicked = new EventEmitter();
  @Output() centerChanged = new EventEmitter<{ lat: number; lng: number }>();
  @Output() mapDragging = new EventEmitter<boolean>();

  @ViewChild('overlayCanvas') overlayCanvas!: ElementRef<HTMLCanvasElement>;

  options: L.MapOptions = {
    layers: [],
    zoom: 3,
    center: L.latLng(20, 0),
    scrollWheelZoom: false,
    attributionControl: false,
    maxBounds: L.latLngBounds(L.latLng(-85, -220), L.latLng(85, 220)),
    maxBoundsViscosity: 1.0,
  };

  map!: L.Map;
  markerGroup = L.featureGroup();
  isMapInitialized = false;

  // Panel detection state
  detecting = false;
  showOverlay = false;
  showDetectConfirm = false;
  panelCount = 0;
  detectError = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.options.layers = [this.satellite ? this.createSatelliteLayer() : this.createTileLayer()];
    this.options.scrollWheelZoom = this.scrollWheelZoom;
  }

  private tileObserver: MutationObserver | null = null;

  onMapReady(map: L.Map): void {
    this.map = map;
    this.markerGroup.addTo(this.map);
    this.isMapInitialized = true;

    if (this.satellite) {
      this.observeTileCORS();
    }

    if (this.centerPin) {
      this.map.on('movestart', () => this.mapDragging.emit(true));
      this.map.on('move', () => {
        const c = this.map.getCenter();
        this.centerChanged.emit({ lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) });
      });
      this.map.on('moveend', () => this.mapDragging.emit(false));
    }

    this.update();
  }

  /** Force crossorigin="anonymous" on every tile <img> so canvas capture works. */
  private observeTileCORS(): void {
    const container = this.map.getContainer();
    const tilePane = container.querySelector('.leaflet-tile-pane');
    if (!tilePane) return;

    const fix = (img: HTMLImageElement) => {
      if (img.crossOrigin !== 'anonymous') {
        img.crossOrigin = 'anonymous';
      }
    };

    // Fix existing tiles
    tilePane.querySelectorAll('img').forEach((img) => fix(img as HTMLImageElement));

    // Watch for new tiles
    this.tileObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node instanceof HTMLImageElement) {
            fix(node);
          } else if (node instanceof HTMLElement) {
            node.querySelectorAll('img').forEach((img) => fix(img as HTMLImageElement));
          }
        }
      }
    });
    this.tileObserver.observe(tilePane, { childList: true, subtree: true });
  }

  ngOnChanges(): void {
    if (this.isMapInitialized) {
      this.update();
    }
  }

  private centerPinInitialized = false;

  /** Reposition the map center (for use with centerPin mode, e.g. reverting coords) */
  recenter(lat: number, lng: number): void {
    if (this.map) {
      this.map.setView([lat, lng], this.map.getZoom(), { animate: true });
    }
  }

  update(): void {
    if (this.centerPin) {
      // Only set view once for initial positioning — after that the user controls the map
      this.markerGroup.clearLayers();
      if (!this.centerPinInitialized && this.markers?.length) {
        const m = this.markers[0];
        if (!isNaN(m.latitude) && !isNaN(m.longitude)) {
          this.map.setView([m.latitude, m.longitude], this.zoom, { animate: false });
          this.centerPinInitialized = true;
        }
      }
      return;
    }
    this.addMarkers();
  }

  // --- Panel detection ---

  detectPanels(): void {
    if (!this.map || this.detecting) return;
    this.showDetectConfirm = true;
  }

  confirmDetect(): void {
    this.showDetectConfirm = false;
    this.detecting = true;
    this.detectError = '';
    this.waitForTilesThenCapture();
  }

  private waitForTilesThenCapture(): void {
    const tileLayer = this.map.eachLayer((layer: any) => {
      if (layer._url && layer._loading) return layer;
    });

    // Check if any tiles are still loading
    const mapEl = this.map.getContainer();
    const imgs = mapEl.querySelectorAll('.leaflet-tile-pane img');
    const allLoaded = Array.from(imgs).every(
      (img: any) => img.complete && img.naturalWidth > 0,
    );

    if (allLoaded && imgs.length > 0) {
      setTimeout(() => this.captureAndDetect(), 200);
    } else {
      // Wait for tiles to finish loading, with a max timeout
      let attempts = 0;
      const check = () => {
        attempts++;
        const currentImgs = mapEl.querySelectorAll('.leaflet-tile-pane img');
        const ready = Array.from(currentImgs).every(
          (img: any) => img.complete && img.naturalWidth > 0,
        );
        if (ready || attempts > 20) {
          setTimeout(() => this.captureAndDetect(), 200);
        } else {
          setTimeout(check, 250);
        }
      };
      setTimeout(check, 300);
    }
  }

  cancelDetect(): void {
    this.showDetectConfirm = false;
  }

  clearOverlay(): void {
    this.showOverlay = false;
    this.panelCount = 0;
    this.detectError = '';
    if (this.overlayCanvas) {
      const canvas = this.overlayCanvas.nativeElement;
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  private async captureAndDetect(): Promise<void> {
    const mapEl = this.map.getContainer();
    const w = mapEl.offsetWidth;
    const h = mapEl.offsetHeight;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = w;
    srcCanvas.height = h;
    const srcCtx = srcCanvas.getContext('2d')!;

    const tilePane = mapEl.querySelector('.leaflet-tile-pane') as HTMLElement;
    if (!tilePane) {
      this.detecting = false;
      this.detectError = 'Could not capture map';
      return;
    }

    const mapRect = mapEl.getBoundingClientRect();
    const imgs = Array.from(tilePane.querySelectorAll('img'));

    // Try direct drawImage first; if CORS blocks it, re-fetch tiles as blobs
    let drawn = 0;
    for (const img of imgs) {
      const rect = img.getBoundingClientRect();
      const x = rect.left - mapRect.left;
      const y = rect.top - mapRect.top;
      try {
        srcCtx.drawImage(img, x, y, rect.width, rect.height);
        drawn++;
      } catch {
        // CORS tainted — will fallback below
      }
    }

    if (drawn === 0 && imgs.length > 0) {
      // Fallback: re-fetch each tile as a blob to bypass CORS tainting
      await Promise.all(
        imgs.map(async (img) => {
          const src = img.getAttribute('src');
          if (!src) return;
          const rect = img.getBoundingClientRect();
          const x = rect.left - mapRect.left;
          const y = rect.top - mapRect.top;
          try {
            const resp = await fetch(src);
            const blob = await resp.blob();
            const bmp = await createImageBitmap(blob);
            srcCtx.drawImage(bmp, x, y, rect.width, rect.height);
            bmp.close();
          } catch {
            // skip tile
          }
        }),
      );
    }

    // Verify canvas isn't blank
    const sample = srcCtx.getImageData(
      Math.floor(w / 2), Math.floor(h / 2), 1, 1,
    ).data;
    if (sample[0] === 0 && sample[1] === 0 && sample[2] === 0 && sample[3] === 0) {
      this.detecting = false;
      this.detectError = 'Could not capture map tiles (CORS)';
      return;
    }

    // Crop center 80% of viewport and cap at 1024px to keep payload small
    const frac = 0.8;
    const cropW = Math.round(w * frac);
    const cropH = Math.round(h * frac);
    const cropX = Math.round((w - cropW) / 2);
    const cropY = Math.round((h - cropH) / 2);

    const cropCanvas = document.createElement('canvas');
    const maxDim = 1024;
    const scale = Math.min(1, maxDim / Math.max(cropW, cropH));
    cropCanvas.width = Math.round(cropW * scale);
    cropCanvas.height = Math.round(cropH * scale);
    const cropCtx = cropCanvas.getContext('2d')!;
    cropCtx.drawImage(srcCanvas, cropX, cropY, cropW, cropH,
      0, 0, cropCanvas.width, cropCanvas.height);

    const base64 = cropCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    this.http.post<any>(
      `${environment.API_URL}device-reviews/detect-panels`,
      { image: base64 },
    ).subscribe({
      next: (data) => this.drawDetections(data, w, h, cropX, cropY, cropW, cropH),
      error: (err) => {
        this.detectError =
          'Detection failed: ' + (err?.error?.message || err?.message || err);
        this.detecting = false;
      },
    });
  }

  private drawDetections(
    data: any, w: number, h: number,
    cropX: number, cropY: number, cropW: number, cropH: number,
  ): void {
    const canvas = this.overlayCanvas.nativeElement;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);

    const outputs = data?.outputs?.[0];
    const predictions = outputs?.predictions?.predictions ?? [];

    const imgW = outputs?.predictions?.image?.width ?? cropW;
    const imgH = outputs?.predictions?.image?.height ?? cropH;
    const scaleX = cropW / imgW;
    const scaleY = cropH / imgH;

    this.panelCount = predictions.length;
    if (this.panelCount === 0) {
      this.detectError = 'No solar panels detected in this image';
      this.detecting = false;
      return;
    }

    for (const pred of predictions) {
      const points: { x: number; y: number }[] = pred.points ?? [];

      if (points.length > 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x * scaleX + cropX, points[0].y * scaleY + cropY);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x * scaleX + cropX, points[i].y * scaleY + cropY);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 255, 180, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#00ffb4';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        const bx = (pred.x - pred.width / 2) * scaleX + cropX;
        const by = (pred.y - pred.height / 2) * scaleY + cropY;
        const bw = pred.width * scaleX;
        const bh = pred.height * scaleY;
        ctx.fillStyle = 'rgba(0, 255, 180, 0.3)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#00ffb4';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);
      }

      if (pred.confidence) {
        const cx = (pred.x - pred.width / 2) * scaleX + cropX;
        const cy = (pred.y - pred.height / 2) * scaleY + cropY - 4;
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const label = `${Math.round(pred.confidence * 100)}%`;
        const tw = ctx.measureText(label).width;
        ctx.fillRect(cx, cy - 12, tw + 6, 15);
        ctx.fillStyle = '#00ffb4';
        ctx.fillText(label, cx + 3, cy);
      }
    }

    this.showOverlay = true;
    this.detecting = false;
  }

  private pinOverlay: HTMLElement | null = null;

  private removePinOverlay(): void {
    if (this.pinOverlay) {
      this.pinOverlay.remove();
      this.pinOverlay = null;
    }
  }

  ngOnDestroy(): void {
    this.tileObserver?.disconnect();
    this.removePinOverlay();
  }

  // --- Tile layers ---

  private createCustomIcon(): L.Icon {
    return L.icon({
      iconUrl: 'assets/images/map-location.svg',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  }

  private createTileLayer(): L.TileLayer {
    return L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      {
        minZoom: 3,
        maxZoom: 17,
        noWrap: true,
        attribution:
          '&copy; <a href="https://carto.com/">carto.com</a> contributors',
      },
    );
  }

  private createSatelliteLayer(): L.TileLayer {
    return L.tileLayer(
      'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      {
        minZoom: 3,
        maxZoom: 21,
        noWrap: true,
        attribution: '&copy; Google',
        crossOrigin: true,
      } as any,
    );
  }

  // --- Markers ---

  private addMarkers(): void {
    this.markerGroup.clearLayers();

    if (
      !this.markers ||
      !Array.isArray(this.markers) ||
      this.markers.length === 0
    ) {
      return;
    }

    const customIcon = this.createCustomIcon();

    this.markers.forEach((markerData: MapMarker) => {
      const { latitude, longitude, externalId, siteName } = markerData;

      if (isNaN(latitude) || isNaN(longitude)) {
        return;
      }

      const marker = L.marker([latitude, longitude], {
        title: externalId,
        icon: customIcon,
      });

      const label = siteName || externalId || '';

      marker.on('mouseover', () => {
        if (!this.satPreviewEnabled) return;
        this.removePinOverlay();
        this.pinOverlay = SatellitePreviewComponent.createOverlay(
          label, latitude, longitude, this.http,
        );
        SatellitePreviewComponent.positionOverlay(
          this.pinOverlay, this.map!, latitude, longitude,
        );
      });

      marker.on('mouseout', () => {
        this.removePinOverlay();
      });

      marker.on('click', () => {
        this.markerClicked.emit({ externalId });
      });

      this.markerGroup.addLayer(marker);
    });

    this.fitToBounds();
  }

  private fitToBounds(): void {
    const validCoordinates = this.markers
      .filter((m) => !isNaN(m.latitude) && !isNaN(m.longitude))
      .map((m) => [m.latitude, m.longitude] as L.LatLngTuple);

    if (validCoordinates.length > 0) {
      if (validCoordinates.length === 1) {
        const position = L.latLng(
          validCoordinates[0][0],
          validCoordinates[0][1],
        );
        this.map.setView(position, this.zoom, { animate: false });
      } else {
        const bounds = L.latLngBounds(validCoordinates);
        this.map.fitBounds(bounds, { padding: [50, 50], animate: false });
      }
    } else {
      this.map.setView([20, 0], this.zoom, { animate: false });
    }
  }
}
