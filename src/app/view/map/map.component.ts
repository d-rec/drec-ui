import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  NgZone,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import * as piexif from 'piexifjs';
import { environment } from '../../../environments/environment';
import { SatellitePreviewComponent } from '../../shared/satellite-preview/satellite-preview.component';
import { mapPinIcon } from '../../shared/map-pin';
import { safeErrorMessage } from '../../utils/safe-error-message';

export interface MapMarker {
  latitude: number;
  longitude: number;
  externalId?: string;
  siteName?: string;
}

export function satelliteTileUrl(
  lat: number,
  lng: number,
  zoom: number = 18,
): string {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return `https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${zoom}`;
}

export interface SatellitePreview {
  tiles: { url: string; left: number; top: number }[];
  offsetX: number;
  offsetY: number;
}

/** Returns a 2x2 tile grid + offsets to render a 256px view centered on the coordinate. */
export function satellitePreview(
  lat: number,
  lng: number,
  zoom: number = 19,
): SatellitePreview {
  const n = Math.pow(2, zoom);
  const xFrac = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yFrac =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

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
  // True while one or more satellite tiles are still fetching for the
  // current viewport. Detection works best after this returns to false.
  tilesLoading = false;
  errorCopied = false;

  // Region selection state
  predictions: any[] = [];
  selectedRegion: number = -1;
  // Capture metadata, kept so that predictions (which arrive in
  // capture-image pixel coords) can be re-projected onto the live
  // viewport every time the user pans or zooms — masks track the
  // ground instead of sliding off when the map moves.
  private captureCenter: L.LatLng | null = null;
  private captureZoom = 0;
  private captureSize = 0;
  private captureImgW = 0; // image width as the model reported it
  private captureImgH = 0;
  private deleteBtn: { x: number; y: number; r: number } | null = null;

  // Rectangle draw state
  drawMode = false;
  drawnRect: { x: number; y: number; w: number; h: number } | null = null;
  private rectStart: { x: number; y: number } | null = null;
  private rectDragging = false;

  // Screenshot capture
  @Output() screenshotTaken = new EventEmitter<File>();

  constructor(
    private http: HttpClient,
    private zone: NgZone,
  ) {}

  ngOnInit(): void {
    this.options.layers = [
      this.satellite ? this.createSatelliteLayer() : this.createTileLayer(),
    ];
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

      // Don't place the center pin until the user interacts with the map or
      // real coordinates are supplied via inputs — otherwise a stray pin
      // shows at the default map view (Sahara) before the user has done
      // anything meaningful.

      let dragging = false;
      // Defer all parent-facing emits to the next macrotask so they land
      // outside Angular's current change-detection cycle (avoids NG0100 on
      // [class.coord-adjusting]="mapAdjusting" when leaflet fires
      // movestart+moveend in the same tick, e.g. a click).
      const deferEmit = (fn: () => void) => setTimeout(() => this.zone.run(fn), 0);
      this.map.on('movestart', () => {
        dragging = true;
        deferEmit(() => this.mapDragging.emit(true));
        this.ensureCenterPin();
      });
      this.map.on('move', () => {
        const c = this.map.getCenter();
        this.centerPinMarker?.setLatLng(c);
        if (dragging) {
          deferEmit(() =>
            this.centerChanged.emit({
              lat: +c.lat.toFixed(6),
              lng: +c.lng.toFixed(6),
            }),
          );
        }
      });
      this.map.on('moveend', () => {
        const c = this.map.getCenter();
        this.centerPinMarker?.setLatLng(c);
        dragging = false;
        deferEmit(() => this.mapDragging.emit(false));
      });
    }

    // Re-project the panel mask onto the live viewport on any pan/zoom
    // so detections track the ground (instead of sliding off when the
    // user explores the map after detecting).
    if (this.satellite) {
      const onMapMoved = () => {
        if (this.predictions.length && this.overlayCanvas) {
          this.resizeAndRedraw();
        }
      };
      this.map.on('move', onMapMoved);
      this.map.on('zoom', onMapMoved);
      this.map.on('moveend', onMapMoved);
      this.map.on('zoomend', onMapMoved);
    }

    this.update();
  }

  private resizeAndRedraw(): void {
    if (!this.overlayCanvas) return;
    const mapEl = this.map.getContainer();
    const canvas = this.overlayCanvas.nativeElement;
    if (canvas.width !== mapEl.offsetWidth || canvas.height !== mapEl.offsetHeight) {
      canvas.width = mapEl.offsetWidth;
      canvas.height = mapEl.offsetHeight;
    }
    this.redrawDetections();
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
    tilePane
      .querySelectorAll('img')
      .forEach((img) => fix(img as HTMLImageElement));

    // Watch for new tiles
    this.tileObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node instanceof HTMLImageElement) {
            fix(node);
          } else if (node instanceof HTMLElement) {
            node
              .querySelectorAll('img')
              .forEach((img) => fix(img as HTMLImageElement));
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
      this.ensureCenterPin([lat, lng]);
      this.centerPinMarker?.setLatLng([lat, lng]);
    }
  }

  /** Lazily create the center pin marker the first time it's needed. */
  private ensureCenterPin(latLng?: L.LatLngExpression): void {
    if (this.centerPinMarker || !this.map) return;
    const pos = latLng ?? this.map.getCenter();
    // The visible centre indicator is the HTML .center-pin element in
    // the template (sits above .detect-overlay). This Leaflet marker is
    // kept invisible (CSS .leaflet-center-pin-hidden) but still in the
    // DOM so captureScreenshot's marker-pane iteration picks it up and
    // bakes the pin into the saved image.
    const icon = mapPinIcon();
    (icon.options as any).className = 'leaflet-center-pin-hidden';
    this.centerPinMarker = L.marker(pos, {
      icon,
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(this.map);
  }

  update(): void {
    if (this.centerPin) {
      // Only set view once for initial positioning — after that the user controls the map
      this.markerGroup.clearLayers();
      if (!this.centerPinInitialized && this.markers?.length) {
        const m = this.markers[0];
        if (!isNaN(m.latitude) && !isNaN(m.longitude)) {
          this.map.setView([m.latitude, m.longitude], this.zoom, {
            animate: false,
          });
          this.ensureCenterPin([m.latitude, m.longitude]);
          this.centerPinMarker?.setLatLng([m.latitude, m.longitude]);
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

  /**
   * Resolve once every <img> in the tile pane has either loaded
   * (naturalWidth > 0) or errored, or after `timeoutMs`. Also uses leaflet's
   * own 'load' event when available — fires after tilesToLoad reaches 0.
   */
  private waitForTilesLoaded(
    tilePane: HTMLElement,
    timeoutMs: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const check = () => {
        const imgs = Array.from(
          tilePane.querySelectorAll('img'),
        ) as HTMLImageElement[];
        const pending = imgs.filter(
          (i) => !i.complete || i.naturalWidth === 0,
        );
        if (pending.length === 0) {
          resolve();
          return;
        }
        if (Date.now() >= deadline) {
          resolve();
          return;
        }
        // Wait for the next image to load/error, then re-check.
        const onSettled = () => {
          pending.forEach((i) => {
            i.removeEventListener('load', onSettled);
            i.removeEventListener('error', onSettled);
          });
          // Coalesce burst of resolves into a single check on next frame.
          requestAnimationFrame(check);
        };
        pending.forEach((i) => {
          i.addEventListener('load', onSettled, { once: true });
          i.addEventListener('error', onSettled, { once: true });
        });
        // Also poll occasionally in case new <img> elements appear (leaflet
        // can append more tiles on pan/zoom).
        setTimeout(check, 250);
      };
      check();
    });
  }

  async copyDetectError(): Promise<void> {
    if (!this.detectError) return;
    try {
      await navigator.clipboard.writeText(this.detectError);
      this.errorCopied = true;
      setTimeout(() => (this.errorCopied = false), 1500);
    } catch {
      // Fallback for environments without async clipboard.
      const ta = document.createElement('textarea');
      ta.value = this.detectError;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        this.errorCopied = true;
        setTimeout(() => (this.errorCopied = false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  dismissDetectError(): void {
    this.detectError = '';
  }

  /**
   * Convert a capture-image pixel coordinate (0..captureImgW × 0..H)
   * back to a viewport container pixel for the current map state. Lets
   * predictions stay glued to the ground when the user pans/zooms after
   * detection — image px → global Web-Mercator px at captureZoom →
   * latLng → live container point.
   */
  private imagePxToContainer(
    px: number,
    py: number,
  ): { x: number; y: number } {
    if (!this.captureCenter || !this.map || !this.captureImgW || !this.captureSize) {
      return { x: 0, y: 0 };
    }
    const TILE = 256;
    const HALF = this.captureSize / 2;
    const z = this.captureZoom;
    const sinLat = Math.sin((this.captureCenter.lat * Math.PI) / 180);
    const centerPxX =
      ((this.captureCenter.lng + 180) / 360) * Math.pow(2, z) * TILE;
    const centerPxY =
      (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
      Math.pow(2, z) *
      TILE;
    const globalPxX =
      centerPxX - HALF + (px / this.captureImgW) * this.captureSize;
    const globalPxY =
      centerPxY - HALF + (py / this.captureImgH) * this.captureSize;
    const lng = (globalPxX / (Math.pow(2, z) * TILE)) * 360 - 180;
    const n =
      Math.PI - 2 * Math.PI * (globalPxY / (Math.pow(2, z) * TILE));
    const lat =
      (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    const cp = this.map.latLngToContainerPoint([lat, lng]);
    return { x: cp.x, y: cp.y };
  }

  private async captureAndDetect(): Promise<void> {
    if (!this.map) {
      this.detecting = false;
      return;
    }

    // Fixed-size, off-screen capture: 512×512 centered on the map
    // center, at the *current map zoom* (not a hardcoded value). Using
    // the live zoom keeps the captured image's pixel-to-ground ratio
    // identical to the viewport's, so when we project predictions back
    // onto the viewport via map.latLngToContainerPoint(center) the
    // overlay lines up with what the user is looking at — including
    // when they Clear, zoom in, and re-Detect.
    //
    // Capture is independent of window size, devicePixelRatio, and OS;
    // tiles are fetched directly from Google so Mac / Linux / Firefox /
    // Safari send byte-equivalent images for the same lat/lng + zoom.
    const SIZE = 512;
    const TILE = 256;
    const HALF = SIZE / 2;
    const z = Math.round(this.map.getZoom());

    const center = this.map.getCenter();
    const lat = center.lat;
    const lng = center.lng;

    // Web Mercator: lat/lng → global pixel coords at zoom z
    const sinLat = Math.sin((lat * Math.PI) / 180);
    const px = ((lng + 180) / 360) * Math.pow(2, z) * TILE;
    const py =
      (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
      Math.pow(2, z) *
      TILE;

    const topLeftPx = px - HALF;
    const topLeftPy = py - HALF;

    const tx0 = Math.floor(topLeftPx / TILE);
    const ty0 = Math.floor(topLeftPy / TILE);
    const tx1 = Math.floor((topLeftPx + SIZE - 1) / TILE);
    const ty1 = Math.floor((topLeftPy + SIZE - 1) / TILE);

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;

    const tasks: Promise<void>[] = [];
    for (let tx = tx0; tx <= tx1; tx++) {
      for (let ty = ty0; ty <= ty1; ty++) {
        tasks.push(
          (async () => {
            const url = `https://mt1.google.com/vt/lyrs=s&x=${tx}&y=${ty}&z=${z}`;
            try {
              const resp = await fetch(url);
              const blob = await resp.blob();
              const bmp = await createImageBitmap(blob);
              const dx = tx * TILE - topLeftPx;
              const dy = ty * TILE - topLeftPy;
              ctx.drawImage(bmp, dx, dy);
              bmp.close();
            } catch {
              // skip missing tile
            }
          })(),
        );
      }
    }
    await Promise.all(tasks);

    const sample = ctx.getImageData(HALF, HALF, 1, 1).data;
    if (
      sample[0] === 0 &&
      sample[1] === 0 &&
      sample[2] === 0 &&
      sample[3] === 0
    ) {
      this.detecting = false;
      this.detectError = 'Could not capture map tiles';
      return;
    }

    // PNG (lossless) — gives the model the most faithful pixels and
    // sits comfortably under the 10MB API body cap.
    const base64 = canvas.toDataURL('image/png').split(',')[1];

    // Capture metadata is enough to re-project predictions onto the
    // live viewport on any subsequent pan/zoom (see imagePxToContainer).
    this.captureCenter = center;
    this.captureZoom = z;
    this.captureSize = SIZE;

    this.http
      .post<any>(`${environment.API_URL}device-reviews/detect-panels`, {
        image: base64,
      })
      .subscribe({
        next: (data) => this.drawDetections(data),
        error: (err) => {
          this.detectError = 'Detection failed: ' + safeErrorMessage(err);
          this.detecting = false;
        },
      });
  }

  private drawDetections(data: any): void {
    const mapEl = this.map.getContainer();
    const canvas = this.overlayCanvas.nativeElement;
    canvas.width = mapEl.offsetWidth;
    canvas.height = mapEl.offsetHeight;

    const outputs = data?.outputs?.[0];
    const preds = outputs?.predictions?.predictions ?? [];

    // Image dims as the model saw them. Usually equals captureSize but
    // models occasionally resize to a fixed input; keeping both means
    // imagePxToContainer interpolates correctly either way.
    this.captureImgW = outputs?.predictions?.image?.width ?? this.captureSize;
    this.captureImgH = outputs?.predictions?.image?.height ?? this.captureSize;

    this.predictions = preds;
    this.selectedRegion = -1;
    this.panelCount = preds.length;

    if (this.panelCount === 0) {
      const hasOutputs = !!outputs;
      const hasImage = !!outputs?.predictions?.image;
      const hint = hasOutputs && hasImage
        ? 'Model ran but found 0 panels. Try zooming in (z19+), recentering, or wait for satellite tiles to fully load.'
        : 'Unexpected model response (no `outputs[0].predictions`).';
      // Strip long string fields (base64 image data, etc.) before
      // dumping the response — Roboflow workflows return annotated
      // images embedded in the JSON, and a 1500-char slice still
      // pastes a wall of base64 into the error toast.
      let raw = '';
      try {
        raw = JSON.stringify(
          data,
          (_k, v) =>
            typeof v === 'string' && v.length > 80
              ? `[${v.length} chars omitted]`
              : v,
          2,
        );
        if (raw.length > 1500) raw = raw.slice(0, 1500) + '\n…[truncated]';
      } catch {
        raw = '(unstringifiable)';
      }
      this.detectError = `${hint}\n\nRoboflow response:\n${raw}`;
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
        this.predictions = this.predictions.filter(
          (_: any, i: number) => i !== this.selectedRegion,
        );
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

    canvas.style.cursor = this.predictions.some((p: any) =>
      this.regionHitTest(p, x, y),
    )
      ? 'default'
      : 'grab';
  }

  deleteSelectedRegion(): void {
    if (
      this.selectedRegion < 0 ||
      this.selectedRegion >= this.predictions.length
    )
      return;
    this.predictions = this.predictions.filter(
      (_: any, i: number) => i !== this.selectedRegion,
    );
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
        ...this.imagePxToContainer(p.x, p.y),
      }));
      let inside = false;
      for (let i = 0, j = scaled.length - 1; i < scaled.length; j = i++) {
        const xi = scaled[i].x,
          yi = scaled[i].y;
        const xj = scaled[j].x,
          yj = scaled[j].y;
        if (
          yi > my !== yj > my &&
          mx < ((xj - xi) * (my - yi)) / (yj - yi) + xi
        ) {
          inside = !inside;
        }
      }
      return inside;
    }
    const tl = this.imagePxToContainer(
      pred.x - pred.width / 2,
      pred.y - pred.height / 2,
    );
    const br = this.imagePxToContainer(
      pred.x + pred.width / 2,
      pred.y + pred.height / 2,
    );
    const bx = tl.x;
    const by = tl.y;
    const bw = br.x - tl.x;
    const bh = br.y - tl.y;
    return mx >= bx && mx <= bx + bw && my >= by && my <= by + bh;
  }

  private redrawDetections(): void {
    const canvas = this.overlayCanvas.nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Re-draw any committed drawn rectangle
    if (this.drawnRect) {
      ctx.fillStyle = 'rgba(0, 255, 180, 0.12)';
      ctx.fillRect(
        this.drawnRect.x,
        this.drawnRect.y,
        this.drawnRect.w,
        this.drawnRect.h,
      );
      ctx.strokeStyle = '#00ffb4';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        this.drawnRect.x,
        this.drawnRect.y,
        this.drawnRect.w,
        this.drawnRect.h,
      );
    }

    for (let i = 0; i < this.predictions.length; i++) {
      const pred = this.predictions[i];
      const selected = i === this.selectedRegion;
      const fill = selected
        ? 'rgba(239, 68, 68, 0.4)'
        : 'rgba(0, 255, 180, 0.12)';
      const stroke = selected ? '#ef4444' : '#00ffb4';
      const points: { x: number; y: number }[] = pred.points ?? [];

      if (points.length > 2) {
        ctx.beginPath();
        const p0 = this.imagePxToContainer(points[0].x, points[0].y);
        ctx.moveTo(p0.x, p0.y);
        for (let j = 1; j < points.length; j++) {
          const pj = this.imagePxToContainer(points[j].x, points[j].y);
          ctx.lineTo(pj.x, pj.y);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selected ? 3 : 2;
        ctx.stroke();
      } else {
        const tl = this.imagePxToContainer(
          pred.x - pred.width / 2,
          pred.y - pred.height / 2,
        );
        const br = this.imagePxToContainer(
          pred.x + pred.width / 2,
          pred.y + pred.height / 2,
        );
        const bx = tl.x;
        const by = tl.y;
        const bw = br.x - tl.x;
        const bh = br.y - tl.y;
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
          const projected = points.map((p: any) =>
            this.imagePxToContainer(p.x, p.y),
          );
          dotX = Math.max(...projected.map((p) => p.x));
          dotY = Math.min(...projected.map((p) => p.y));
        } else {
          const tr = this.imagePxToContainer(
            pred.x + pred.width / 2,
            pred.y - pred.height / 2,
          );
          dotX = tr.x;
          dotY = tr.y;
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
    this.rectStart = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
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

  private redrawOverlay(tempRect?: {
    x: number;
    y: number;
    w: number;
    h: number;
  }): void {
    const canvas = this.overlayCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawRect = (r: { x: number; y: number; w: number; h: number }) => {
      ctx.fillStyle = 'rgba(0, 255, 180, 0.12)';
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

    // Make sure the center pin is on the map even if the user hasn't moved
    // it yet — otherwise the screenshot won't contain it.
    if (this.centerPin) {
      this.ensureCenterPin();
    }

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
          outCtx.drawImage(
            img,
            r.left - mapRect.left,
            r.top - mapRect.top,
            r.width,
            r.height,
          );
        } catch {
          // CORS fallback: re-fetch as blob
          const src = img.getAttribute('src');
          if (!src) continue;
          try {
            const resp = await fetch(src);
            const blob = await resp.blob();
            const bmp = await createImageBitmap(blob);
            outCtx.drawImage(
              bmp,
              r.left - mapRect.left,
              r.top - mapRect.top,
              r.width,
              r.height,
            );
            bmp.close();
          } catch {
            /* skip */
          }
        }
      }
    }

    // Draw overlay canvas (detected panels / drawn rectangle)
    if (this.showOverlay && this.overlayCanvas) {
      outCtx.drawImage(this.overlayCanvas.nativeElement, 0, 0);
    }

    // Draw marker pane (pins — DivIcon SVGs) on top of overlay
    const markerPane = mapEl.querySelector(
      '.leaflet-marker-pane',
    ) as HTMLElement;
    if (markerPane) {
      const svgs = Array.from(markerPane.querySelectorAll('svg'));
      for (const svg of svgs) {
        const parent = svg.closest('.leaflet-marker-icon') as HTMLElement;
        if (!parent) continue;
        const r = parent.getBoundingClientRect();
        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], {
          type: 'image/svg+xml;charset=utf-8',
        });
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
          outCtx.drawImage(
            img,
            r.left - mapRect.left,
            r.top - mapRect.top,
            r.width,
            r.height,
          );
        } catch {
          /* skip */
        }
        URL.revokeObjectURL(url);
      }
    }

    const center = this.map.getCenter();
    const dataUrl = outCanvas.toDataURL('image/jpeg', 0.85);
    let withGpsDataUrl = dataUrl;
    try {
      withGpsDataUrl = piexif.insert(
        piexif.dump({
          GPS: {
            [piexif.GPSIFD.GPSLatitudeRef]: center.lat >= 0 ? 'N' : 'S',
            [piexif.GPSIFD.GPSLatitude]: piexif.GPSHelper.degToDmsRational(
              Math.abs(center.lat),
            ),
            [piexif.GPSIFD.GPSLongitudeRef]: center.lng >= 0 ? 'E' : 'W',
            [piexif.GPSIFD.GPSLongitude]: piexif.GPSHelper.degToDmsRational(
              Math.abs(center.lng),
            ),
            [piexif.GPSIFD.GPSDateStamp]: new Date()
              .toISOString()
              .slice(0, 10)
              .replace(/-/g, ':'),
          },
        }),
        dataUrl,
      );
    } catch (e) {
      console.warn('piexif GPS insert failed, saving without EXIF', e);
    }

    const byteString = atob(withGpsDataUrl.split(',')[1]);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'image/jpeg' });

    const filename = name.replace(/[^a-zA-Z0-9_\- ]/g, '') + '.jpg';
    const file = new File([blob], filename, { type: 'image/jpeg' });
    this.zone.run(() => this.screenshotTaken.emit(file));
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
    const layer = L.tileLayer(
      'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      {
        minZoom: 3,
        maxZoom: 21,
        noWrap: true,
        attribution: '&copy; Google',
        crossOrigin: true,
      } as any,
    );
    // 'loading' fires when one+ tiles start fetching after a pan/zoom;
    // 'load' fires when every visible tile has finished (or errored).
    // The detect-panels hint tells users to wait for tiles to fully
    // load — gate that visibly so they know when "ready" actually means
    // ready.
    layer.on('loading', () => {
      this.zone.run(() => {
        this.tilesLoading = true;
      });
    });
    layer.on('load', () => {
      this.zone.run(() => {
        this.tilesLoading = false;
      });
    });
    return layer;
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
          label,
          latitude,
          longitude,
          this.http,
        );
        SatellitePreviewComponent.positionOverlay(
          this.pinOverlay,
          this.map!,
          latitude,
          longitude,
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
