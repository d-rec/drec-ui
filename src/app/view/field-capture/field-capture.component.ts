import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { CaptureQueueService, QueuedCapture } from './capture-queue.service';
import { SerialReaderService, SerialRead } from './serial-reader.service';

type Stage = 'idle' | 'scanning' | 'review' | 'sending' | 'done';

interface SerialMatch {
  deviceId: number;
  serialNumber: string;
  siteName: string | null;
  kind: 'exact' | 'near';
  distance: number;
}

/**
 * Aspect of the guide box: serials are one line, so wider than tall.
 *
 * The crop is taken at the sensor's own resolution and only capped, never
 * squashed to a fixed size. The first real captures were cropped to 640x160
 * from a 1080-wide frame, which left the serial print a dozen pixels tall —
 * no OCR engine recovers from that, and no amount of preprocessing helps.
 */
const CROP_ASPECT = 4;

/** Upper bound on the crop's long edge, to keep a pass affordable. */
const CROP_MAX_WIDTH = 1600;

/** Below this the crop is upscaled instead: tiny text beats no text. */
const CROP_MIN_WIDTH = 640;

/** Frames per burst when the operator presses Record. */
const BURST_FRAMES = 5;

/** Live scanning cadence. ~6/s is within reach of a mid-range phone. */
const LIVE_SCAN_INTERVAL_MS = 160;

/**
 * How long a decoded barcode stays usable. Long enough that pressing Record
 * right after one appears uses it, short enough that a barcode seen while
 * walking past a different unit cannot be attached to this capture.
 */
const BARCODE_HOLD_MS = 4000;

/**
 * How long to wait for the viewfinder to report a frame size before deciding
 * it is not painting and re-acquiring the camera.
 */
const CAMERA_PAINT_TIMEOUT_MS = 1500;

/** Above this the fix is too coarse to place a site; the operator is warned. */
const GPS_ACCURACY_WARN_M = 100;

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-field-capture',
  templateUrl: './field-capture.component.html',
  styleUrls: ['./field-capture.component.scss'],
  providers: [SerialReaderService, CaptureQueueService],
})
export class FieldCaptureComponent implements OnDestroy {
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('still') stillRef?: ElementRef<HTMLCanvasElement>;

  private readonly http = inject(HttpClient);
  private readonly reader = inject(SerialReaderService);
  private readonly queue = inject(CaptureQueueService);

  stage: Stage = 'idle';
  error = '';
  notice = '';

  /** Set when getUserMedia is unavailable — see `cameraUnavailableReason`. */
  liveCameraBlocked = false;
  cameraUnavailableReason = '';

  /** What the reader is seeing right now, before the operator commits. */
  livePreviewSerial = '';
  liveSource: 'barcode' | 'ocr' | '' = '';

  /** A decoded barcode waiting for the operator to press Record. */
  private heldBarcode: SerialRead | null = null;
  private heldBarcodeAt = 0;

  /** The committed read, editable by the operator. */
  serialNumber = '';
  serialRaw = '';
  serialSource: 'barcode' | 'ocr' | 'ocr-corrected' | 'manual' = 'manual';
  ocrConfidence: number | null = null;
  readElapsedMs = 0;

  matches: SerialMatch[] = [];
  matchesLoading = false;

  latitude: number | null = null;
  longitude: number | null = null;
  gpsAccuracyM: number | null = null;
  gpsError = '';

  operatorNote = '';

  photoBlob: Blob | null = null;
  photoPreviewUrl = '';
  capturedAt = '';

  pendingCount = 0;
  flushing = false;

  /**
   * Diagnostic frame upload. Hidden unless switched on, so operators never see
   * it: visit /capture?debug=1 once and the flag sticks on that device.
   */
  debugEnabled = false;
  debugBusy = false;
  debugReference = '';

  private stream: MediaStream | null = null;
  /** Guards the one-shot camera recovery in attachStream(). */
  private recoveringCamera = false;
  private liveTimer: any = null;
  private wakeLock: any = null;
  private onlineHandler = () => this.flush();

