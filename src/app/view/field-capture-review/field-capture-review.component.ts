import { CommonModule } from '@angular/common';
import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import {
  CaptureStatus,
  FieldCapture,
  FieldCaptureDetail,
  FieldCaptureReviewService,
} from './field-capture-review.service';

/**
 * Above this the operator's fix cannot place a site on its own and the
 * reviewer has to. Matches GPS_ACCURACY_WARN_M on the API side.
 */
const GPS_ACCURACY_WARN_M = 100;

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-field-capture-review',
  templateUrl: './field-capture-review.component.html',
  styleUrls: ['./field-capture-review.component.scss'],
  providers: [FieldCaptureReviewService],
})
export class FieldCaptureReviewComponent
  implements OnInit, AfterViewChecked, OnDestroy
{
  @ViewChild('map') mapRef?: ElementRef<HTMLDivElement>;

  private readonly service = inject(FieldCaptureReviewService);

  tabs: CaptureStatus[] = ['Pending', 'Approved', 'Rejected'];
  activeTab: CaptureStatus = 'Pending';

  captures: FieldCapture[] = [];
  listLoading = false;
  listError = '';

  selected: FieldCaptureDetail | null = null;
  detailLoading = false;

  /** Reviewer's working copy. Approval sends only what was actually changed. */
  edit = {
    serialNumber: '',
    capacity: null as number | null,
    commissioningDate: '',
    fuelCode: '',
    deviceTypeCode: '',
    siteName: '',
    countryCode: '',
    address: '',
  };
  reviewNote = '';

  acting = false;
  actionError = '';
  actionResult = '';

  private map: L.Map | null = null;
  private mapForUuid = '';

  ngOnInit(): void {
    this.load();
  }

  /**
   * Leaflet needs a laid-out container, and the detail pane only exists once a
   * capture is selected, so the map is built after the view settles rather
   * than in the selection handler.
   */
  ngAfterViewChecked(): void {
    if (
      this.selected &&
      this.mapRef?.nativeElement &&
      this.mapForUuid !== this.selected.uuid
    ) {
      this.renderMap(this.selected);
    }
  }

  ngOnDestroy(): void {
    this.destroyMap();
  }

  // ----------------------------------------------------------------- list

  public setTab(tab: CaptureStatus): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.selected = null;
    this.destroyMap();
    this.load();
  }

  public load(): void {
    this.listLoading = true;
    this.listError = '';
    this.service.queue(this.activeTab).subscribe({
      next: (rows) => {
        this.captures = rows;
        this.listLoading = false;
      },
      error: (err) => {
        this.listLoading = false;
        this.listError =
          err?.status === 403
            ? 'Your role cannot review field captures.'
            : err?.error?.message ?? 'Could not load the queue.';
      },
    });
  }

  // --------------------------------------------------------------- detail

  public select(capture: FieldCapture): void {
    if (this.selected?.uuid === capture.uuid) return;
    this.detailLoading = true;
    this.actionError = '';
    this.actionResult = '';
    this.destroyMap();

    this.service.detail(capture.uuid).subscribe({
      next: (detail) => {
        this.selected = detail;
        this.detailLoading = false;
        this.seedEdit(detail);
      },
      error: (err) => {
        this.detailLoading = false;
        this.actionError =
          err?.error?.message ?? 'Could not load that capture.';
      },
    });
  }

  private seedEdit(detail: FieldCaptureDetail): void {
    const payload = detail.payload ?? {};
    this.edit = {
      serialNumber: detail.serialNumber,
      capacity: payload['capacity'] ?? null,
      commissioningDate: (payload['commissioningDate'] ?? '').slice(0, 10),
      fuelCode: payload['fuelCode'] ?? '',
      deviceTypeCode: payload['deviceTypeCode'] ?? '',
      siteName: payload['siteName'] ?? '',
      countryCode: payload['countryCode'] ?? '',
      address: payload['address'] ?? '',
    };
    this.reviewNote = '';
  }

  // -------------------------------------------------------------- derived

  get gpsTooCoarse(): boolean {
    const accuracy = this.selected?.gpsAccuracyM;
    return accuracy != null && accuracy > GPS_ACCURACY_WARN_M;
  }

  /** The operator overrode the reader before submitting. */
  get operatorCorrected(): boolean {
    return (
      !!this.selected?.serialRaw &&
      this.selected.serialRaw !== this.selected.serialNumber
    );
  }

  /** The reviewer is overriding the operator right now. */
  get reviewerCorrected(): boolean {
    return (
      !!this.selected &&
      this.edit.serialNumber.trim() !== this.selected.serialNumber
    );
  }

  /**
   * A capture with nothing but a serial and a photo produces a device that
   * cannot be ceiling-checked or issued against — it will sit in the registry
   * looking real. Worth saying so before the reviewer approves it, not after.
   */
  get missingForIssuance(): string[] {
    const missing: string[] = [];
    if (this.edit.capacity == null) missing.push('capacity');
    if (!this.edit.commissioningDate) missing.push('commissioning date');
    if (!this.edit.fuelCode) missing.push('fuel code');
    if (!this.edit.deviceTypeCode) missing.push('technology');
    return missing;
  }

  get isPending(): boolean {
    return this.selected?.status === 'Pending';
  }

  public confidenceLabel(capture: FieldCapture): string {
    if (capture.serialSource === 'barcode') return 'barcode · exact';
    if (capture.serialSource === 'manual') return 'typed by operator';
    const pct = Math.round((capture.ocrConfidence ?? 0) * 100);
    return capture.serialSource === 'ocr-corrected'
      ? `camera ${pct}%, corrected`
      : `camera ${pct}%`;
  }

  /** Low-agreement OCR is the shape most likely to be quietly wrong. */
  public lowConfidence(capture: FieldCapture): boolean {
    return (
      capture.serialSource !== 'barcode' &&
      capture.serialSource !== 'manual' &&
      (capture.ocrConfidence ?? 0) < 0.6
    );
  }

  // -------------------------------------------------------------- actions

  public approve(): void {
    if (!this.selected || this.acting) return;
    this.acting = true;
    this.actionError = '';

    const payload: Record<string, any> = {};
    if (this.edit.capacity != null) payload['capacity'] = this.edit.capacity;
    if (this.edit.commissioningDate) {
      payload['commissioningDate'] = this.edit.commissioningDate;
    }
    if (this.edit.fuelCode) payload['fuelCode'] = this.edit.fuelCode;
    if (this.edit.deviceTypeCode) {
      payload['deviceTypeCode'] = this.edit.deviceTypeCode;
    }
    if (this.edit.siteName) payload['siteName'] = this.edit.siteName;
    if (this.edit.countryCode) payload['countryCode'] = this.edit.countryCode;
    if (this.edit.address) payload['address'] = this.edit.address;

    this.service
      .approve(this.selected.uuid, {
        serialNumber: this.edit.serialNumber.trim(),
        payload,
        reviewNote: this.reviewNote.trim() || undefined,
      })
      .subscribe({
        next: (updated) => {
          this.acting = false;
          this.actionResult = `Approved — device ${updated.deviceId} created.`;
          this.afterAction(updated);
        },
        error: (err) => {
          this.acting = false;
          // 409 is the useful one: a duplicate serial or site name means the
          // device already exists, which is a finding, not a failure.
          this.actionError =
            err?.error?.message ?? 'Could not approve this capture.';
        },
      });
  }

  public reject(): void {
    if (!this.selected || this.acting) return;
    if (!this.reviewNote.trim()) {
      this.actionError =
        'A rejection needs a reason — the operator has to know what to redo ' +
        'before walking back to the site.';
      return;
    }
    this.acting = true;
    this.actionError = '';

    this.service.reject(this.selected.uuid, this.reviewNote.trim()).subscribe({
      next: (updated) => {
        this.acting = false;
        this.actionResult = 'Rejected.';
        this.afterAction(updated);
      },
      error: (err) => {
        this.acting = false;
        this.actionError =
          err?.error?.message ?? 'Could not reject this capture.';
      },
    });
  }

  private afterAction(updated: FieldCapture): void {
    if (this.selected) {
      this.selected = { ...this.selected, ...updated };
    }
    this.captures = this.captures.filter((c) => c.uuid !== updated.uuid);
  }

  // ------------------------------------------------------------------ map

  /**
   * Satellite, because the question a reviewer is actually asking is whether
   * there is a solar array where the operator says they stood. The accuracy
   * circle is drawn to scale so a 2 km fix looks like a 2 km fix.
   */
  private renderMap(capture: FieldCaptureDetail): void {
    const container = this.mapRef?.nativeElement;
    const lat = Number(capture.latitude);
    const lng = Number(capture.longitude);
    if (!container || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    this.destroyMap();
    this.mapForUuid = capture.uuid;

    const map = L.map(container, { attributionControl: false }).setView(
      [lat, lng],
      17,
    );
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      minZoom: 3,
      maxZoom: 21,
      noWrap: true,
      attribution: '&copy; Google',
    } as any).addTo(map);

    L.circleMarker([lat, lng], {
      radius: 7,
      color: '#22c55e',
      weight: 2,
      fillColor: '#22c55e',
      fillOpacity: 0.85,
    }).addTo(map);

    if (capture.gpsAccuracyM != null) {
      const circle = L.circle([lat, lng], {
        radius: capture.gpsAccuracyM,
        color: this.gpsTooCoarse ? '#f59e0b' : '#22c55e',
        weight: 1,
        fillOpacity: 0.12,
      }).addTo(map);

      // Frame the uncertainty, don't crop it. A fixed zoom 17 puts an 850 m
      // circle entirely off-screen, so the one capture where the reviewer most
      // needs to see how vague the fix is would look identical to a good one.
      map.fitBounds(circle.getBounds().pad(0.25), { maxZoom: 19 });
    }

    this.map = map;
    // The pane is laid out by the time this fires, but the tiles are sized
    // from the container, which may still have been zero-width on creation.
    setTimeout(() => map.invalidateSize(), 0);
  }

  private destroyMap(): void {
    this.map?.remove();
    this.map = null;
    this.mapForUuid = '';
  }
}
