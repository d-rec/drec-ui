import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { AssetService } from '../asset.service';
import { ChatService } from '../../../chat/chat.service';
import { environment } from '../../../../environments/environment';

/**
 * Floating "Evidence Provenance" window. Standalone view for the
 * EVIDENCE_PROVENANCE HTML report — reviewer opens it from the
 * documents-window action bar via svc.viewProvenance(deviceId).
 *
 * Fetches the report through the auth-bearing HttpClient (the
 * streaming endpoint requires JWT, which an iframe src= can't
 * carry), wraps as a text/html blob URL, binds to the iframe.
 */
@Component({
  standalone: false,
  selector: 'app-ds-evidence-provenance-window',
  templateUrl: './evidence-provenance-window.component.html',
  styleUrls: ['./evidence-provenance-window.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvidenceProvenanceWindowComponent implements OnInit, OnDestroy {
  loading = false;
  error: string | null = null;
  hasReport = false;
  reportUrl: SafeUrl | null = null;
  deviceId: number | null = null;
  siteName: string | null = null;
  private objectUrl: string | null = null;
  private sub: Subscription | null = null;

  constructor(
    public svc: AssetService,
    private http: HttpClient,
    private chat: ChatService,
    private toastr: ToastrService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.svc.viewProvenanceDeviceId$.subscribe((id) => {
      this.deviceId = id;
      if (id == null) {
        this.reset();
        this.cdr.markForCheck();
        return;
      }
      this.load(id);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private reset(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.reportUrl = null;
    this.hasReport = false;
    this.error = null;
    this.loading = false;
    this.siteName = null;
  }

  close(): void {
    this.svc.viewProvenance(null);
  }

  private load(deviceId: number): void {
    this.loading = true;
    this.error = null;
    this.hasReport = false;
    // Site-name lookup so the window title reads naturally.
    const asset = this.svc.assets$.value.find(
      (a: any) => Number(a.id) === deviceId,
    );
    this.siteName = asset?.siteName ?? null;
    this.cdr.markForCheck();
    this.http
      .get<{ id: number; type: string; url: string }[]>(
        `${environment.API_URL}device/${deviceId}/documents`,
      )
      .subscribe({
        next: (docs) => {
          const provs = (docs ?? []).filter(
            (d) => d.type === 'EVIDENCE_PROVENANCE',
          );
          if (!provs.length) {
            this.loading = false;
            this.hasReport = false;
            this.cdr.markForCheck();
            return;
          }
          const latest = [...provs].sort((a, b) => b.id - a.id)[0];
          this.http
            .get(
              `${environment.API_URL}document-uploads/${latest.id}/url`,
              { responseType: 'blob' },
            )
            .subscribe({
              next: (raw) => {
                const blob = new Blob([raw], { type: 'text/html' });
                const previous = this.objectUrl;
                this.objectUrl = URL.createObjectURL(blob);
                this.reportUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
                  this.objectUrl,
                );
                this.hasReport = true;
                this.loading = false;
                if (previous) URL.revokeObjectURL(previous);
                this.cdr.markForCheck();
              },
              error: (e) => {
                this.loading = false;
                this.error =
                  e?.error?.message ||
                  e?.message ||
                  'Failed to load report';
                this.cdr.markForCheck();
              },
            });
        },
        error: (e) => {
          this.loading = false;
          this.error =
            e?.error?.message ||
            e?.message ||
            'Failed to list device documents';
          this.cdr.markForCheck();
        },
      });
  }

  /** Free-form note → admin chat. Same flow as device-info-window's
   *  contestExtraction; duplicated here so the window is self-
   *  contained. */
  contestExtraction(): void {
    if (this.deviceId == null) return;
    const note = window.prompt(
      'Describe the Haiku misread (which field, what was wrong, what the correct value should be):',
      '',
    );
    if (!note || !note.trim()) return;
    this.chat.getAdminUser().subscribe({
      next: (admin) => {
        const body = `**Haiku extraction contested** (site: ${this.siteName ?? '?'}, deviceId: ${this.deviceId})\n\n${note.trim()}`;
        this.chat
          .sendDirectMessage(admin.email, body, {
            deviceSiteName: this.siteName ?? undefined,
          })
          .subscribe({
            next: () =>
              this.toastr.success(
                'Sent to D-REC admin — thanks for the heads-up',
                'Provenance',
              ),
            error: (e) =>
              this.toastr.error(
                e?.error?.message || e?.message || 'Failed to send message',
                'Provenance',
              ),
          });
      },
      error: () =>
        this.toastr.error('Could not resolve admin email', 'Provenance'),
    });
  }
}
