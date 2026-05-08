import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { select, Selection } from 'd3-selection';
import { scaleBand, scaleLinear, scaleOrdinal } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { line as d3Line, area as d3Area, arc as d3Arc, pie as d3Pie } from 'd3-shape';
import { max as d3Max } from 'd3-array';
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
export class AiUsageComponent implements OnInit, AfterViewInit, OnDestroy {
  data: UsageSummary | null = null;
  error = '';
  loading = false;
  monthlyCapUsd = 200;

  @ViewChild('dailyChart') dailyChart!: ElementRef<SVGSVGElement>;
  @ViewChild('endpointChart') endpointChart!: ElementRef<SVGSVGElement>;
  @ViewChild('capArc') capArc!: ElementRef<SVGSVGElement>;

  private resizeObs?: ResizeObserver;

  // D-REC palette pulled from the existing UI: deep blue / teal /
  // amber / red / muted slate. Cycled per-endpoint in the donut.
  private palette = [
    '#0F607F',
    '#0891B2',
    '#16A34A',
    '#F59E0B',
    '#DC2626',
    '#7C3AED',
    '#EC4899',
    '#475569',
  ];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.refresh();
  }

  ngAfterViewInit(): void {
    // Re-render charts when the page resizes (sidebar collapse, etc).
    this.resizeObs = new ResizeObserver(() => this.renderCharts());
    if (this.dailyChart) this.resizeObs.observe(this.dailyChart.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
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
          // Defer to next tick so *ngIf="data" renders the SVG first.
          setTimeout(() => this.renderCharts(), 0);
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
      Math.round(
        (this.data.monthToDate.estimatedUsd / this.monthlyCapUsd) * 100,
      ),
    );
  }

  private renderCharts(): void {
    if (!this.data) return;
    this.renderDaily();
    this.renderEndpoint();
    this.renderCapArc();
  }

  /** Area + line chart of daily spend over the last 30 days. */
  private renderDaily(): void {
    if (!this.dailyChart || !this.data) return;
    const svgEl = this.dailyChart.nativeElement;
    const rect = svgEl.getBoundingClientRect();
    const width = Math.max(rect.width, 320);
    const height = 220;
    const margin = { top: 12, right: 16, bottom: 28, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg: Selection<SVGSVGElement, unknown, null, undefined> = select(
      svgEl,
    );
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', '100%');
    svg.selectAll('*').remove();
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Densify: ensure every day in the last 30 has a row (zero if empty).
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const map = new Map(this.data.daily.map((d) => [d.day, d.estimatedUsd]));
    const days: { day: string; usd: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ day: key, usd: map.get(key) ?? 0 });
    }

    const x = scaleBand<string>()
      .domain(days.map((d) => d.day))
      .range([0, innerW])
      .padding(0.05);

    const yMax = Math.max(d3Max(days, (d) => d.usd) || 0, 0.01);
    const y = scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

    // Gridlines
    g.append('g')
      .attr('class', 'aiu-grid')
      .selectAll('line')
      .data(y.ticks(5))
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', '#e2e8f0')
      .attr('stroke-dasharray', '2,3');

    // Bars
    g.selectAll('rect.bar')
      .data(days)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.day)!)
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.usd))
      .attr('height', (d) => innerH - y(d.usd))
      .attr('fill', '#0F607F')
      .attr('rx', 2)
      .append('title')
      .text((d) => `${d.day}\n$${d.usd.toFixed(4)}`);

    // X axis: show every ~5th label to avoid clutter
    const xTickEvery = Math.ceil(days.length / 6);
    g.append('g')
      .attr('transform', `translate(0, ${innerH})`)
      .call(
        axisBottom<string>(x).tickValues(
          days.filter((_, i) => i % xTickEvery === 0).map((d) => d.day),
        ),
      )
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', '#64748b');

    // Y axis: dollar formatted
    g.append('g')
      .call(axisLeft(y).ticks(5).tickFormat((v) => `$${(+v).toFixed(2)}`))
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', '#64748b');

    // Strip the axis lines themselves for a cleaner look
    g.selectAll('.domain').attr('stroke', '#cbd5e1');
    g.selectAll('.tick line').attr('stroke', '#cbd5e1');
  }

  /** Donut for endpoint cost breakdown. */
  private renderEndpoint(): void {
    if (!this.endpointChart || !this.data || !this.data.byEndpoint.length)
      return;
    const svgEl = this.endpointChart.nativeElement;
    const size = 220;
    const radius = size / 2 - 8;
    const inner = radius * 0.6;
    const svg = select(svgEl);
    svg.attr('viewBox', `0 0 ${size} ${size + 80}`).attr('width', '100%');
    svg.selectAll('*').remove();

    const g = svg
      .append('g')
      .attr('transform', `translate(${size / 2}, ${size / 2})`);

    const data = this.data.byEndpoint;
    const color = scaleOrdinal<string>()
      .domain(data.map((d) => d.endpoint))
      .range(this.palette);

    const pieGen = d3Pie<typeof data[0]>()
      .value((d) => d.estimatedUsd || 0.0001)
      .sort(null);
    const arcGen = d3Arc<any>().innerRadius(inner).outerRadius(radius);

    g.selectAll('path')
      .data(pieGen(data))
      .join('path')
      .attr('d', arcGen as any)
      .attr('fill', (d: any) => color(d.data.endpoint) as string)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .append('title')
      .text(
        (d: any) =>
          `${d.data.endpoint}\n$${d.data.estimatedUsd.toFixed(4)} · ${d.data.calls} calls`,
      );

    // Centre label: total $
    const total = data.reduce((s, d) => s + d.estimatedUsd, 0);
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-2')
      .attr('font-size', '12px')
      .attr('fill', '#64748b')
      .text('this month');
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '16')
      .attr('font-size', '18px')
      .attr('font-weight', '700')
      .attr('fill', '#1e3a8a')
      .text(`$${total.toFixed(2)}`);

    // Legend below the donut
    const legend = svg
      .append('g')
      .attr('transform', `translate(8, ${size + 8})`);
    legend
      .selectAll('g.legend-row')
      .data(data)
      .join('g')
      .attr('class', 'legend-row')
      .attr('transform', (_, i) => `translate(0, ${i * 14})`)
      .each(function (d) {
        const row = select(this);
        row
          .append('rect')
          .attr('width', 10)
          .attr('height', 10)
          .attr('rx', 2)
          .attr('fill', color(d.endpoint) as string);
        row
          .append('text')
          .attr('x', 16)
          .attr('y', 9)
          .attr('font-size', '11px')
          .attr('fill', '#334155')
          .text(`${d.endpoint} — $${d.estimatedUsd.toFixed(2)}`);
      });
  }

  /** Half-arc gauge of monthly spend vs cap. */
  private renderCapArc(): void {
    if (!this.capArc || !this.data) return;
    const svgEl = this.capArc.nativeElement;
    const w = 220;
    const h = 130;
    const r = 95;
    const svg = select(svgEl);
    svg.attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%');
    svg.selectAll('*').remove();

    const g = svg
      .append('g')
      .attr('transform', `translate(${w / 2}, ${h - 10})`);

    const half = Math.PI / 2;
    const bgArc = d3Arc<void>()
      .innerRadius(r - 14)
      .outerRadius(r)
      .startAngle(-half)
      .endAngle(half);
    g.append('path').attr('d', bgArc() as string).attr('fill', '#e2e8f0');

    const pct = this.capPercent() / 100;
    const fillColor =
      pct >= 0.9 ? '#dc2626' : pct >= 0.75 ? '#f59e0b' : '#16a34a';
    const fgArc = d3Arc<void>()
      .innerRadius(r - 14)
      .outerRadius(r)
      .startAngle(-half)
      .endAngle(-half + pct * Math.PI);
    g.append('path').attr('d', fgArc() as string).attr('fill', fillColor);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -36)
      .attr('font-size', '24px')
      .attr('font-weight', '700')
      .attr('fill', '#1e3a8a')
      .text(`$${this.data.monthToDate.estimatedUsd.toFixed(2)}`);
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -16)
      .attr('font-size', '11px')
      .attr('fill', '#64748b')
      .text(`of $${this.monthlyCapUsd} cap (${this.capPercent()}%)`);
  }
}
