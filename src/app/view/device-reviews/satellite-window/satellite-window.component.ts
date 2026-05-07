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

const STATUS_COLOR: Record<string, string> = {
  approved: '#22c55e',
  rejected: '#ef4444',
  pending: '#f59e0b',
  legacy: '#a0845c',
};

@Component({
  standalone: false,
  selector: 'app-ds-satellite-window',
  template: `
    <app-ds-floating-window
      title="🛰 Satellite Map"
      [initX]="600"
      [initY]="390"
      [initWidth]="560"
      [initHeight]="360"
      [zIndex]="zIndex"
      (bringToFront)="bringToFront.emit()"
      (close)="close.emit()"
    >
      <div style="position:relative;width:100%;height:100%">
        <div #mapEl style="width:100%;height:100%"></div>
        <canvas
          #overlayCanvas
          class="detect-overlay"
          [class.visible]="showOverlay"
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
          <pre class="detect-error" *ngIf="detectError"
               style="white-space:pre-wrap;font-family:inherit;margin:0;font-size:12px;max-height:300px;overflow:auto">{{ detectError }}</pre>
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
        z-index: 500;
      }
      .detect-overlay.visible {
        opacity: 0.75;
        pointer-events: auto;
        cursor: crosshair;
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
        background: #0F607F;
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
        background: #0F607F;
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
      this.updateMarkers();
      this.map?.setView([lat, lng], 19, { animate: false });
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
        if (credits.roboflow.credits <= 0) {
          this.detectError =
            'Roboflow credits exhausted. Add your own API key in Organization > Licenses.';
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

  private satHitTest(pred: any, mx: number, my: number): boolean {
    const points: { x: number; y: number }[] = pred.points ?? [];
    if (points.length > 2) {
      const scaled = points.map((p) => ({
        x: p.x * this.satScaleX + this.satCropX,
        y: p.y * this.satScaleY + this.satCropY,
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
    const bx = (pred.x - pred.width / 2) * this.satScaleX + this.satCropX;
    const by = (pred.y - pred.height / 2) * this.satScaleY + this.satCropY;
    const bw = pred.width * this.satScaleX;
    const bh = pred.height * this.satScaleY;
    return mx >= bx && mx <= bx + bw && my >= by && my <= by + bh;
  }

  private satRedraw(): void {
    const canvas = this.overlayCanvas.nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
        ctx.moveTo(
          points[0].x * this.satScaleX + this.satCropX,
          points[0].y * this.satScaleY + this.satCropY,
        );
        for (let j = 1; j < points.length; j++) {
          ctx.lineTo(
            points[j].x * this.satScaleX + this.satCropX,
            points[j].y * this.satScaleY + this.satCropY,
          );
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selected ? 3 : 2;
        ctx.stroke();
      } else {
        const bx = (pred.x - pred.width / 2) * this.satScaleX + this.satCropX;
        const by = (pred.y - pred.height / 2) * this.satScaleY + this.satCropY;
        const bw = pred.width * this.satScaleX;
        const bh = pred.height * this.satScaleY;
        ctx.fillStyle = fill;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selected ? 3 : 2;
        ctx.strokeRect(bx, by, bw, bh);
      }

      // Red delete-hint dot at top-right corner of selected region
      if (selected) {
        let dotX: number, dotY: number;
        if (points.length > 2) {
          const xs = points.map((p) => p.x * this.satScaleX + this.satCropX);
          const ys = points.map((p) => p.y * this.satScaleY + this.satCropY);
          dotX = Math.max(...xs);
          dotY = Math.min(...ys);
        } else {
          dotX = (pred.x + pred.width / 2) * this.satScaleX + this.satCropX;
          dotY = (pred.y - pred.height / 2) * this.satScaleY + this.satCropY;
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

    // Capture a fixed 512x512 image centered on the map center at zoom 19.
    // Fetching tiles ourselves (instead of screenshotting the visible viewport)
    // makes the capture independent of window size, devicePixelRatio, and OS,
    // so Roboflow always sees the same ground area at the same resolution.
    // 512 covers ~150 m of ground at zoom 19; PNG ≈ 500 KB after base64.
    const SIZE = 512;
    const TILE = 256;
    const HALF = SIZE / 2;
    const z = 19;

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

    // Verify canvas isn't blank
    const sample = ctx.getImageData(HALF, HALF, 1, 1).data;
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

    const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    // Map captured-image coords back onto the visible map's container.
    // The capture is centered on the current map center, so image pixel
    // (HALF, HALF) corresponds to the visible map's container point for
    // that center latLng. Robust to user panning (uses Leaflet projection).
    const mapEl = this.mapEl.nativeElement;
    const w = mapEl.offsetWidth;
    const h = mapEl.offsetHeight;
    const centerPt = map.latLngToContainerPoint(center);
    const cropX = centerPt.x - HALF;
    const cropY = centerPt.y - HALF;

    this.svc.detectPanels(base64).subscribe({
      next: (data) =>
        this.drawDetections(data, w, h, cropX, cropY, SIZE, SIZE),
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

    const outputs = data?.outputs?.[0];
    const preds = outputs?.predictions?.predictions ?? [];

    const imgW = outputs?.predictions?.image?.width ?? cropW;
    const imgH = outputs?.predictions?.image?.height ?? cropH;
    this.satScaleX = cropW / imgW;
    this.satScaleY = cropH / imgH;
    this.satCropX = cropX;
    this.satCropY = cropY;

    this.predictions = preds;
    this.selectedRegion = -1;
    this.panelCount = preds.length;

    if (this.panelCount === 0) {
      const hasOutputs = !!outputs;
      const hasImage = !!outputs?.predictions?.image;
      const hint = hasOutputs && hasImage
        ? 'Model ran but found 0 panels. Try zooming in (z19+), recentering, or wait for satellite tiles to fully load.'
        : 'Unexpected model response (no `outputs[0].predictions`).';
      let raw = '';
      try {
        raw = JSON.stringify(data, null, 2);
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
      const color = STATUS_COLOR[asset.status] ?? '#dc2626';

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
