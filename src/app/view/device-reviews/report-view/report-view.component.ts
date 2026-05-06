import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AssetService } from '../asset.service';

@Component({
  standalone: false,
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
    private svc: AssetService,
  ) {}

  ngOnInit(): void {
    const id = parseInt(this.route.snapshot.params['id'], 10);
    if (!id) {
      this.loading = false;
      this.error = 'Missing report id';
      return;
    }
    this.svc.getVerificationReport(id).subscribe({
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
