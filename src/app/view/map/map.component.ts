import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';
import { SatellitePreviewComponent } from '../../shared/satellite-preview/satellite-preview.component';
import { mapPinIcon } from '../../shared/map-pin';

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
export class MapComponent implements OnInit, OnChanges, OnDestroy {
  @Input() markers: MapMarker[] = [];
  @Input() zoom: number = 2;
  @Input() satellite = false;
  @Input() scrollWheelZoom = false;
  @Input() satPreviewEnabled = true;
  @Input() centerPin = false;
  @Input() selectedExternalId: string | null = null;
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
  private centerPinMarker: L.Marker | null = null;

  // Panel detection state
  detecting = false;
  showOverlay = false;
  showDetectConfirm = false;
  panelCount = 0;
  detectError = '';

  // Region selection state
  predictions: any[] = [];
  selectedRegion: number = -1;
  private detScaleX = 1;
  private detScaleY = 1;
  private detCropX = 0;
  private detCropY = 0;
  private deleteBtn: { x: number; y: number; r: number } | null = null;

  // Rectangle draw state
  drawMode = false;
  drawnRect: { x: number; y: number; w: number; h: number } | null = null;
  private rectStart: { x: number; y: number } | null = null;
  private rectDragging = false;

  // Screenshot capture
  @Output() screenshotTaken = new EventEmitter<File>();

  constructor(private http: HttpClient, private zone: NgZone) {}

