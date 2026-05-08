import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface UsageSummary {
  monthToDate: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedUsd: number;
    successRate: number;
  };
  byEndpoint: Array<{
    endpoint: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedUsd: number;
  }>;
  daily: Array<{ day: string; calls: number; estimatedUsd: number }>;
  topOrgs: Array<{
    organizationId: number | null;
    calls: number;
    estimatedUsd: number;
  }>;
}

@Component({
  standalone: false,
  selector: 'app-ai-usage',
  templateUrl: './ai-usage.component.html',
  styleUrls: ['./ai-usage.component.scss'],
})
export class AiUsageComponent implements OnInit {
  data: UsageSummary | null = null;
  error = '';
  loading = false;
  // Workspace cap is set in the Anthropic console; surface here so the
  // dashboard contextualises spend.
  monthlyCapUsd = 200;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.error = '';
    this.http
      .get<UsageSummary>(`${environment.API_URL}ai/usage`)
      .subscribe({
        next: (r) => {
          this.data = r;
          this.loading = false;
        },
        error: (err) => {
          this.error =
            err?.error?.message ?? err?.message ?? 'Failed to load usage';
          this.loading = false;
        },
      });
  }

  capPercent(): number {
    if (!this.data) return 0;
    return Math.min(
      100,
      Math.round((this.data.monthToDate.estimatedUsd / this.monthlyCapUsd) * 100),
    );
  }

  maxDailySpend(): number {
    if (!this.data?.daily?.length) return 0;
    return Math.max(...this.data.daily.map((d) => d.estimatedUsd));
  }
}
