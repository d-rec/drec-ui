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
          <span class="detect-count" *ngIf="panelCount > 0"
            >{{ panelCount }} region{{ panelCount === 1 ? '' : 's' }}
            found</span
          >
          <span class="detect-error" *ngIf="detectError">{{ detectError }}</span>
        </div>
        <div class="sat-date" *ngIf="satelliteDate">
          🛰 Latest imagery: {{ satelliteDate }}
        </div>
        <div class="detect-confirm-backdrop" *ngIf="showDetectConfirm" (click)="cancelDetect()">
          <div class="detect-confirm" (click)="$event.stopPropagation()">
            <p class="detect-confirm__msg">{{ detectConfirmMsg }}</p>
            <div class="detect-confirm__actions">
              <button type="button" class="detect-confirm__btn detect-confirm__btn--cancel" (click)="cancelDetect()">Cancel</button>
              <button type="button" class="detect-confirm__btn detect-confirm__btn--ok" (click)="confirmDetect()">OK</button>
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
        background: #0f766e;
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
        background: #0f766e;
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
      scrollWheelZoom: false,
      maxZoom: 19,
      minZoom: 3,
    }).setView([20, 0], 3);

    this.map.scrollWheelZoom.disable();
    // Prevent Leaflet from ever re-enabling scroll zoom
    const container = this.map.getContainer();
    container.addEventListener('wheel', (e: WheelEvent) => { e.preventDefault(); e.stopPropagation(); }, { passive: false, capture: true });

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
      this.map?.setView([lat, lng], this.map.getMaxZoom(), { animate: false });
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
          this.waitForTilesThenCapture();
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
    this.waitForTilesThenCapture();
  }

  private waitForTilesThenCapture(): void {
    const mapEl = this.mapEl.nativeElement;
    const imgs = mapEl.querySelectorAll('.leaflet-tile-pane img');
    const allLoaded = Array.from(imgs).every(
      (img: any) => img.complete && img.naturalWidth > 0,
    );

    if (allLoaded && imgs.length > 0) {
      setTimeout(() => this.captureAndDetect(), 200);
    } else {
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

  clearOverlay(): void {
    this.showOverlay = false;
    this.panelCount = 0;
    this.detectError = '';
    const canvas = this.overlayCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    this.cdr.markForCheck();
  }

  private async captureAndDetect(): Promise<void> {
    const mapEl = this.mapEl.nativeElement;
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
      this.cdr.markForCheck();
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
      this.cdr.markForCheck();
      return;
    }

    // Crop center 70% of viewport
    const cropFraction = 0.7;
    const cropW = Math.round(w * cropFraction);
    const cropH = Math.round(h * cropFraction);
    const cropX = Math.round((w - cropW) / 2);
    const cropY = Math.round((h - cropH) / 2);

    const cropCanvas = document.createElement('canvas');
    const maxDim = 1024;
    const scale = Math.min(1, maxDim / Math.max(cropW, cropH));
    cropCanvas.width = Math.round(cropW * scale);
    cropCanvas.height = Math.round(cropH * scale);
    cropCanvas.getContext('2d')!.drawImage(
      srcCanvas, cropX, cropY, cropW, cropH,
      0, 0, cropCanvas.width, cropCanvas.height,
    );

    const base64 = cropCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    // Call backend proxy (keeps Roboflow API key server-side)
    this.svc.detectPanels(base64).subscribe({
      next: (data) => this.drawDetections(data, w, h, cropX, cropY, cropW, cropH),
      error: (err) => {
        this.detectError =
          'Detection failed: ' + (err?.error?.message || err?.message || err);
        this.detecting = false;
        this.cdr.markForCheck();
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

    // Roboflow coordinates are relative to the cropped image we sent.
    // Scale them to crop size, then offset to full-map position.
    const imgW = outputs?.predictions?.image?.width ?? cropW;
    const imgH = outputs?.predictions?.image?.height ?? cropH;
    const scaleX = cropW / imgW;
    const scaleY = cropH / imgH;

    this.panelCount = predictions.length;
    if (this.panelCount === 0) {
      this.detectError = 'No solar panels detected in this image';
      this.detecting = false;
      this.cdr.markForCheck();
      return;
    }

    for (const pred of predictions) {
      const points: { x: number; y: number }[] = pred.points ?? [];

      if (points.length > 2) {
        // Draw filled polygon (offset from crop origin)
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
        // Fallback: draw bounding box
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

      // Confidence label
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

      const icon = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      const lat = asset.lat;
      const lng = asset.long;
      const marker = L.marker([lat, lng], { icon })
        .on('mouseover', () => {
          this.removePinOverlay();
          this.pinOverlay = SatellitePreviewComponent.createOverlay(
            asset.siteName, lat, lng, this.http,
          );
          SatellitePreviewComponent.positionOverlay(
            this.pinOverlay, this.map!, lat, lng,
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