  ngOnInit(): void {
    this.options.layers = [this.satellite ? this.createSatelliteLayer() : this.createTileLayer()];
    this.options.scrollWheelZoom = this.scrollWheelZoom;
    if (this.centerPin) {
      this.options.zoomAnimation = false;
    }
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
      this.map.doubleClickZoom.disable();

      // Use a real Leaflet marker pinned to map center — immune to zoom drift
      this.centerPinMarker = L.marker(this.map.getCenter(), { icon: mapPinIcon(), interactive: false, zIndexOffset: 1000 }).addTo(this.map);

      let dragging = false;
      this.map.on('movestart', () => {
        dragging = true;
        this.mapDragging.emit(true);
      });
      this.map.on('move', () => {
        const c = this.map.getCenter();
        this.centerPinMarker?.setLatLng(c);
        if (dragging) {
          this.centerChanged.emit({ lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) });
        }
      });
      this.map.on('moveend', () => {
        const c = this.map.getCenter();
        this.centerPinMarker?.setLatLng(c);
        dragging = false;
        this.mapDragging.emit(false);
      });
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

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isMapInitialized) return;
    // When only the selection changed, swap icons in place — don't re-fit
    // bounds or we'd undo any user pan/zoom.
    const onlySelectionChanged =
      !!changes['selectedExternalId'] &&
      !changes['markers'] &&
      !changes['zoom'] &&
      !changes['satellite'];
    if (onlySelectionChanged && !this.centerPin) {
      this.refreshMarkerHighlight();
      return;
    }
    this.update();
  }

  private refreshMarkerHighlight(): void {
    this.markerGroup.eachLayer((layer) => {
      const marker = layer as L.Marker;
      const id = marker.options.title || '';
      const isSelected =
        !!this.selectedExternalId && id === this.selectedExternalId;
      marker.setIcon(mapPinIcon(undefined, isSelected));
      marker.setZIndexOffset(isSelected ? 1000 : 0);
    });
  }

  private centerPinInitialized = false;

  /** Reposition the map center (for use with centerPin mode, e.g. reverting coords) */
  recenter(lat: number, lng: number): void {
    if (this.map) {
      this.map.setView([lat, lng], this.map.getZoom(), { animate: true });
      this.centerPinMarker?.setLatLng([lat, lng]);
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
    this.drawnRect = null;
    this.drawMode = false;
    this.predictions = [];
    this.selectedRegion = -1;
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

    const outputs = data?.outputs?.[0];
    const preds = outputs?.predictions?.predictions ?? [];

    const imgW = outputs?.predictions?.image?.width ?? cropW;
    const imgH = outputs?.predictions?.image?.height ?? cropH;
    this.detScaleX = cropW / imgW;
    this.detScaleY = cropH / imgH;
    this.detCropX = cropX;
    this.detCropY = cropY;

    this.predictions = preds;
    this.selectedRegion = -1;
    this.panelCount = preds.length;

    if (this.panelCount === 0) {
      this.detectError = 'No solar panels detected in this image';
      this.detecting = false;
      return;
    }

    this.redrawDetections();
    this.showOverlay = true;
    this.detecting = false;
  }

  onRegionClick(event: MouseEvent): void {
    if (!this.predictions.length || this.drawMode) return;
    const canvas = this.overlayCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const cssToCanvasX = canvas.width / rect.width;
    const cssToCanvasY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * cssToCanvasX;
    const y = (event.clientY - rect.top) * cssToCanvasY;

    // Check × button first
    if (this.deleteBtn && this.selectedRegion >= 0) {
      const dx = x - this.deleteBtn.x;
      const dy = y - this.deleteBtn.y;
      if (dx * dx + dy * dy <= this.deleteBtn.r * this.deleteBtn.r) {
        this.predictions = this.predictions.filter((_: any, i: number) => i !== this.selectedRegion);
        this.selectedRegion = -1;
        this.deleteBtn = null;
        this.panelCount = this.predictions.length;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (this.panelCount === 0) {
          this.showOverlay = false;
        } else {
          this.redrawDetections();
        }
        return;
      }
    }

    for (let i = this.predictions.length - 1; i >= 0; i--) {
      if (this.regionHitTest(this.predictions[i], x, y)) {
        this.selectedRegion = this.selectedRegion === i ? -1 : i;
        this.redrawDetections();
        return;
      }
    }
    if (this.selectedRegion >= 0) {
      this.selectedRegion = -1;
      this.deleteBtn = null;
      this.redrawDetections();
    }
  }

  onRegionHover(event: MouseEvent): void {
    if (!this.predictions.length || this.drawMode) return;
    const canvas = this.overlayCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const cssToCanvasX = canvas.width / rect.width;
    const cssToCanvasY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * cssToCanvasX;
    const y = (event.clientY - rect.top) * cssToCanvasY;

    // Pointer over × button
    if (this.deleteBtn) {
      const dx = x - this.deleteBtn.x;
      const dy = y - this.deleteBtn.y;
      if (dx * dx + dy * dy <= this.deleteBtn.r * this.deleteBtn.r) {
        canvas.style.cursor = 'default';
        return;
      }
    }

    canvas.style.cursor = this.predictions.some((p: any) => this.regionHitTest(p, x, y)) ? 'default' : 'grab';
  }

  deleteSelectedRegion(): void {
    if (this.selectedRegion < 0 || this.selectedRegion >= this.predictions.length) return;
    this.predictions = this.predictions.filter((_: any, i: number) => i !== this.selectedRegion);
    this.selectedRegion = -1;
    this.panelCount = this.predictions.length;
    const canvas = this.overlayCanvas.nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.panelCount === 0) {
      this.showOverlay = false;
    } else {
      this.redrawDetections();
    }
  }

  private regionHitTest(pred: any, mx: number, my: number): boolean {
    const points: { x: number; y: number }[] = pred.points ?? [];
    if (points.length > 2) {
      const scaled = points.map((p: any) => ({
        x: p.x * this.detScaleX + this.detCropX,
        y: p.y * this.detScaleY + this.detCropY,
      }));
      let inside = false;
      for (let i = 0, j = scaled.length - 1; i < scaled.length; j = i++) {
        const xi = scaled[i].x, yi = scaled[i].y;
        const xj = scaled[j].x, yj = scaled[j].y;
        if (((yi > my) !== (yj > my)) && (mx < (xj - xi) * (my - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      return inside;
    }
    const bx = (pred.x - pred.width / 2) * this.detScaleX + this.detCropX;
    const by = (pred.y - pred.height / 2) * this.detScaleY + this.detCropY;
    const bw = pred.width * this.detScaleX;
    const bh = pred.height * this.detScaleY;
    return mx >= bx && mx <= bx + bw && my >= by && my <= by + bh;
  }

  private redrawDetections(): void {
    const canvas = this.overlayCanvas.nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Re-draw any committed drawn rectangle
    if (this.drawnRect) {
      ctx.fillStyle = 'rgba(0, 255, 180, 0.3)';
      ctx.fillRect(this.drawnRect.x, this.drawnRect.y, this.drawnRect.w, this.drawnRect.h);
      ctx.strokeStyle = '#00ffb4';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.drawnRect.x, this.drawnRect.y, this.drawnRect.w, this.drawnRect.h);
    }

    for (let i = 0; i < this.predictions.length; i++) {
      const pred = this.predictions[i];
      const selected = i === this.selectedRegion;
      const fill = selected ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0, 255, 180, 0.3)';
      const stroke = selected ? '#ef4444' : '#00ffb4';
      const points: { x: number; y: number }[] = pred.points ?? [];

      if (points.length > 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x * this.detScaleX + this.detCropX, points[0].y * this.detScaleY + this.detCropY);
        for (let j = 1; j < points.length; j++) {
          ctx.lineTo(points[j].x * this.detScaleX + this.detCropX, points[j].y * this.detScaleY + this.detCropY);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selected ? 3 : 2;
        ctx.stroke();
      } else {
        const bx = (pred.x - pred.width / 2) * this.detScaleX + this.detCropX;
        const by = (pred.y - pred.height / 2) * this.detScaleY + this.detCropY;
        const bw = pred.width * this.detScaleX;
        const bh = pred.height * this.detScaleY;
        ctx.fillStyle = fill;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selected ? 3 : 2;
        ctx.strokeRect(bx, by, bw, bh);
      }

      // Draw × button at top-right of selected region
      if (selected) {
        let dotX: number, dotY: number;
        if (points.length > 2) {
          const xs = points.map((p: any) => p.x * this.detScaleX + this.detCropX);
          const ys = points.map((p: any) => p.y * this.detScaleY + this.detCropY);
          dotX = Math.max(...xs);
          dotY = Math.min(...ys);
        } else {
          dotX = (pred.x + pred.width / 2) * this.detScaleX + this.detCropX;
          dotY = (pred.y - pred.height / 2) * this.detScaleY + this.detCropY;
        }
        const r = 10;
        ctx.beginPath();
        ctx.arc(dotX, dotY, r, 0, Math.PI * 2);
        ctx.fillStyle = '#dc2626';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u00d7', dotX, dotY + 0.5);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
        this.deleteBtn = { x: dotX, y: dotY, r: r + 4 }; // slightly larger hit area
      }
    }

    if (this.selectedRegion < 0) {
      this.deleteBtn = null;
    }
  }

  // --- Rectangle draw ---

  toggleDrawMode(): void {
    this.drawMode = !this.drawMode;
    if (!this.drawMode) return;
    // Show the overlay canvas so the drawn rect is visible
    this.showOverlay = true;
  }

  onCanvasMouseDown(event: MouseEvent): void {
    if (!this.drawMode) return;
    const canvas = this.overlayCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.rectStart = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.rectDragging = true;
  }

  onCanvasMouseMove(event: MouseEvent): void {
    if (!this.rectDragging || !this.rectStart) return;
    const canvas = this.overlayCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const dr = {
      x: Math.min(this.rectStart.x, x),
      y: Math.min(this.rectStart.y, y),
      w: Math.abs(x - this.rectStart.x),
      h: Math.abs(y - this.rectStart.y),
    };
    this.redrawOverlay(dr);
  }

  onCanvasMouseUp(event: MouseEvent): void {
    if (!this.rectDragging || !this.rectStart) return;
    const canvas = this.overlayCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    this.drawnRect = {
      x: Math.min(this.rectStart.x, x),
      y: Math.min(this.rectStart.y, y),
      w: Math.abs(x - this.rectStart.x),
      h: Math.abs(y - this.rectStart.y),
    };
    this.rectDragging = false;
    this.rectStart = null;
    this.drawMode = false;
    this.redrawOverlay(this.drawnRect);
  }

  private redrawOverlay(tempRect?: { x: number; y: number; w: number; h: number }): void {
    const canvas = this.overlayCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawRect = (r: { x: number; y: number; w: number; h: number }) => {
      ctx.fillStyle = 'rgba(0, 255, 180, 0.3)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#00ffb4';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    };

    // Re-draw the committed rect if we're just previewing a new one
    if (this.drawnRect && tempRect !== this.drawnRect) {
      drawRect(this.drawnRect);
    }
    if (tempRect) {
      drawRect(tempRect);
    }
  }

  // --- Screenshot capture ---

  async captureScreenshot(): Promise<void> {
    const name = window.prompt('Screenshot name:');
    if (!name) return;

    const mapEl = this.map.getContainer();
    const w = mapEl.offsetWidth;
    const h = mapEl.offsetHeight;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = w;
    outCanvas.height = h;
    const outCtx = outCanvas.getContext('2d')!;

    // Draw satellite tiles
    const mapRect = mapEl.getBoundingClientRect();
    const tilePane = mapEl.querySelector('.leaflet-tile-pane') as HTMLElement;
    if (tilePane) {
      const imgs = Array.from(tilePane.querySelectorAll('img'));
      for (const img of imgs) {
        const r = img.getBoundingClientRect();
        try {
          outCtx.drawImage(img, r.left - mapRect.left, r.top - mapRect.top, r.width, r.height);
        } catch {
          // CORS fallback: re-fetch as blob
          const src = img.getAttribute('src');
          if (!src) continue;
          try {
            const resp = await fetch(src);
            const blob = await resp.blob();
            const bmp = await createImageBitmap(blob);
            outCtx.drawImage(bmp, r.left - mapRect.left, r.top - mapRect.top, r.width, r.height);
            bmp.close();
          } catch { /* skip */ }
        }
      }
    }

    // Draw overlay canvas (detected panels / drawn rectangle)
    if (this.showOverlay && this.overlayCanvas) {
      outCtx.drawImage(this.overlayCanvas.nativeElement, 0, 0);
    }

    // Draw marker pane (pins — DivIcon SVGs) on top of overlay
    const markerPane = mapEl.querySelector('.leaflet-marker-pane') as HTMLElement;
    if (markerPane) {
      const svgs = Array.from(markerPane.querySelectorAll('svg'));
      for (const svg of svgs) {
        const parent = svg.closest('.leaflet-marker-icon') as HTMLElement;
        if (!parent) continue;
        const r = parent.getBoundingClientRect();
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        try {
          const img = new Image();
          img.width = r.width;
          img.height = r.height;
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = url;
          });
          outCtx.drawImage(img, r.left - mapRect.left, r.top - mapRect.top, r.width, r.height);
        } catch { /* skip */ }
        URL.revokeObjectURL(url);
      }
    }

    outCanvas.toBlob((blob) => {
      if (!blob) return;
      const filename = name.replace(/[^a-zA-Z0-9_\- ]/g, '') + '.jpg';
      const file = new File([blob], filename, { type: 'image/jpeg' });
      this.zone.run(() => this.screenshotTaken.emit(file));
    }, 'image/jpeg', 0.85);
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

    this.markers.forEach((markerData: MapMarker) => {
      const { latitude, longitude, externalId, siteName } = markerData;

      if (isNaN(latitude) || isNaN(longitude)) {
        return;
      }

      const isSelected =
        !!this.selectedExternalId && externalId === this.selectedExternalId;
      const marker = L.marker([latitude, longitude], {
        title: externalId,
        icon: mapPinIcon(undefined, isSelected),
        zIndexOffset: isSelected ? 1000 : 0,
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
