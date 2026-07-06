import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { AssetService } from '../asset.service';

@Component({
  standalone: false,
  selector: 'app-ds-pdf-window',
  templateUrl: './pdf-window.component.html',
  styleUrls: ['./pdf-window.component.scss'],
})
export class PdfWindowComponent implements OnInit, OnDestroy {
  @Input() zIndex = 400;
  @Output() bringToFront = new EventEmitter<void>();

  safeUrl: SafeResourceUrl | null = null;
  currentUrl: string | null = null;
  fileName = 'Document Viewer';
  previewType: 'pdf' | 'excel' = 'pdf';
  sldDeviceId: number | null = null;
  private sub!: Subscription;
  private sldSub!: Subscription;
  private blobUrl: string | null = null;

  constructor(
    readonly svc: AssetService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sldSub = this.svc.sldDeviceId$.subscribe((id) => {
      this.sldDeviceId = id;
      this.cdr.detectChanges();
    });
    this.sub = this.svc.viewPdfUrl$.subscribe((url) => {
      // Dedupe: if the SAME URL is re-emitted while we're already
      // showing it (or fetching it), do nothing. Prevents an upstream
      // re-emission loop from re-triggering the fetch.
      if (url && url === this.currentUrl) {
        return;
      }

      // Revoke previous blob URL
      if (this.blobUrl) {
        URL.revokeObjectURL(this.blobUrl);
        this.blobUrl = null;
      }
      this.safeUrl = null;
      // Reset the inline-load error so close() → viewPdf(null)
      // actually hides the window. Without this, the template
      // *ngIf="safeUrl || fetchError" stays truthy when only
      // safeUrl is cleared, and the error banner sticks on screen.
      this.fetchError = false;
      this.currentUrl = url;
      this.fileName = url
        ? decodeURIComponent(
            url.split('?')[0].split('/').pop() || 'Document Viewer',
          ).replace(
            /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\.[^.]+$)/i,
            '',
          )
        : 'Document Viewer';

      if (url) {
        this.bringToFront.emit();
        this.previewType = /\.(xlsx|xls)(\?|$)/i.test(url) ? 'excel' : 'pdf';
        if (this.previewType === 'excel') {
          // Excel is parsed client-side by pdf-preview via ocrSource — skip the PDF blob fetch.
          this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.cdr.detectChanges();
        } else {
          this.fetchAndDisplay(url);
        }
      }
    });
  }

  fetchError = false;
  private fetching: string | null = null;
  private async fetchAndDisplay(url: string): Promise<void> {
    // Guard concurrent fetches for the same URL — under no circumstance
    // do we double-fetch. If a different URL is requested mid-flight,
    // we accept the new one (the subscriber already revoked the prior
    // blobUrl).
    if (this.fetching === url) return;
    this.fetching = url;
    this.fetchError = false;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      // Force application/pdf MIME type to ensure iframe renders it
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      this.blobUrl = URL.createObjectURL(blob);
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        this.blobUrl,
      );
    } catch (err) {
      // CRITICAL: do NOT fall back to the raw signed URL. It carries
      // Content-Disposition: attachment, which makes Firefox open a
      // download dialog that can re-trigger on every change-detection
      // cycle and steal focus until the browser is killed. Show an
      // error and let the user click Download (which uses window.open
      // intentionally).
      console.warn(
        'pdf-window: fetch failed, refusing to render raw URL:',
        err,
      );
      this.fetchError = true;
      this.safeUrl = null;
    } finally {
      if (this.fetching === url) this.fetching = null;
    }
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.sldSub.unsubscribe();
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
    }
  }

  close(): void {
    this.svc.viewPdf(null);
  }
}
