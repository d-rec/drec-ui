import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { AssetService } from '../asset.service';
import { OrgApiLicensesService } from '../../../auth/services/org-api-licenses.service';
import { SatellitePreviewComponent } from '../../../shared/satellite-preview/satellite-preview.component';
import { mapPinIcon } from '../../../shared/map-pin';
import { safeErrorMessage } from '../../../utils/safe-error-message';
import { currentUserIsInternalReviewer } from '../../../utils/role-helper';

@Component({
  standalone: false,
  selector: 'app-ds-satellite-window',
  template: `
    <app-ds-floating-window
      title="🛰 Satellite Map"
      [initX]="600"
      [initY]="390"
      [initWidth]="560"
      [initHeight]="500"
      [maxWidth]="800"
      [maxHeight]="800"
      [maxAspectRatio]="1.2"
      [zIndex]="zIndex"
      (bringToFront)="bringToFront.emit()"
      (close)="close.emit()"
    >
      <div
        style="position:relative;width:100%;height:100%"
        (mousemove)="onOverlayMouseMove($event)"
      >
        <div #mapEl style="width:100%;height:100%"></div>
        <canvas
          #overlayCanvas
          class="detect-overlay"
          [class.visible]="showOverlay"
          [class.hover-panel]="hoverPanelIdx >= 0"
          (click)="onCanvasClick($event)"
        ></canvas>
        <div class="detect-toolbar">
          <button
            class="detect-btn"
            (click)="detectPanels()"
            [disabled]="detecting"
          >
            {{
              detecting
                ? 'Scanning...'
                : showOverlay
                  ? 'Re-scan'
                  : '⚡ Detect Panels'
            }}
          </button>
          <button
            class="detect-btn detect-btn--clear"
            *ngIf="showOverlay"
            (click)="clearOverlay()"
          >
            Clear
          </button>
          <button
            class="detect-btn detect-btn--delete"
            *ngIf="selectedRegion >= 0"
            (click)="deleteSelected()"
          >
            ✕ Remove Region
          </button>
          <span class="detect-count" *ngIf="panelCount > 0"
            >{{ panelCount }} region{{
              panelCount === 1 ? '' : 's'
            }}
            found</span
          >
          <pre
            class="detect-error"
            *ngIf="detectError"
            style="white-space:pre-wrap;font-family:inherit;margin:0;font-size:12px;max-height:300px;overflow:auto"
            >{{ detectError }}</pre
          >
        </div>
        <div class="sat-date" *ngIf="satelliteDate">
          🛰 Latest imagery: {{ satelliteDate }}
        </div>
        <div
          class="detect-confirm-backdrop"
          *ngIf="showDetectConfirm"
          (click)="cancelDetect()"
        >
          <div class="detect-confirm" (click)="$event.stopPropagation()">
            <p class="detect-confirm__msg">{{ detectConfirmMsg }}</p>
            <div class="detect-confirm__actions">
              <button
                type="button"
                class="detect-confirm__btn detect-confirm__btn--cancel"
                (click)="cancelDetect()"
              >
                Cancel
              </button>
              <button
                type="button"
                class="detect-confirm__btn detect-confirm__btn--ok"
                (click)="confirmDetect()"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </app-ds-floating-window>
  `,
  styles: [
    `
      .detect-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s;
        /* Sits between Leaflet's tilePane (200) and markerPane (600), so
           the device pin renders on top of the detected-panel mask. */
        z-index: 450;
      }
      .detect-overlay.visible {
        opacity: 1;
        /* Default: let mouse events fall through to Leaflet so the user
           can still pan the map (adjusts lat/long). The wrapper's
           mousemove handler flips pointer-events to 'auto' below when
           the cursor is over a detected panel. */
        pointer-events: none;
      }
      .detect-overlay.visible.hover-panel {
        pointer-events: auto;
        cursor: pointer;
      }
      .detect-toolbar {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        gap: 6px;
        align-items: center;
        z-index: 600;
      }
      .detect-btn {
        padding: 5px 12px;
        border: none;
        border-radius: 6px;
        background: #0f607f;
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      }
      .detect-btn:hover:not(:disabled) {
        background: #115e59;
      }
      .detect-btn:disabled {
        opacity: 0.6;
        cursor: wait;
      }
      .detect-btn--clear {
        background: #64748b;
      }
      .detect-btn--clear:hover {
        background: #475569;
      }
      .detect-btn--delete {
        background: #dc2626;
      }
      .detect-btn--delete:hover {
        background: #b91c1c;
      }
      .detect-count {
        font-size: 11px;
        color: #fff;
        background: rgba(0, 0, 0, 0.6);
        padding: 4px 8px;
        border-radius: 4px;
      }
      .detect-error {
        font-size: 11px;
        color: #fca5a5;
        background: rgba(0, 0, 0, 0.6);
        padding: 4px 8px;
        border-radius: 4px;
      }
      .sat-date {
        position: absolute;
        bottom: 8px;
        left: 8px;
        font-size: 11px;
        color: #fff;
        background: rgba(0, 0, 0, 0.6);
        padding: 4px 10px;
        border-radius: 4px;
        z-index: 600;
      }
      .detect-confirm-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        z-index: 700;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .detect-confirm {
        background: #fff;
        border-radius: 8px;
        padding: 20px 24px;
        max-width: 320px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        text-align: center;
      }
      .detect-confirm__msg {
        margin: 0 0 16px;
        font-size: 13px;
        line-height: 1.5;
        color: #334155;
      }
      .detect-confirm__actions {
        display: flex;
        gap: 10px;
        justify-content: center;
      }
      .detect-confirm__btn {
        padding: 6px 20px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .detect-confirm__btn--cancel {
        background: #e2e8f0;
        color: #475569;
      }
      .detect-confirm__btn--cancel:hover {
        background: #cbd5e1;
      }
      .detect-confirm__btn--ok {
        background: #0f607f;
        color: #fff;
      }
      .detect-confirm__btn--ok:hover {
        background: #115e59;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SatelliteWindowComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() zIndex = 150;
  @Output() bringToFront = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;
  @ViewChild('overlayCanvas', { static: true })
  overlayCanvas!: ElementRef<HTMLCanvasElement>;

  detecting = false;
  showOverlay = false;
  panelCount = 0;
  detectError = '';
  detectConfirmMsg = '';
  satelliteDate = '';

  // Region selection state
  predictions: any[] = [];
  selectedRegion: number = -1;
  hoverPanelIdx: number = -1;
  private satScaleX = 1;
  private satScaleY = 1;
  private satCropX = 0;
  private satCropY = 0;

  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private sub: Subscription | null = null;

  private pinOverlay: HTMLElement | null = null;

  constructor(
    readonly svc: AssetService,
    private cdr: ChangeDetectorRef,
    private licensesService: OrgApiLicensesService,
    private http: HttpClient,
  ) {}

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
      maxZoom: 21,
      minZoom: 3,
    }).setView([20, 0], 3);

    // Host the overlay canvas in a custom Leaflet pane below markerPane
    // (z 600) so the device pin renders cleanly above any detected-panel
    // mask strokes. tilePane is z 200, overlayPane z 400 — we sit at 300.
    const detectPane = this.map.createPane('detect-overlay-pane');
    detectPane.style.zIndex = '300';
    detectPane.style.pointerEvents = 'none';
    detectPane.appendChild(this.overlayCanvas.nativeElement);

    const sizeCanvas = (canvas: HTMLCanvasElement) => {
      const w = this.mapEl.nativeElement.clientWidth;
      const h = this.mapEl.nativeElement.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      // Leaflet panes are children of .leaflet-map-pane which is 0×0;
      // give the canvas explicit pixel dimensions so it doesn't collapse.
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    // Keep detected panel masks visually anchored to the imagery as the
    // reviewer pans/zooms.
    const reproject = () => {
      if (!this.showOverlay) return;
      sizeCanvas(this.overlayCanvas.nativeElement);
      this.satRedraw();
    };
    // moveend/zoomend only: during the drag/zoom animation Leaflet
    // translates the whole mapPane (canvas included), so the masks visually
    // track the tiles for free. Listening on 'move' would double-translate.
    this.map.on('moveend zoomend viewreset', reproject);

    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: '© Google',
      maxZoom: 21,
      crossOrigin: 'anonymous',
    } as L.TileLayerOptions).addTo(this.map);

    this.updateMarkers();

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapEl.nativeElement);

    this.sub = this.svc.flyTo$.subscribe(({ lat, lng }) => {
      this.clearOverlay();
      this.map?.setView([lat, lng], 19, { animate: false });
      this.updateMarkers();
      this.satelliteDate = '';
      this.cdr.markForCheck();
      this.svc.getSatelliteDate(lat, lng).subscribe({
        next: (res) => {
          if (res.date) {
            const d = new Date(res.date);
            this.satelliteDate = d.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
          }
          this.cdr.markForCheck();
        },
      });
    });
  }

  ngOnChanges(): void {
    if (this.map) this.updateMarkers();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.sub?.unsubscribe();
    this.map?.remove();
  }

  showDetectConfirm = false;

  detectPanels(): void {
    if (!this.map || this.detecting) return;

    if (currentUserIsInternalReviewer()) {
      this.detecting = true;
      this.detectError = '';
      this.cdr.markForCheck();
      this.captureAndDetect();
      return;
    }

    this.licensesService.getCredits().subscribe({
      next: (credits) => {
        if (credits.roboflow.hasOwnKey) {
          // Org has own key — skip dialog, detect immediately
          this.detecting = true;
          this.detectError = '';
          this.cdr.markForCheck();
          this.captureAndDetect();
          return;
        }
        if (!credits.roboflow.platformKeyConfigured) {
          this.detectError =
            'Solar panel detection is not configured on this environment. An admin must add a Roboflow API key in Organization > Licenses (or your org can supply its own).';
          this.cdr.markForCheck();
          return;
        }
        if (credits.roboflow.credits <= 0) {
          this.detectError =
            'Your free Roboflow credits are used up. Add your own API key in Organization > Licenses to keep scanning.';
          this.cdr.markForCheck();
          return;
        }
        this.detectConfirmMsg =
          `You have ${credits.roboflow.credits} free Roboflow credit(s) remaining \u2014 proceed?\n\n` +
          `This will use 1 credit. Once exhausted, you\u2019ll need to add your own API key in Organization > Licenses.`;
        this.showDetectConfirm = true;
        this.cdr.markForCheck();
      },
      error: () => {
        // Credits endpoint unavailable — show generic warning
        this.detectConfirmMsg =
          'Panel detection uses a limited number of free scans. Proceed anyway?';
        this.showDetectConfirm = true;
        this.cdr.markForCheck();
      },
    });
  }

  cancelDetect(): void {
    this.showDetectConfirm = false;
    this.cdr.markForCheck();
  }

  confirmDetect(): void {
    this.showDetectConfirm = false;
    this.detecting = true;
    this.detectError = '';
    this.cdr.markForCheck();
    this.captureAndDetect();
  }

  clearOverlay(): void {
    this.showOverlay = false;
    this.panelCount = 0;
    this.detectError = '';
    this.predictions = [];
    this.selectedRegion = -1;
    const canvas = this.overlayCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    this.cdr.markForCheck();
  }

  /** Hit-test mouse position against detected panels. When over a panel,
   *  the canvas captures the click (cursor: pointer); otherwise the canvas
   *  becomes click-through so Leaflet receives the drag and shows its own
   *  grab cursor — letting the reviewer pan the map to nudge lat/long. */
  onOverlayMouseMove(event: MouseEvent): void {
    if (!this.showOverlay || !this.predictions.length) {
      if (this.hoverPanelIdx !== -1) {
        this.hoverPanelIdx = -1;
        this.cdr.markForCheck();
      }
      return;
    }
    const canvas = this.overlayCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const cssToCanvasX = canvas.width / rect.width;
    const cssToCanvasY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * cssToCanvasX;
    const y = (event.clientY - rect.top) * cssToCanvasY;

    let hit = -1;
    for (let i = this.predictions.length - 1; i >= 0; i--) {
      if (this.satHitTest(this.predictions[i], x, y)) {
        hit = i;
        break;
      }
    }
    if (hit !== this.hoverPanelIdx) {
      this.hoverPanelIdx = hit;
      this.cdr.markForCheck();
    }
  }

  onCanvasClick(event: MouseEvent): void {
    if (!this.predictions.length) return;
    const canvas = this.overlayCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    // Scale from CSS pixels to canvas coordinate space
    const cssToCanvasX = canvas.width / rect.width;
    const cssToCanvasY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * cssToCanvasX;
    const y = (event.clientY - rect.top) * cssToCanvasY;

    for (let i = this.predictions.length - 1; i >= 0; i--) {
      if (this.satHitTest(this.predictions[i], x, y)) {
        this.selectedRegion = this.selectedRegion === i ? -1 : i;
        this.satRedraw();
        this.cdr.detectChanges();
        return;
      }
    }
    this.selectedRegion = -1;
    this.satRedraw();
    this.cdr.detectChanges();
  }

  deleteSelected(): void {
    if (
      this.selectedRegion < 0 ||
      this.selectedRegion >= this.predictions.length
    )
      return;
    this.predictions.splice(this.selectedRegion, 1);
    this.selectedRegion = -1;
    this.panelCount = this.predictions.length;
    this.satRedraw();
    this.cdr.markForCheck();
  }

  /** Current container-pixel polygon for a prediction. Derived from the
   *  frozen latLngs so the mask tracks pan/zoom; falls back to the legacy
   *  image-pixel math for any prediction without latLngs (shouldn't
   *  happen in practice — drawDetections populates them). */
  private satShape(pred: any): {
    polygon: { x: number; y: number }[];
    bbox: { x: number; y: number; w: number; h: number };
  } {
    const map = this.map;
    if (map && pred.latLngs?.length > 2) {
      const polygon = pred.latLngs.map((ll: L.LatLng) => {
        const p = map.latLngToContainerPoint(ll);
        return { x: p.x, y: p.y };
      });
      const xs = polygon.map((p: { x: number }) => p.x);
      const ys = polygon.map((p: { y: number }) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        polygon,
        bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      };
    }
    if (map && pred.bboxLatLng?.length === 4) {
      const corners = pred.bboxLatLng.map((ll: L.LatLng) =>
        map.latLngToContainerPoint(ll),
      );
      const xs = corners.map((p: { x: number }) => p.x);
      const ys = corners.map((p: { y: number }) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        polygon: [],
        bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
      };
    }
    // Legacy fallback
    const points: { x: number; y: number }[] = pred.points ?? [];
    const polygon = points.map((p) => ({
      x: p.x * this.satScaleX + this.satCropX,
      y: p.y * this.satScaleY + this.satCropY,
    }));
    const bx = (pred.x - pred.width / 2) * this.satScaleX + this.satCropX;
    const by = (pred.y - pred.height / 2) * this.satScaleY + this.satCropY;
    return {
      polygon,
      bbox: {
        x: bx,
        y: by,
        w: pred.width * this.satScaleX,
        h: pred.height * this.satScaleY,
      },
    };
  }

  private satHitTest(pred: any, mx: number, my: number): boolean {
    const shape = this.satShape(pred);
    if (shape.polygon.length > 2) {
      const scaled = shape.polygon;
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
    const b = shape.bbox;
    return mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
  }

  private satRedraw(): void {
    const canvas = this.overlayCanvas.nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < this.predictions.length; i++) {
      const pred = this.predictions[i];
      const selected = i === this.selectedRegion;
      const stroke = selected ? '#ef4444' : '#00ffb4';
      const shape = this.satShape(pred);

      // Outline-only: no translucent fill so the device pin (and the
      // panel imagery itself) stay fully visible underneath. Selected
      // region gets a subtle red fill purely as a hit-confirmation.
      if (shape.polygon.length > 2) {
        ctx.beginPath();
        ctx.moveTo(shape.polygon[0].x, shape.polygon[0].y);
        for (let j = 1; j < shape.polygon.length; j++) {
          ctx.lineTo(shape.polygon[j].x, shape.polygon[j].y);
        }
        ctx.closePath();
        if (selected) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.fill();
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selected ? 3 : 2;
        ctx.stroke();
      } else {
        if (selected) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.fillRect(shape.bbox.x, shape.bbox.y, shape.bbox.w, shape.bbox.h);
        }
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selected ? 3 : 2;
        ctx.strokeRect(shape.bbox.x, shape.bbox.y, shape.bbox.w, shape.bbox.h);
      }

      // Red delete-hint dot at top-right corner of selected region
      if (selected) {
        let dotX: number, dotY: number;
        if (shape.polygon.length > 2) {
          const xs = shape.polygon.map((p) => p.x);
          const ys = shape.polygon.map((p) => p.y);
          dotX = Math.max(...xs);
          dotY = Math.min(...ys);
        } else {
          dotX = shape.bbox.x + shape.bbox.w;
          dotY = shape.bbox.y;
        }
        ctx.beginPath();
        ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u00d7', dotX, dotY + 0.5);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
      }
    }
  }

  private async captureAndDetect(): Promise<void> {
    const map = this.map;
    if (!map) {
      this.detecting = false;
      return;
    }

    // If the user resized the floating window between captures, Leaflet's
    // internal container size may still be stale (ResizeObserver runs
    // async). Force a sync re-measure so getCenter / latLngToContainerPoint
    // match the current DOM, otherwise the captured 512×512 ends up offset
    // from where the masks get drawn.
    map.invalidateSize({ animate: false });

    // Capture an image that covers the full visible map area at zoom 19,
    // capped at MAX_DIM on the longer side so uploads stay reasonable.
    // Fetching tiles ourselves (instead of screenshotting the visible viewport)
    // makes the capture independent of devicePixelRatio + OS, so Roboflow
    // always sees the same ground area at the same resolution.
    const TILE = 256;
    const z = 19;
    // Capture at up to 1536px on the long side (was 768). SAM 3 was
    // starved of detail: a maximized satellite window got downscaled to
    // 768 and JPEG-compressed hard, so overhead panels dissolved into
    // soft blocks and the model returned 0 detections. A higher ceiling
    // gives full-res capture for large windows (and makes the
    // capture↔container pixel mapping 1:1 more often, improving mask
    // placement). drec-api accepts 10 MB bodies and stage-api (ALB) was
    // verified to accept 6 MB, so the resulting larger JPEG is fine.
    const MAX_DIM = 1536;
    const mapElNode = this.mapEl.nativeElement;
    const visW = mapElNode.offsetWidth;
    const visH = mapElNode.offsetHeight;
    const scale = Math.min(1, MAX_DIM / Math.max(visW, visH));
    const captureW = Math.max(256, Math.round(visW * scale));
    const captureH = Math.max(256, Math.round(visH * scale));
    const halfW = captureW / 2;
    const halfH = captureH / 2;

    const center = map.getCenter();
    const lat = center.lat;
    const lng = center.lng;

    // Web Mercator: lat/lng -> global pixel coords at zoom z
    const sinLat = Math.sin((lat * Math.PI) / 180);
    const px = ((lng + 180) / 360) * Math.pow(2, z) * TILE;
    const py =
      (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) *
      Math.pow(2, z) *
      TILE;

    const topLeftPx = px - halfW;
    const topLeftPy = py - halfH;

    const tx0 = Math.floor(topLeftPx / TILE);
    const ty0 = Math.floor(topLeftPy / TILE);
    const tx1 = Math.floor((topLeftPx + captureW - 1) / TILE);
    const ty1 = Math.floor((topLeftPy + captureH - 1) / TILE);

    const canvas = document.createElement('canvas');
    canvas.width = captureW;
    canvas.height = captureH;
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

    // Verify canvas isn't blank
    const sample = ctx.getImageData(
      Math.floor(halfW),
      Math.floor(halfH),
      1,
      1,
    ).data;
    if (
      sample[0] === 0 &&
      sample[1] === 0 &&
      sample[2] === 0 &&
      sample[3] === 0
    ) {
      this.detecting = false;
      this.detectError = 'Could not capture map tiles';
      this.cdr.markForCheck();
      return;
    }

    // Quality 0.9 (was 0.6): JPEG blocking artefacts at 0.6 were part of
    // what made SAM 3 miss panels on overhead imagery.
    const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];

    // Body-size ceiling. The old 250 KB cap cited a "~256 KB stage ingress
    // cap" that no longer exists — stage now fronts the API with an AWS ALB
    // (no small proxy-body-size limit), drec-api's body-parser allows 10 MB
    // (src/index.ts), and stage-api was verified to accept a 6 MB body. Cap
    // at 6 MB so a full-res, high-quality capture reaches Roboflow (which
    // itself accepts ~5–6 MB) instead of being pre-emptively downgraded.
    const MAX_BASE64_KB = 6000;
    if (base64.length / 1024 > MAX_BASE64_KB) {
      this.detecting = false;
      this.detectError =
        `Captured image is too large (${Math.round(base64.length / 1024)} KB; cap ${MAX_BASE64_KB} KB). ` +
        `Shrink the satellite window and try again.`;
      this.cdr.markForCheck();
      return;
    }

    // Map captured-image coords back onto the visible map's container.
    // The capture is centered on the current map center, so image pixel
    // (halfW, halfH) corresponds to the visible map's container point for
    // that center latLng. Robust to user panning (uses Leaflet projection).
    const w = visW;
    const h = visH;
    const centerPt = map.latLngToContainerPoint(center);
    const cropX = centerPt.x - halfW;
    const cropY = centerPt.y - halfH;

    this.svc.detectPanels(base64).subscribe({
      next: (data) =>
        this.drawDetections(data, w, h, cropX, cropY, captureW, captureH),
      error: (err) => {
        this.detectError = 'Detection failed: ' + safeErrorMessage(err);
        this.detecting = false;
        this.cdr.markForCheck();
      },
    });
  }

  private drawDetections(
    data: any,
    w: number,
    h: number,
    cropX: number,
    cropY: number,
    cropW: number,
    cropH: number,
  ): void {
    const canvas = this.overlayCanvas.nativeElement;
    canvas.width = w;
    canvas.height = h;
    // Canvas lives in a Leaflet pane whose parent is 0×0; explicit pixel
    // dimensions stop the displayed area from collapsing.
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const outputs = data?.outputs?.[0];
    const preds = outputs?.predictions?.predictions ?? [];

    const imgW = outputs?.predictions?.image?.width ?? cropW;
    const imgH = outputs?.predictions?.image?.height ?? cropH;
    this.satScaleX = cropW / imgW;
    this.satScaleY = cropH / imgH;
    this.satCropX = cropX;
    this.satCropY = cropY;

    // Freeze each prediction's geographic footprint so it stays anchored
    // to the imagery as the reviewer pans/zooms the map.
    const map = this.map;
    if (map) {
      for (const p of preds) {
        const points: { x: number; y: number }[] = p.points ?? [];
        if (points.length > 2) {
          p.latLngs = points.map((pt) =>
            map.containerPointToLatLng([
              pt.x * this.satScaleX + this.satCropX,
              pt.y * this.satScaleY + this.satCropY,
            ]),
          );
        } else {
          const bx = (p.x - p.width / 2) * this.satScaleX + this.satCropX;
          const by = (p.y - p.height / 2) * this.satScaleY + this.satCropY;
          const bw = p.width * this.satScaleX;
          const bh = p.height * this.satScaleY;
          p.bboxLatLng = [
            map.containerPointToLatLng([bx, by]),
            map.containerPointToLatLng([bx + bw, by]),
            map.containerPointToLatLng([bx + bw, by + bh]),
            map.containerPointToLatLng([bx, by + bh]),
          ];
        }
      }
    }

    this.predictions = preds;
    this.selectedRegion = -1;
    this.panelCount = preds.length;

    if (this.panelCount === 0) {
      const hasOutputs = !!outputs;
      const hasImage = !!outputs?.predictions?.image;
      // Don't tell reviewers to "zoom in" — the free basemap (Google /
      // Esri) has no native imagery beyond ~z19 for most sites, so
      // zooming just upsamples a blurry image. At ~0.3 m/pixel, small
      // rooftop / mini-grid arrays are at or below what the model can
      // resolve, so 0 panels here usually means the imagery is too coarse
      // for this location, not that the reviewer did anything wrong.
      const hint =
        hasOutputs && hasImage
          ? 'Model ran but found no panels. The satellite imagery for this ' +
            'location is likely at its resolution limit (~0.3 m/pixel) — small ' +
            'arrays may be too coarse to detect. Recenter on the array and ' +
            'retry; if it still finds nothing, verify the panels by eye.'
          : 'Unexpected model response (no `outputs[0].predictions`).';
      let raw = '';
      try {
        raw = JSON.stringify(
          data,
          (_k, v) => {
            if (
              v &&
              typeof v === 'object' &&
              v.type === 'base64' &&
              typeof v.value === 'string'
            ) {
              const { value, ...rest } = v;
              return {
                ...rest,
                value: `[${value.length} base64 chars omitted]`,
              };
            }
            return v;
          },
          2,
        );
        if (raw.length > 1500) raw = raw.slice(0, 1500) + '\n…[truncated]';
      } catch {
        raw = String(data);
      }
      this.detectError = `${hint}\n\nRoboflow response:\n${raw}`;
      this.detecting = false;
      this.cdr.markForCheck();
      return;
    }

    this.satRedraw();
    this.showOverlay = true;
    this.detecting = false;
    this.cdr.markForCheck();
  }

  private updateMarkers(): void {
    this.markers.forEach((m) => m.remove());
    this.markers = [];

    const selectedId = this.svc.selectedId$.value;
    const assets = selectedId
      ? this.svc.assets$.value.filter((a) => a.id === selectedId)
      : this.svc.assets$.value;

    for (const asset of assets) {
      if (asset.lat === null || asset.long === null) continue;
      // Same red as the registrant-side centre pin in map.component for
      // visual consistency across reviewer + registrant maps. Status is
      // surfaced via the asset list / status pill, not the pin colour.
      const color = '#e53e3e';

      const lat = asset.lat;
      const lng = asset.long;
      const marker = L.marker([lat, lng], { icon: mapPinIcon(color) })
        .on('mouseover', () => {
          this.removePinOverlay();
          this.pinOverlay = SatellitePreviewComponent.createOverlay(
            asset.siteName,
            lat,
            lng,
            this.http,
          );
          SatellitePreviewComponent.positionOverlay(
            this.pinOverlay,
            this.map!,
            lat,
            lng,
          );
        })
        .on('mouseout', () => this.removePinOverlay())
        .addTo(this.map!);

      this.markers.push(marker);
    }
  }

  private removePinOverlay(): void {
    if (this.pinOverlay) {
      this.pinOverlay.remove();
      this.pinOverlay = null;
    }
  }
}
