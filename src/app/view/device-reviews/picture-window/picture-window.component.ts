import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { AssetService } from '../asset.service';
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

  readonly url$ = this.svc.viewPictureUrl$;
  private sub!: Subscription;

  ocrText: string | null = null;
  ocrRunning = false;
  ocrProgress = 0;
  private currentUrl: string | null = null;

  constructor(readonly svc: AssetService) {}

  ngOnInit(): void {
    this.sub = this.svc.viewPictureUrl$.subscribe((url) => {
      if (url) this.bringToFront.emit();
      this.currentUrl = url;
      // Reset OCR state when picture changes
      this.ocrText = null;
      this.ocrRunning = false;
      this.ocrProgress = 0;
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  close(): void {
    this.svc.viewPicture(null);
  }

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
}