  constructor() {
    window.addEventListener('online', this.onlineHandler);
    void this.refreshPendingCount();
    void this.flush();
    this.debugEnabled = this.readDebugFlag();
  }

  /** `?debug=1` turns it on and remembers it; `?debug=0` turns it off again. */
  private readDebugFlag(): boolean {
    let stored = false;
    try {
      stored = localStorage.getItem('field-capture-debug') === '1';
    } catch {
      /* private browsing */
    }
    const param = new URLSearchParams(location.search).get('debug');
    if (param === null) return stored;
    const on = param !== '0';
    try {
      localStorage.setItem('field-capture-debug', on ? '1' : '0');
    } catch {
      /* best effort */
    }
    return on;
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.onlineHandler);
    this.stopLiveScan();
    this.stopCamera();
    void this.reader.destroy();
    void this.releaseWakeLock();
    if (this.photoPreviewUrl) URL.revokeObjectURL(this.photoPreviewUrl);
  }

  get gpsTooCoarse(): boolean {
    return this.gpsAccuracyM != null && this.gpsAccuracyM > GPS_ACCURACY_WARN_M;
  }

  get exactMatch(): SerialMatch | undefined {
    return this.matches.find((m) => m.kind === 'exact');
  }

  get canSubmit(): boolean {
    return (
      this.stage === 'review' &&
      !!this.serialNumber.trim() &&
      !!this.photoBlob &&
      this.latitude != null &&
      this.longitude != null
    );
  }

  // ---------------------------------------------------------------- camera

  /**
   * Must be called from a user gesture: iOS refuses getUserMedia outside one,
   * and refuses to start video playback outside one even when permission is
   * already granted.
   */
  public async startCamera(): Promise<void> {
    this.error = '';

    if (!navigator.mediaDevices?.getUserMedia) {
      this.blockLiveCamera(
        'This browser will not give a web page camera access. Use the ' +
          'single-photo button below, or open the page in Safari or Chrome.',
      );
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          // Ask for the sensor, not a video preset. A real iPhone 'ideal:
          // 1920x1080' request came back as 1080x1920 — 2.1 of an available
          // 12.2 megapixels, which is 17% of the detail the camera can give.
          // Serial print is small and fine; resolution is the whole game.
          width: { ideal: 4032 },
          height: { ideal: 3024 },
        },
        audio: false,
      });
    } catch (err: any) {
      // NotAllowedError inside an in-app webview (WhatsApp, Facebook) is the
      // common case in the field — links reach operators through chat apps.
      this.blockLiveCamera(
        err?.name === 'NotAllowedError'
          ? 'Camera access was refused. If you opened this link from a chat ' +
              'app, open it in Safari or Chrome instead — or use the ' +
              'single-photo button below.'
          : `Camera unavailable (${err?.name ?? 'unknown error'}). Use the ` +
              'single-photo button below.',
      );
      return;
    }

    this.stage = 'scanning';
    await this.requestWakeLock();
    void this.reader.warmUp();
    void this.locate();

    // The template only renders <video> once stage is 'scanning', so wait a
    // tick for the ViewChild to exist.
    setTimeout(() => void this.attachStream());
  }

  /**
   * Bind the live stream to whatever <video> element currently exists and
   * start scanning.
   *
   * Called on every entry into the scanning stage, not just the first. The
   * viewfinder is behind `*ngIf`, so leaving the stage destroys the <video>
   * element and returning creates a brand new one with no `srcObject` — the
   * stream is still running, but nothing is bound to it, which showed up as a
   * black viewfinder after "Discard and rescan".
   */
  private async attachStream(): Promise<void> {
    const video = this.videoRef?.nativeElement;
    if (!video || !this.stream) return;

    if (video.srcObject !== this.stream) {
      video.srcObject = this.stream;
    }
    // Safari pauses playback when the element is detached, so this is needed
    // on re-entry as well as on first start.
    try {
      await video.play();
    } catch {
      /* autoplay rejection is not fatal; the frame grab reads the track */
    }

    // Safety net for the black-viewfinder class of bug. If the element has no
    // dimensions shortly after play(), it is not painting the stream and every
    // crop would come back empty, so start over with a fresh camera rather
    // than scan a black rectangle. Guarded so it can only happen once.
    if (!(await this.waitForFrames(video))) {
      if (this.recoveringCamera) return;
      this.recoveringCamera = true;
      this.stopCamera();
      try {
        await this.startCamera();
      } finally {
        this.recoveringCamera = false;
      }
      return;
    }

    await this.applyCameraTuning();
    this.startLiveScan();
  }

  /** Resolves true once the element reports a frame size, false on timeout. */
  private async waitForFrames(video: HTMLVideoElement): Promise<boolean> {
    const deadline = Date.now() + CAMERA_PAINT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (video.videoWidth > 0 && video.readyState >= 2) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return video.videoWidth > 0;
  }

  /**
   * Continuous focus where it exists. Queried rather than assumed: Safari
   * exposes almost none of these, Android Chrome exposes most, and a
   * constraint the track does not support throws.
   */
  private async applyCameraTuning(): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track?.getCapabilities) return;
    const capabilities: any = track.getCapabilities();

    this.zoomMax = Math.min(capabilities.zoom?.max ?? 1, 6);
    this.zoomAvailable = this.zoomMax > 1;

    const advanced: any[] = [];
    if (capabilities.focusMode?.includes('continuous')) {
      advanced.push({ focusMode: 'continuous' });
    }
    if (advanced.length) {
      try {
        await track.applyConstraints({ advanced });
      } catch {
        /* optional tuning only */
      }
    }

    // Start at 2x where the camera offers it. An operator stands close enough
    // to read the nameplate by eye, which is still too far for the sensor to
    // resolve a serial at 1x — the first real captures came back with the
    // print too small for either engine and the barcodes undecodable.
    if (this.zoomAvailable) {
      await this.setZoom(Math.min(2, this.zoomMax));
    }
  }

  /** Digital/optical zoom, where the platform exposes it (iOS does). */
  public async setZoom(zoom: number): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return;
    const next = Math.max(1, Math.min(zoom, this.zoomMax));
    try {
      await track.applyConstraints({ advanced: [{ zoom: next } as any] });
      this.zoom = next;
    } catch {
      /* not fatal: the viewfinder just stays where it was */
    }
  }

  public cycleZoom(): void {
    const steps = [1, 2, 3, 5].filter((z) => z <= this.zoomMax);
    const next = steps[(steps.indexOf(this.zoom) + 1) % steps.length] ?? 1;
    void this.setZoom(next);
  }

  /** Android Chrome only — Safari has no torch API at all. */
  get torchAvailable(): boolean {
    const track = this.stream?.getVideoTracks()[0];
    const capabilities: any = track?.getCapabilities?.();
    return !!capabilities && 'torch' in capabilities;
  }

  torchOn = false;

  /** Zoom, where offered. iOS exposes 0.5-10x; Android varies. */
  zoomAvailable = false;
  zoom = 1;
  zoomMax = 1;

  public async toggleTorch(): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !this.torchOn } as any],
      });
      this.torchOn = !this.torchOn;
    } catch {
      this.notice = 'This device will not let the page control the flash.';
    }
  }

  private blockLiveCamera(reason: string): void {
    this.liveCameraBlocked = true;
    this.cameraUnavailableReason = reason;
    this.stage = 'idle';
    void this.locate();
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.torchOn = false;
  }

  // ------------------------------------------------------------ live scan

  private startLiveScan(): void {
    this.stopLiveScan();
    let busy = false;
    let tick = 0;
    this.liveTimer = setInterval(async () => {
      if (busy || this.stage !== 'scanning') return;
      busy = true;
      try {
        // Every fourth tick, look for a barcode across the whole frame rather
        // than inside the guide box. The operator aims at the serial text, so
        // a barcode a few centimetres away would otherwise never be seen —
        // and a barcode is exact where OCR is a guess. ~1.5 sweeps/second.
        if (tick++ % 4 === 3) {
          const frame = this.fullFrame();
          const barcode = frame
            ? await this.reader.readBarcodeOnly(frame)
            : null;
          if (barcode && this.stage === 'scanning') {
            this.holdBarcode(barcode);
            return;
          }
        }

        const crop = this.cropGuideBox();
        if (crop) {
          const read = await this.reader.read(crop);
          if (read && this.stage === 'scanning') {
            if (read.source === 'barcode') {
              this.holdBarcode(read);
            } else {
              this.livePreviewSerial = read.text;
              this.liveSource = 'ocr';
            }
          }
        }
      } finally {
        busy = false;
      }
    }, LIVE_SCAN_INTERVAL_MS);
  }

  private stopLiveScan(): void {
    if (this.liveTimer) clearInterval(this.liveTimer);
    this.liveTimer = null;
  }

  /**
   * Crop the guide box out of the current video frame.
   *
   * Cropping is not just a speed optimisation: on the benchmark a full
   * 1920x1080 frame was both 2.5x slower AND read the serial wrong, because
   * the serial was one small feature in a two-megapixel scene instead of
   * filling the image.
   */
  private cropGuideBox(): ImageData | null {
    const video = this.videoRef?.nativeElement;
    if (!video || !video.videoWidth) return null;

    // Guide box: centred, 80% of frame width, proportioned to the crop.
    const boxWidth = video.videoWidth * 0.8;
    const boxHeight = boxWidth / CROP_ASPECT;
    const sx = (video.videoWidth - boxWidth) / 2;
    const sy = (video.videoHeight - boxHeight) / 2;

    // Keep the sensor's pixels. Only clamp the extremes.
    const outWidth = Math.round(
      Math.min(CROP_MAX_WIDTH, Math.max(CROP_MIN_WIDTH, boxWidth)),
    );
    const outHeight = Math.round(outWidth / CROP_ASPECT);

    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = outHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(
      video,
      sx,
      sy,
      boxWidth,
      boxHeight,
      0,
      0,
      outWidth,
      outHeight,
    );
    this.boostContrast(context, outWidth, outHeight);
    return context.getImageData(0, 0, outWidth, outHeight);
  }

  /**
   * The whole video frame, downscaled. Barcode decoding does not need full
   * resolution and the decoder is markedly faster on a smaller image.
   */
  private fullFrame(): ImageData | null {
    const video = this.videoRef?.nativeElement;
    if (!video?.videoWidth) return null;
    return this.downscaleToImageData(
      video,
      video.videoWidth,
      video.videoHeight,
    );
  }

  /** Same, for a photo picked through the file input. */
  private async wholeImageData(file: Blob): Promise<ImageData | null> {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      return this.downscaleToImageData(image, image.width, image.height);
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private downscaleToImageData(
    source: CanvasImageSource,
    width: number,
    height: number,
  ): ImageData | null {
    // 2160 on the long edge. The first real captures had two Code128s on the
    // label and neither decoded: at 1080 across a whole nameplate the bars are
    // barely a pixel wide. Downscaling further guaranteed failure.
    const scale = Math.min(1, 2160 / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, w, h);
    return context.getImageData(0, 0, w, h);
  }

  /**
   * Greyscale plus a contrast stretch. Etched and stamped nameplates are low
   * contrast by nature, and on iOS there is no torch to compensate with.
   */
  private boostContrast(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    const image = context.getImageData(0, 0, width, height);
    const data = image.data;

    let min = 255;
    let max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const grey =
        (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      data[i] = data[i + 1] = data[i + 2] = grey;
      if (grey < min) min = grey;
      if (grey > max) max = grey;
    }

    const span = max - min;
    if (span > 8) {
      const scale = 255 / span;
      for (let i = 0; i < data.length; i += 4) {
        const stretched = (data[i] - min) * scale;
        data[i] = data[i + 1] = data[i + 2] = stretched;
      }
    }
    context.putImageData(image, 0, 0);
  }

  // --------------------------------------------------------------- record

  /**
   * Remember a decoded barcode and show it, but do not commit.
   *
   * The scanner never leaves the viewfinder on its own. A barcode is exact,
   * so it is tempting to jump straight to the review screen the moment one
   * decodes — but that takes the screen away from an operator who is still
   * lining up the shot, and the photo it keeps is whatever happened to be in
   * frame at that instant. The operator decides when the capture is taken.
   */
  private holdBarcode(read: SerialRead): void {
    this.livePreviewSerial = read.text;
    this.liveSource = 'barcode';
    this.heldBarcode = read;
    this.heldBarcodeAt = Date.now();
  }

  /** True while a decoded barcode is recent enough to use on Record. */
  get barcodeReady(): boolean {
    return (
      !!this.heldBarcode && Date.now() - this.heldBarcodeAt < BARCODE_HOLD_MS
    );
  }

  /** [Record]: freeze the frame, burst-read it, keep the photo. */
  public async record(): Promise<void> {
    if (this.stage !== 'scanning') return;

    // A barcode decoded moments ago is exact; no reason to re-read it with
    // OCR just because the operator pressed the button afterwards.
    if (this.barcodeReady && this.heldBarcode) {
      this.photoBlob = await this.grabStill();
      this.capturedAt = new Date().toISOString();
      this.setPhotoPreview(this.photoBlob);
      await this.commitRead(this.heldBarcode);
      return;
    }

    const frames: ImageData[] = [];
    for (let i = 0; i < BURST_FRAMES; i++) {
      const crop = this.cropGuideBox();
      if (crop) frames.push(crop);
      // Spread the burst over a few frames so a single blurred one cannot
      // decide the answer.
      await new Promise((r) => setTimeout(r, 40));
    }

    this.photoBlob = await this.grabStill();
    this.capturedAt = new Date().toISOString();
    this.setPhotoPreview(this.photoBlob);

    const read = frames.length ? await this.reader.readBurst(frames) : null;
    if (read) {
      await this.commitRead(read);
    } else {
      // Nothing legible. The photo is still worth keeping — the reviewer can
      // read it, and manual entry is a first-class path.
      this.stage = 'review';
      this.serialSource = 'manual';
      this.notice =
        'Nothing readable in the guide box. Type the serial, or move into ' +
        'better light and try again.';
      this.stopLiveScan();
    }
  }

  /**
   * Upload exactly what the readers are looking at right now.
   *
   * Sends three things: the raw frame, the preprocessed guide-box crop, and
   * what each reader made of that crop. The crop is the useful one — if a
   * serial is legible in the frame but not in the crop, the fault is in the
   * cropping or the contrast stretch rather than in the OCR engine, and that
   * distinction is impossible to make from a description.
   */
  public async uploadDebugFrame(): Promise<void> {
    if (this.debugBusy) return;
    this.debugBusy = true;
    this.debugReference = '';
    this.notice = '';

    try {
      const crop = this.cropGuideBox();
      const full = await this.grabStill();

      // Read the crop here and now, so the upload carries what the engines
      // actually produced on this exact frame rather than a stale preview.
      const barcode = crop ? await this.reader.readBarcodeOnly(crop) : null;
      const ocr = crop ? await this.reader.readBurst([crop]) : null;

      const track = this.stream?.getVideoTracks()[0];
      const meta = {
        barcode: barcode && {
          text: barcode.text,
          ms: Math.round(barcode.elapsedMs),
        },
        ocr: ocr && {
          text: ocr.text,
          source: ocr.source,
          confidence: ocr.confidence,
          ms: Math.round(ocr.elapsedMs),
        },
        livePreviewSerial: this.livePreviewSerial,
        liveSource: this.liveSource,
        crop: crop ? { width: crop.width, height: crop.height } : null,
        video: this.videoRef?.nativeElement
          ? {
              videoWidth: this.videoRef.nativeElement.videoWidth,
              videoHeight: this.videoRef.nativeElement.videoHeight,
              readyState: this.videoRef.nativeElement.readyState,
            }
          : null,
        trackSettings: track?.getSettings?.() ?? null,
        trackCapabilities: (track as any)?.getCapabilities?.() ?? null,
        gps: {
          latitude: this.latitude,
          longitude: this.longitude,
          accuracy: this.gpsAccuracyM,
        },
        userAgent: navigator.userAgent,
        devicePixelRatio: window.devicePixelRatio,
        viewport: { w: window.innerWidth, h: window.innerHeight },
      };

      const form = new FormData();
      if (full) form.append('full', full, 'full.jpg');
      if (crop) {
        const cropBlob = await this.imageDataToBlob(crop);
        if (cropBlob) form.append('crop', cropBlob, 'crop.png');
      }
      form.append('meta', JSON.stringify(meta));

      const response: any = await this.http
        .post(`${environment.API_URL}field-capture/debug-frame`, form, {
          headers: this.authHeaders(),
        })
        .toPromise();

      this.debugReference = response?.reference ?? '(uploaded)';
    } catch (err: any) {
      this.notice = `Debug upload failed: ${err?.error?.message ?? err?.message ?? 'unknown error'}`;
    } finally {
      this.debugBusy = false;
    }
  }

  private imageDataToBlob(image: ImageData): Promise<Blob | null> {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d')!.putImageData(image, 0, 0);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  private async commitRead(read: SerialRead): Promise<void> {
    this.serialNumber = read.text;
    this.serialRaw = read.text;
    this.serialSource = read.source;
    this.ocrConfidence = read.source === 'ocr' ? read.confidence : null;
    this.readElapsedMs = Math.round(read.elapsedMs);

    if (!this.photoBlob) {
      this.photoBlob = await this.grabStill();
      this.capturedAt = new Date().toISOString();
      this.setPhotoPreview(this.photoBlob);
    }

    this.stopLiveScan();
    this.stage = 'review';
    void this.locate();
    void this.lookupMatches();
  }

  /** The photo that goes to the reviewer: the whole frame, not the crop. */
  private async grabStill(): Promise<Blob | null> {
    const video = this.videoRef?.nativeElement;
    if (!video?.videoWidth) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    return new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85),
    );
  }

  private setPhotoPreview(blob: Blob | null): void {
    if (this.photoPreviewUrl) URL.revokeObjectURL(this.photoPreviewUrl);
    this.photoPreviewUrl = blob ? URL.createObjectURL(blob) : '';
  }

  /**
   * Fallback path: the native camera via a file input.
   *
   * This works everywhere getUserMedia does not — in particular inside the
   * WhatsApp and Facebook webviews operators actually open links from. Same
   * submission, same reader, one photo instead of a live preview.
   */
  public async onFilePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.photoBlob = file;
    this.capturedAt = new Date(file.lastModified || Date.now()).toISOString();
    this.setPhotoPreview(file);
    this.stage = 'review';
    void this.locate();

    // Barcode across the whole photo before OCR on the crop. There is no
    // guide box on this path — the operator framed the nameplate, not the
    // serial — so a barcode is very unlikely to sit in the centre strip.
    const whole = await this.wholeImageData(file);
    let read = whole ? await this.reader.readBarcodeOnly(whole) : null;

    if (!read) {
      const crop = await this.cropFromFile(file);
      read = crop ? await this.reader.readBurst([crop]) : null;
    }

    if (read) {
      this.serialNumber = read.text;
      this.serialRaw = read.text;
      this.serialSource = read.source;
      this.ocrConfidence = read.source === 'ocr' ? read.confidence : null;
      this.readElapsedMs = Math.round(read.elapsedMs);
      void this.lookupMatches();
    } else {
      this.serialSource = 'manual';
      this.notice = 'Could not read a serial from that photo. Type it in.';
    }
    input.value = '';
  }

  /** Centre strip of a picked photo, matching the live guide box. */
  private async cropFromFile(file: Blob): Promise<ImageData | null> {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });

      const boxWidth = image.width * 0.8;
      const boxHeight = boxWidth / CROP_ASPECT;
      const outWidth = Math.round(
        Math.min(CROP_MAX_WIDTH, Math.max(CROP_MIN_WIDTH, boxWidth)),
      );
      const outHeight = Math.round(outWidth / CROP_ASPECT);
      const canvas = document.createElement('canvas');
      canvas.width = outWidth;
      canvas.height = outHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(
        image,
        (image.width - boxWidth) / 2,
        (image.height - boxHeight) / 2,
        boxWidth,
        boxHeight,
        0,
        0,
        outWidth,
        outHeight,
      );
      this.boostContrast(context, outWidth, outHeight);
      return context.getImageData(0, 0, outWidth, outHeight);
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ------------------------------------------------------------- geolocation

  /**
   * A canvas frame from getUserMedia carries no EXIF, so the coordinates come
   * from the Geolocation API, not the image. Client-supplied and metres-scale
   * at best: this answers "which site is this", never "proof of presence".
   */
  private locate(): Promise<void> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        this.gpsError = 'This browser cannot provide a location.';
        return resolve();
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.latitude = position.coords.latitude;
          this.longitude = position.coords.longitude;
          this.gpsAccuracyM = position.coords.accuracy ?? null;
          this.gpsError = '';
          resolve();
        },
        (err) => {
          this.gpsError =
            err.code === err.PERMISSION_DENIED
              ? 'Location permission denied. A capture needs coordinates — ' +
                'allow location and try again.'
              : `Could not get a location fix (${err.message}).`;
          resolve();
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  }

  public retryLocate(): void {
    void this.locate();
  }

  // ------------------------------------------------------------- matching

  /**
   * Is this serial already on file?
   *
   * Not an accuracy mechanism. Capture is the first step of a registration, so
   * for the device this flow exists to create there is by definition nothing
   * to match against — confusable-tolerant matching cannot rescue a misread
   * here, only the barcode and the reviewer's eyes can. What it does catch is
   * a collision: the same unit captured twice, or a serial that already
   * belongs to a registered device.
   */
  private async lookupMatches(): Promise<void> {
    const serial = this.serialNumber.trim();
    if (!serial) {
      this.matches = [];
      return;
    }
    this.matchesLoading = true;
    try {
      this.matches = await this.http
        .get<SerialMatch[]>(
          `${environment.API_URL}field-capture/serial-candidates`,
          {
            params: { serial },
            headers: this.authHeaders(),
          },
        )
        .toPromise()
        .then((r) => r ?? []);
    } catch {
      // Offline is the normal case here, not an error worth showing: the
      // reviewer does this check again at approval time.
      this.matches = [];
    } finally {
      this.matchesLoading = false;
    }
  }

  public onSerialEdited(): void {
    if (this.serialRaw && this.serialNumber.trim() !== this.serialRaw) {
      this.serialSource =
        this.serialSource === 'manual' ? 'manual' : 'ocr-corrected';
    }
    void this.lookupMatches();
  }

  // --------------------------------------------------------------- submit

  public async submit(): Promise<void> {
    if (!this.canSubmit || !this.photoBlob) return;

    const item: QueuedCapture = {
      clientCaptureId: this.newUuid(),
      capture: {
        clientCaptureId: '',
        serialNumber: this.serialNumber.trim(),
        serialRaw: this.serialRaw || undefined,
        serialSource: this.serialSource,
        ocrConfidence: this.ocrConfidence ?? undefined,
        latitude: String(this.latitude),
        longitude: String(this.longitude),
        gpsAccuracyM: this.gpsAccuracyM ?? undefined,
        capturedAt: this.capturedAt || new Date().toISOString(),
        // Serial, photo and coordinates only. Capacity, commissioning date and
        // technology are not things an operator can read off a nameplate in
        // the field, and guessing them here would put a wrong number into the
        // registry under the authority of a photo. The reviewer fills them in
        // from the documents, and is warned when they are missing.
        payload: {
          operatorNote: this.operatorNote.trim() || undefined,
        },
      },
      photo: this.photoBlob,
      attempts: 0,
      queuedAt: new Date().toISOString(),
    };
    item.capture['clientCaptureId'] = item.clientCaptureId;

    this.stage = 'sending';
    this.error = '';

    // Queue first, then send. If the send fails — or the browser is closed
    // mid-request — the capture is already durable and the flush will retry
    // it. The server deduplicates on clientCaptureId, so a retry of a request
    // that actually succeeded is harmless.
    try {
      await this.queue.add(item);
      await this.refreshPendingCount();
    } catch {
      this.notice =
        'This browser will not store offline captures, so this one must be ' +
        'sent now.';
    }

    const sent = await this.send(item);
    if (sent) {
      this.stage = 'done';
      this.notice = '';
    } else {
      this.stage = 'done';
      this.notice =
        'Saved on this phone and queued. It will upload when you have ' +
        'signal — keep this page open.';
    }
    await this.refreshPendingCount();
  }

  private async send(item: QueuedCapture): Promise<boolean> {
    const form = new FormData();
    form.append('photo', item.photo, `${item.clientCaptureId}.jpg`);
    form.append('capture', JSON.stringify(item.capture));

    try {
      await this.http
        .post(`${environment.API_URL}field-capture`, form, {
          headers: this.authHeaders(),
        })
        .toPromise();
      await this.queue.remove(item.clientCaptureId);
      return true;
    } catch (err: any) {
      // A 409 means the server rejected it on its merits (a duplicate site
      // name, say). Retrying will never help, so stop holding it.
      if (err?.status === 409 || err?.status === 400) {
        this.error = err?.error?.message ?? 'The server rejected this capture.';
        await this.queue.remove(item.clientCaptureId);
        return false;
      }
      await this.queue.noteFailure(
        item.clientCaptureId,
        err?.message ?? 'send failed',
      );
      return false;
    }
  }

  /** Try everything in the queue. Safe to call often; idempotent server-side. */
  public async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const items = await this.queue.all();
      for (const item of items) {
        await this.send(item);
      }
    } catch {
      /* queue unavailable; nothing to do */
    } finally {
      this.flushing = false;
      await this.refreshPendingCount();
    }
  }

  private async refreshPendingCount(): Promise<void> {
    this.pendingCount = await this.queue.count();
  }

  // ---------------------------------------------------------------- misc

  public async captureAnother(): Promise<void> {
    this.serialNumber = '';
    this.serialRaw = '';
    this.serialSource = 'manual';
    this.ocrConfidence = null;
    this.readElapsedMs = 0;
    this.matches = [];
    this.operatorNote = '';
    this.photoBlob = null;
    this.setPhotoPreview(null);
    this.livePreviewSerial = '';
    this.liveSource = '';
    this.heldBarcode = null;
    this.heldBarcodeAt = 0;
    this.notice = '';
    this.error = '';

    const hadCamera = !!this.stream;

    // Always tear the camera down and acquire it again, even when the track
    // is still live.
    //
    // The viewfinder sits behind `*ngIf`, so returning to the scanning stage
    // builds a NEW <video> element, and WebKit will not paint an already-
    // active MediaStream into one: the track reports `live`, play() resolves,
    // and the element stays black. Rebinding is enough on Chrome and was
    // measurably correct there, which is exactly why this needed a phone to
    // find. A fresh getUserMedia is the only thing iOS reliably renders.
    //
    // This runs inside the button's click handler, so it still counts as the
    // user gesture getUserMedia requires. The cost is the camera warm-up,
    // which also re-runs focus and exposure for the next nameplate.
    this.stopCamera();
    this.stage = 'idle';
    if (hadCamera) {
      await this.startCamera();
    }
  }

  /**
   * Keep the screen awake while the operator is aiming. Safari 16.4+ and
   * Chrome both support this; a screen that sleeps mid-scan is a guaranteed
   * complaint.
   */
  private async requestWakeLock(): Promise<void> {
    try {
      this.wakeLock = await (navigator as any).wakeLock?.request('screen');
    } catch {
      /* optional */
    }
  }

  private async releaseWakeLock(): Promise<void> {
    try {
      await this.wakeLock?.release();
    } catch {
      /* optional */
    }
    this.wakeLock = null;
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${sessionStorage.getItem('access-token') ?? ''}`,
    };
  }

  private newUuid(): string {
    // randomUUID needs a secure context; getUserMedia does too, so in practice
    // it is there. The fallback keeps the file-input path working on http.
    if (crypto?.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}
