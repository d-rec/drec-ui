import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../../environments/environment';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-verification-report-view',
  templateUrl: './report-view.component.html',
  styleUrls: ['./report-view.component.scss'],
})
export class VerificationReportViewComponent implements OnInit {
  loading = true;
  error = '';
  report:
    | (Record<string, any> & {
        id: number;
        deviceId: number;
        createdByEmail: string;
        createdByName: string | null;
        elapsedMs: number;
        overallStatus: string | null;
        payload: any;
        createdAt: string;
      })
    | null = null;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    const ref = this.route.snapshot.params['id'];
    if (!ref) {
      this.loading = false;
      this.error = 'Missing report id';
      return;
    }
    // Direct HTTP — endpoint is public (no JWT) so the registrant can
    // open the URL without being logged in. `ref` may be a uuid (preferred)
    // or the legacy integer id.
    this.http
      .get<any>(`${environment.API_URL}device-reviews/reports/${ref}`)
      .subscribe({
        next: (r) => {
          this.report = r;
          this.loading = false;
        },
        error: (e) => {
          this.error =
            e?.error?.message || e?.message || 'Could not load report';
          this.loading = false;
        },
      });
  }

  get scanLog(): any[] {
    return this.report?.payload?.scanLog || [];
  }
}
