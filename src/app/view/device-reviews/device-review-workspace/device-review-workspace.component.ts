import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { DeviceService } from '../../../auth/services/device.service';
import { AssetService } from '../asset.service';

interface DocRow {
  id: number;
  type: string;
  url: string;
  label: string;
  originalFilename: string | null;
}

// Display label per DocumentType, keyed + OC-ordered for the docs column.
const DOC_ROWS: { label: string; oc: string; type: string }[] = [
  { label: 'Project Photos', oc: '43', type: 'PROJECT_PHOTOS' },
  { label: 'Facility Boundary', oc: '44', type: 'FACILITY_BOUNDARY' },
  { label: 'Single Line Diagram', oc: '45', type: 'SINGLE_LINE_DIAGRAM' },
  { label: "SF-02c (Owner's Declaration)", oc: '46', type: 'SF_02C' },
  { label: 'Proof of Ownership', oc: '47', type: 'SF_02C_OWNERS_DECLARATION' },
  { label: 'COD Proof', oc: '48', type: 'COD_PROOF' },
  { label: 'Metering Evidence', oc: '49', type: 'METERING_EVIDENCE' },
  { label: 'Other Documents', oc: '50', type: 'OTHER_DOCUMENTS' },
];

@Component({
  standalone: false,
  selector: 'app-ds-device-review-workspace',
  templateUrl: './device-review-workspace.component.html',
  styleUrls: ['./device-review-workspace.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceReviewWorkspaceComponent implements OnInit, OnDestroy {
  deviceId: number | null = null;
  device: any = null;
  documents: DocRow[] = [];
  loading = false;
  docRows = DOC_ROWS;

  activeDoc: DocRow | null = null;
  activeDocSafeUrl: SafeResourceUrl | null = null;

  private sub!: Subscription;

  constructor(
    readonly svc: AssetService,
    private deviceService: DeviceService,
    private sanitizer: DomSanitizer,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.svc.reviewDeviceId$
      .pipe(
        switchMap((id) => {
          if (id == null) {
            this.reset();
            this.cdr.markForCheck();
            return of(null);
          }
          this.deviceId = id;
          this.loading = true;
          this.cdr.markForCheck();
          return forkJoin({
            device: this.deviceService.GetDevicesInfo(id),
            documents: this.deviceService.getDocuments(id).pipe(
              catchError(() => of([])),
            ),
          });
        }),
      )
      .subscribe({
        next: (data) => {
          if (!data) return;
          this.device = data.device;
          this.documents = (data.documents || []).map((d: any) => ({
            id: d.id,
            type: d.type,
            url: d.url,
            label: d.label || d.originalFilename || `File ${d.id}`,
            originalFilename: d.originalFilename ?? null,
          }));
          this.loading = false;
          // Auto-pick the first non-empty doc so the left pane has something to show.
          const first = this.docRows
            .flatMap((r) => this.documents.filter((d) => d.type === r.type))
            .find(() => true);
          if (first) this.selectDoc(first);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          const msg = err?.error?.message || err?.message || 'Unknown error';
          this.toastr.error(`Failed to load device: ${msg}`);
          this.cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  docsOf(type: string): DocRow[] {
    return this.documents.filter((d) => d.type === type);
  }

  selectDoc(d: DocRow): void {
    this.activeDoc = d;
    this.activeDocSafeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(d.url);
    this.cdr.markForCheck();
  }

  isImage(d: DocRow): boolean {
    return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(d.url);
  }

  isPdf(d: DocRow): boolean {
    return /\.pdf(\?|$)/i.test(d.url);
  }

  back(): void {
    this.svc.openForReview(null);
  }

  private reset(): void {
    this.deviceId = null;
    this.device = null;
    this.documents = [];
    this.activeDoc = null;
    this.activeDocSafeUrl = null;
    this.loading = false;
  }
}
