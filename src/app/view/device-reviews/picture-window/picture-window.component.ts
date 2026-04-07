import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { AssetService } from '../asset.service';
import { OrgApiLicensesService } from '../../../auth/services/org-api-licenses.service';
import Tesseract from 'tesseract.js';

@Component({
  standalone: false,
  selector: 'app-ds-picture-window',
  templateUrl: './picture-window.component.html',
  styleUrls: ['./picture-window.component.scss'],
})
export class PictureWindowComponent implements OnInit, OnDestroy {
  @Input() zIndex = 400;
  @Output() bringToFront = new EventEmitter<void>();

  @ViewChild('imgEl') imgEl!: ElementRef<HTMLImageElement>;
  @ViewChild('overlayCanvas') overlayCanvas!: ElementRef<HTMLCanvasElement>;

  readonly url$ = this.svc.viewPictureUrl$;
  private sub!: Subscription;

  isScreenshot = false;

  // OCR state
  ocrText: string | null = null;
  ocrRunning = false;
  ocrProgress = 0;
  ocrSearch = '';

  // Detect panels state
  detecting = false;
  showOverlay = false;
  panelCount = 0;
  detectDone = false;
  detectError = '';
  showDetectConfirm = false;
  detectConfirmMsg = '';

  private currentUrl: string | null = null;

  constructor(
    readonly svc: AssetService,
    private licensesService: OrgApiLicensesService,
  ) {}

  ngOnInit(): void {
    this.sub = this.svc.viewPictureUrl$.subscribe((url) => {
      if (url) this.bringToFront.emit();
      this.currentUrl = url;
      this.isScreenshot = this.svc.viewPictureIsScreenshot$.value;
      // Reset state when picture changes
      this.ocrText = null;
      this.ocrRunning = false;
      this.ocrProgress = 0;
      this.clearOverlay();
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  close(): void {
    this.svc.viewPicture(null);
  }

  // ── OCR ──────────────────────────────────────────────────────────────

  async runOcr(): Promise<void> {
    if (!this.currentUrl || this.ocrRunning) return;
    this.ocrRunning = true;
    this.ocrText = null;
    this.ocrProgress = 0;

    try {
      const result = await Tesseract.recognize(this.currentUrl, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            this.ocrProgress = Math.round(m.progress * 100);
          }
        },
      });
      this.ocrText = result.data.text;
    } catch (err: any) {
      this.ocrText = `OCR failed: ${err.message || err}`;
    } finally {
      this.ocrRunning = false;
    }
  }

  copyOcrText(): void {
    if (this.ocrText) {
      navigator.clipboard.writeText(this.ocrText);
    }
  }

  highlightOcr(text: string, term: string): string {
    if (!term) return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const termEscaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return escaped.replace(
      new RegExp(termEscaped, 'gi'),
      (m) => `<mark>${m}</mark>`,
    );
  }

  // ── Detect Panels ────────────────────────────────────────────────────

  detectPanels(): void {
    if (this.detecting) return;

    this.licensesService.getCredits().subscribe({
      next: (credits) => {
        if (credits.roboflow.hasOwnKey) {
          this.detecting = true;
          this.detectError = '';
          this.runDetection();
          return;
        }
        if (credits.roboflow.credits <= 0) {
          this.detectError =
            'Roboflow credits exhausted. Add your own API key in Organization > Licenses.';
          return;
        }
        this.detectConfirmMsg =
          `You have ${credits.roboflow.credits} free Roboflow credit(s) remaining \u2014 proceed?\n\n` +
          `This will use 1 credit. Once exhausted, you\u2019ll need to add your own API key in Organization > Licenses.`;
        this.showDetectConfirm = true;
      },
      error: () => {
        this.detectConfirmMsg =
          'Panel detection uses a limited number of free scans. Proceed anyway?';
        this.showDetectConfirm = true;
      },
    });
  }

  cancelDetect(): void {
    this.showDetectConfirm = false;
  }

  confirmDetect(): void {
    this.showDetectConfirm = false;
    this.detecting = true;
    this.detectError = '';
    this.runDetection();
  }

  clearOverlay(): void {
    this.showOverlay = false;
    this.panelCount = 0;
    this.detectDone = false;
    this.detectError = '';
    if (this.overlayCanvas?.nativeElement) {
      const canvas = this.overlayCanvas.nativeElement;
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  private runDetection(): void {
    const img = this.imgEl?.nativeElement;
    if (!img || !img.complete) {
      this.detecting = false;
      this.detectError = 'Image not loaded';
      return;
    }

    const canvas = document.createElement('canvas');
    const maxDim = 640;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d')!;

    try {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } catch {
      // CORS — re-fetch as blob
      this.fetchAndDetect(img.src);
      return;
    }

    // Check canvas isn't tainted
    try {
      canvas.toDataURL();
    } catch {
      this.fetchAndDetect(img.src);
      return;
    }

    const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    this.sendDetection(base64);
  }

  private async fetchAndDetect(src: string): Promise<void> {
    try {
      const resp = await fetch(src);
      const blob = await resp.blob();
      const bmp = await createImageBitmap(blob);

      const canvas = document.createElement('canvas');
      const maxDim = 640;
      const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();

      const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      this.sendDetection(base64);
    } catch (err: any) {
      this.detecting = false;
      this.detectError = 'Could not load image for detection';
    }
  }

  private sendDetection(base64: string): void {
    this.svc.detectPanels(base64).subscribe({
      next: (data) => this.drawDetections(data),
      error: (err) => {
        this.detectError =
          'Detection failed: ' + (err?.error?.message || err?.message || err);
        this.detecting = false;
      },
    });
  }

  private drawDetections(data: any): void {
    const img = this.imgEl.nativeElement;
    const w = img.clientWidth;
    const h = img.clientHeight;

    const canvas = this.overlayCanvas.nativeElement;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);

    const outputs = data?.outputs?.[0];
    const predictions = outputs?.predictions?.predictions ?? [];

    const imgW = outputs?.predictions?.image?.width ?? img.naturalWidth;
    const imgH = outputs?.predictions?.image?.height ?? img.naturalHeight;
    const scaleX = w / imgW;
    const scaleY = h / imgH;

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
        ctx.moveTo(points[0].x * scaleX, points[0].y * scaleY);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x * scaleX, points[i].y * scaleY);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 255, 180, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#00ffb4';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        const bx = (pred.x - pred.width / 2) * scaleX;
        const by = (pred.y - pred.height / 2) * scaleY;
        const bw = pred.width * scaleX;
        const bh = pred.height * scaleY;
        ctx.fillStyle = 'rgba(0, 255, 180, 0.3)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#00ffb4';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);
      }

      if (pred.confidence) {
        const cx = (pred.x - pred.width / 2) * scaleX;
        const cy = (pred.y - pred.height / 2) * scaleY - 4;
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
    this.detectDone = true;
    this.detecting = false;
  }
}
