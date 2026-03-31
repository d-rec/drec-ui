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
  private sub!: Subscription;
  private blobUrl: string | null = null;

  constructor(
    readonly svc: AssetService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.svc.viewPdfUrl$.subscribe((url) => {
      // Revoke previous blob URL
      if (this.blobUrl) {
        URL.revokeObjectURL(this.blobUrl);
        this.blobUrl = null;
      }
      this.safeUrl = null;
      this.currentUrl = url;

      if (url) {
        this.bringToFront.emit();
        this.fetchAndDisplay(url);
      }
    });
  }

  private async fetchAndDisplay(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      // Force application/pdf MIME type to ensure iframe renders it
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      this.blobUrl = URL.createObjectURL(blob);
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.blobUrl);
    } catch {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
    }
  }

  close(): void {
    this.svc.viewPdf(null);
  }
}
