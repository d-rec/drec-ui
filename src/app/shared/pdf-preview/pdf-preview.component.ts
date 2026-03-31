import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-pdf-preview',
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './pdf-preview.component.html',
  styleUrls: ['./pdf-preview.component.scss'],
})
export class PdfPreviewComponent implements OnChanges {
  /** Sanitized URL for the iframe/img src. */
  @Input() previewUrl: SafeResourceUrl | null = null;
  /** Whether the preview is a PDF or an image. */
  @Input() previewType: 'pdf' | 'image' = 'pdf';
  /** Either a File (add/edit-device) or a raw URL string (device-reviews). Triggers OCR automatically. */
  @Input() ocrSource: File | string | null = null;

  ocrText = '';
  ocrLoading = false;
  ocrProgress = 0;
  ocrPageInfo = '';
  ocrPaneHeight = 200;
  translatedText = '';
  translating = false;
  detectedLang = '';
  translationSearch = '';
  private dragStartY = 0;
  private dragStartHeight = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ocrSource']) {
      this.resetState();
    }
  }

  startOcr(): void {
    if (this.ocrSource && !this.ocrLoading) {
      this.runOcr(this.ocrSource);
    }
  }

  private resetState(): void {
    this.ocrText = '';
    this.ocrLoading = false;
    this.ocrProgress = 0;
    this.ocrPageInfo = '';
    this.translatedText = '';
    this.translating = false;
    this.detectedLang = '';
    this.translationSearch = '';
  }

  onDragStart(event: MouseEvent): void {
    event.preventDefault();
    this.dragStartY = event.clientY;
    this.dragStartHeight = this.ocrPaneHeight;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientY - this.dragStartY;
      this.ocrPaneHeight = Math.max(60, this.dragStartHeight + delta);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  private async runOcr(source: File | string): Promise<void> {
    this.ocrLoading = true;
    this.ocrProgress = 0;
    this.ocrPageInfo = '';
    this.ocrText = '';
    try {
      const Tesseract = await import('tesseract.js' as any);
      const createWorker =
        Tesseract.createWorker || Tesseract.default?.createWorker;
      const worker = await createWorker('eng+fra', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            this.ocrProgress = Math.round(m.progress * 100);
          }
        },
      });

      const isPdf =
        source instanceof File
          ? source.type === 'application/pdf'
          : /\.pdf/i.test((source as string).split('?')[0]);

      if (isPdf) {
        await this.ocrPdf(worker, source);
      } else {
        const {
          data: { text },
        } = await worker.recognize(source);
        this.ocrText = text;
      }

      await worker.terminate();
    } catch (err) {
      console.error('OCR failed:', err);
      this.ocrText = 'OCR failed — could not extract text from this document.';
    }
    this.ocrLoading = false;
    this.ocrPageInfo = '';
  }

  private async ocrPdf(worker: any, source: File | string): Promise<void> {
    const pdfjs = (window as any).pdfjsLib;
    if (!pdfjs) {
      this.ocrText = 'PDF.js not loaded — cannot OCR PDF files.';
      this.ocrLoading = false;
      await worker.terminate();
      return;
    }
    pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';

    let arrayBuffer: ArrayBuffer;
    if (source instanceof File) {
      arrayBuffer = await source.arrayBuffer();
    } else {
      const response = await fetch(source as string);
      arrayBuffer = await response.arrayBuffer();
    }

    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
    }).promise;
    const totalPages = pdf.numPages;

    for (let p = 1; p <= totalPages; p++) {
      this.ocrPageInfo = `Page ${p} of ${totalPages}`;
      this.ocrProgress = 0;
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const {
        data: { text },
      } = await worker.recognize(canvas);
      const separator = `── Page ${p} ${'─'.repeat(40)}`;
      this.ocrText +=
        (this.ocrText ? '\n\n' : '') + separator + '\n\n' + text.trim();
    }
  }

  async translateToEnglish(): Promise<void> {
    if (!this.ocrText || this.translating) return;
    this.translating = true;
    this.translatedText = '';
    this.detectedLang = '';
    try {
      const chunks = this.splitTextIntoChunks(this.ocrText, 4000);
      for (const chunk of chunks) {
        const res = await fetch(`${environment.API_URL}translate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('access-token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: [chunk], target_lang: 'EN' }),
        });
        if (!res.ok) throw new Error(`Translation error: ${res.status}`);
        const data = await res.json();
        const t = data.translations?.[0];
        if (t) {
          if (!this.detectedLang)
            this.detectedLang =
              t.detected_source_language?.toLowerCase() || '';
          this.translatedText += t.text;
        }
      }
    } catch (err) {
      console.error('Translation failed:', err);
      this.translatedText += this.translatedText
        ? '\n\n⚠ Translation interrupted.'
        : 'Translation failed — check console for details.';
    }
    this.translating = false;
  }

  private splitTextIntoChunks(text: string, maxLen: number): string[] {
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      let splitAt = remaining.lastIndexOf('\n', maxLen);
      if (splitAt < maxLen / 2) splitAt = maxLen;
      chunks.push(remaining.substring(0, splitAt));
      remaining = remaining.substring(splitAt);
    }
    return chunks;
  }

  copyOcrText(): void {
    if (this.ocrText) {
      navigator.clipboard.writeText(this.ocrText);
    }
  }

  highlightText(text: string, term: string): string {
    if (!term) return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const termEscaped = term
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;');
    return escaped.replace(
      new RegExp(termEscaped, 'gi'),
      (m) => `<mark>${m}</mark>`,
    );
  }
}
