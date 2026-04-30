import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { select } from 'd3-selection';
import { scaleOrdinal, scaleBand, scaleLinear, scaleTime } from 'd3-scale';
import {
  area as d3area,
  line as d3line,
  curveMonotoneX,
} from 'd3-shape';
import { axisBottom, axisLeft } from 'd3-axis';
import { rollup, sum, max, extent } from 'd3-array';
import { timeFormat } from 'd3-time-format';
import { easeCubicOut } from 'd3-ease';
import 'd3-transition';
import { DeviceService } from '../../auth/services/device.service';
import { MeterReadService } from '../../auth/services/meter-read.service';

interface DeviceRow {
  externalId: string;
  siteName: string;
  fuelCode: string;
  countryCode: string;
  capacity: number;
  commissioningYear: number;
  deviceTypeCode: string;
}

@Component({
  standalone: false,
  selector: 'app-charts',
  templateUrl: './charts.component.html',
  styleUrls: ['./charts.component.scss'],
})
export class ChartsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('commissionTimeline', { static: false }) commissionTimelineEl!: ElementRef;
  @ViewChild('capacityBar', { static: false }) capacityBarEl!: ElementRef;
  @ViewChild('topDevices', { static: false }) topDevicesEl!: ElementRef;
  @ViewChild('readsArea', { static: false }) readsAreaEl!: ElementRef;

  devices: DeviceRow[] = [];
  selectedDevice: DeviceRow | null = null;
  loading = true;
  readsLoading = false;
  loginuser: any;
  private resizeObserver!: ResizeObserver;

  private colors = [
    '#0f766e', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444',
    '#10b981', '#6366f1', '#ec4899', '#14b8a6', '#f97316',
  ];

  constructor(
    private deviceService: DeviceService,
    private meterReadService: MeterReadService,
  ) {}

  ngOnInit() {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    this.loadDevices();
  }

  ngAfterViewInit() {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.devices.length) this.renderAllCharts();
    });
    const el = this.commissionTimelineEl?.nativeElement?.closest('.charts');
    if (el) this.resizeObserver.observe(el);
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  private loadDevices() {
    const role = this.loginuser?.role;
    const deviceUrl = role === 'Admin' ? 'device?' : 'device/my?';

    this.deviceService.GetMyDevices(deviceUrl).subscribe({
      next: (res: any) => {
        this.devices = (res.devices ?? res ?? []).map((d: any) => ({
          externalId: d.externalId,
          siteName: d.siteName || d.externalId,
          fuelCode: d.fuelCode || 'Unknown',
          countryCode: d.countryCode || 'Unknown',
          capacity: +(d.capacity || 0),
          commissioningYear: d.commissioningDate ? new Date(d.commissioningDate).getFullYear() : 0,
          deviceTypeCode: d.deviceTypeCode || 'Unknown',
        }));
        this.loading = false;
        setTimeout(() => this.renderAllCharts());
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private renderAllCharts() {
    this.renderCommissionTimeline();
    this.renderCapacityBar();
    this.renderTopDevices();
  }

  selectDevice(device: DeviceRow) {
    this.selectedDevice = device;
    this.loadReads(device);
  }

  private loadReads(device: DeviceRow) {
    this.readsLoading = true;
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    this.meterReadService.GetRead(device.externalId, { start, end }).subscribe({
      next: (res: any) => {
        const reads = res.historyread ?? res ?? [];
        this.readsLoading = false;
        setTimeout(() => this.renderReadsArea(reads, device));
      },
      error: () => {
        this.readsLoading = false;
      },
    });
  }

  // ── Commissioning timeline (stacked by device type) ─────
  private renderCommissionTimeline() {
    const el = this.commissionTimelineEl?.nativeElement;
    if (!el) return;
    select(el).selectAll('*').remove();

    const withYear = this.devices.filter((d: any) => d.commissioningYear > 2000);
    if (!withYear.length) return;

    // Group by year then device type
    const types = Array.from(new Set(withYear.map((d: any) => d.deviceTypeCode))).sort();
    const byYear = rollup(withYear, (v: any) => v.length, (d: any) => d.commissioningYear, (d: any) => d.deviceTypeCode);
    const years = Array.from(byYear.keys()).sort();
    const data = years.map((year) => {
      const row: any = { year: String(year) };
      const typeMap = byYear.get(year)!;
      types.forEach((t) => (row[t] = typeMap.get(t) || 0));
      row._total = types.reduce((s, t) => s + (row[t] as number), 0);
      return row;
    });

    const rect = el.getBoundingClientRect();
    const margin = { top: 12, right: 16, bottom: 32, left: 36 };
    const width = rect.width - margin.left - margin.right;
    const height = 240 - margin.top - margin.bottom;

    const svg = select(el)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = scaleBand().domain(data.map((d: any) => d.year)).range([0, width]).padding(0.25);
    const yMax = max(data, (d: any) => d._total) || 1;
    const y = scaleLinear().domain([0, yMax]).nice().range([height, 0]);
    const color = scaleOrdinal<string>().domain(types).range(this.colors);

    svg.append('g').attr('class', 'grid')
      .call(axisLeft(y).ticks(5).tickSize(-width).tickFormat(() => ''))
      .call((g: any) => g.select('.domain').remove())
      .call((g: any) => g.selectAll('.tick line').attr('stroke', '#e2e8f0'));

    svg.append('g').attr('transform', `translate(0,${height})`)
      .call(axisBottom(x))
      .call((g: any) => g.select('.domain').attr('stroke', '#e2e8f0'))
      .selectAll('text').style('font-size', '10px').style('fill', '#64748b')
      .attr('transform', 'rotate(-45)').attr('text-anchor', 'end');

    svg.append('g').call(axisLeft(y).ticks(5).tickFormat((d: any) => String(d)))
      .call((g: any) => g.select('.domain').remove())
      .selectAll('text').style('font-size', '10px').style('fill', '#64748b');

    // Stacked bars
    types.forEach((type, ti) => {
      svg.selectAll(`.bar-${ti}`).data(data).enter().append('rect')
        .attr('x', (d: any) => x(d.year)!)
        .attr('width', x.bandwidth())
        .attr('rx', 2)
        .attr('fill', color(type))
        .attr('y', height).attr('height', 0)
        .transition().duration(600).delay((_d, i) => i * 40)
        .attr('y', (d: any) => {
          let cumulative = 0;
          for (let j = 0; j <= ti; j++) cumulative += d[types[j]];
          return y(cumulative);
        })
        .attr('height', (d: any) => {
          const val = d[type];
          if (!val) return 0;
          let cumulative = 0;
          for (let j = 0; j <= ti; j++) cumulative += d[types[j]];
          return y(cumulative - val) - y(cumulative);
        });
    });

    // Count labels on top of bars
    svg.selectAll('.total').data(data).enter().append('text')
      .attr('x', (d: any) => x(d.year)! + x.bandwidth() / 2)
      .attr('y', (d: any) => y(d._total) - 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px').style('font-weight', '600').style('fill', '#0f766e')
      .style('opacity', 0)
      .text((d: any) => d._total)
      .transition().duration(400).delay((_d, i) => 400 + i * 40).style('opacity', 1);

    // Legend
    if (types.length > 1) {
      const legend = select(el).append('div').attr('class', 'chart-legend');
      types.forEach((t) => {
        const item = legend.append('div').attr('class', 'chart-legend__item');
        item.append('span').attr('class', 'chart-legend__swatch').style('background', color(t));
        item.append('span').text(t);
      });
    }
  }

  // ── Capacity by country bar chart ────────────────────────
  private renderCapacityBar() {
    const el = this.capacityBarEl?.nativeElement;
    if (!el) return;
    select(el).selectAll('*').remove();

    const grouped = rollup(this.devices, (v: any) => sum(v, (d: any) => d.capacity), (d: any) => d.countryCode);
    const data = Array.from(grouped, ([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);
    if (!data.length) return;

    const rect = el.getBoundingClientRect();
    const margin = { top: 12, right: 16, bottom: 32, left: 48 };
    const width = rect.width - margin.left - margin.right;
    const height = 240 - margin.top - margin.bottom;

    const svg = select(el)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = scaleBand().domain(data.map((d: any) => d.key)).range([0, width]).padding(0.3);
    const y = scaleLinear().domain([0, max(data, (d: any) => d.value)!]).nice().range([height, 0]);

    svg.append('g').attr('class', 'grid')
      .call(axisLeft(y).ticks(5).tickSize(-width).tickFormat(() => ''))
      .call((g: any) => g.select('.domain').remove())
      .call((g: any) => g.selectAll('.tick line').attr('stroke', '#e2e8f0'));

    svg.append('g').attr('transform', `translate(0,${height})`)
      .call(axisBottom(x))
      .call((g: any) => g.select('.domain').attr('stroke', '#e2e8f0'))
      .selectAll('text').style('font-size', '11px').style('fill', '#64748b');

    svg.append('g').call(axisLeft(y).ticks(5))
      .call((g: any) => g.select('.domain').remove())
      .selectAll('text').style('font-size', '11px').style('fill', '#64748b');

    const defs = svg.append('defs');
    const grad = defs.append('linearGradient').attr('id', 'barGrad')
      .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#14b8a6');
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#0f766e');

    svg.selectAll('.bar').data(data).enter().append('rect')
      .attr('x', (d: any) => x(d.key)!)
      .attr('width', x.bandwidth())
      .attr('y', height).attr('height', 0).attr('rx', 4)
      .attr('fill', 'url(#barGrad)')
      .transition().duration(600).delay((_d, i) => i * 60)
      .attr('y', (d: any) => y(d.value))
      .attr('height', (d: any) => height - y(d.value));

    svg.selectAll('.label').data(data).enter().append('text')
      .attr('x', (d: any) => x(d.key)! + x.bandwidth() / 2)
      .attr('y', (d: any) => y(d.value) - 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px').style('font-weight', '600').style('fill', '#0f766e')
      .style('opacity', 0)
      .text((d: any) => d.value >= 1000 ? `${(d.value / 1000).toFixed(1)}MW` : `${d.value}kW`)
      .transition().duration(400).delay((_d, i) => 400 + i * 60).style('opacity', 1);
  }

  // ── Top devices horizontal bar ───────────────────────────
  private renderTopDevices() {
    const el = this.topDevicesEl?.nativeElement;
    if (!el) return;
    select(el).selectAll('*').remove();

    const data = [...this.devices].sort((a, b) => b.capacity - a.capacity).slice(0, 8);
    if (!data.length) return;

    const rect = el.getBoundingClientRect();
    const margin = { top: 8, right: 50, bottom: 8, left: 120 };
    const width = rect.width - margin.left - margin.right;
    const barH = 24;
    const gap = 6;
    const height = data.length * (barH + gap);

    const svg = select(el)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = scaleLinear().domain([0, max(data, (d: any) => d.capacity)!]).nice().range([0, width]);
    const y = scaleBand().domain(data.map((d: any) => d.siteName)).range([0, height]).padding(0.15);

    svg.selectAll('.name').data(data).enter().append('text')
      .attr('x', -6)
      .attr('y', (d: any) => y(d.siteName)! + y.bandwidth() / 2)
      .attr('dy', '0.35em').attr('text-anchor', 'end')
      .style('font-size', '11px').style('fill', '#334155')
      .text((d: any) => d.siteName.length > 16 ? d.siteName.slice(0, 15) + '\u2026' : d.siteName);

    svg.selectAll('.bar').data(data).enter().append('rect')
      .attr('x', 0).attr('y', (d: any) => y(d.siteName)!)
      .attr('height', y.bandwidth()).attr('rx', 3)
      .attr('fill', (_d, i) => this.colors[i % this.colors.length])
      .attr('width', 0)
      .style('cursor', 'pointer')
      .on('click', (_ev: any, d: any) => this.selectDevice(d))
      .transition().duration(600).delay((_d, i) => i * 50)
      .attr('width', (d: any) => x(d.capacity));

    svg.selectAll('.val').data(data).enter().append('text')
      .attr('x', (d: any) => x(d.capacity) + 4)
      .attr('y', (d: any) => y(d.siteName)! + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .style('font-size', '10px').style('font-weight', '600').style('fill', '#64748b')
      .style('opacity', 0)
      .text((d: any) => `${d.capacity} kW`)
      .transition().duration(400).delay((_d, i) => 400 + i * 50).style('opacity', 1);
  }

  // ── Meter reads area chart ───────────────────────────────
  private renderReadsArea(reads: any[], _device: DeviceRow) {
    const el = this.readsAreaEl?.nativeElement;
    if (!el) return;
    select(el).selectAll('*').remove();

    if (!reads.length) {
      select(el).append('div')
        .style('padding', '40px').style('text-align', 'center').style('color', '#64748b')
        .text('No meter reads in the last 6 months');
      return;
    }

    const parsed = reads
      .map((r: any) => ({
        date: new Date(r.startDate ?? r.timestamp ?? r.datetime),
        value: +(r.value ?? r.reads?.[0]?.value ?? 0) / 1000,
      }))
      .filter((r: any) => !isNaN(r.date.getTime()) && r.value > 0)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (!parsed.length) {
      select(el).append('div')
        .style('padding', '40px').style('text-align', 'center').style('color', '#64748b')
        .text('No valid meter reads to chart');
      return;
    }

    const rect = el.getBoundingClientRect();
    const margin = { top: 16, right: 16, bottom: 32, left: 56 };
    const width = rect.width - margin.left - margin.right;
    const height = 220 - margin.top - margin.bottom;

    const svg = select(el)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = scaleTime().domain(extent(parsed, (d: any) => d.date) as [Date, Date]).range([0, width]);
    const y = scaleLinear().domain([0, max(parsed, (d: any) => d.value)!]).nice().range([height, 0]);

    const defs = svg.append('defs');
    const grad = defs.append('linearGradient').attr('id', 'areaGrad')
      .attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#0f766e').attr('stop-opacity', 0.3);
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#0f766e').attr('stop-opacity', 0.02);

    svg.append('g').attr('class', 'grid')
      .call(axisLeft(y).ticks(5).tickSize(-width).tickFormat(() => ''))
      .call((g: any) => g.select('.domain').remove())
      .call((g: any) => g.selectAll('.tick line').attr('stroke', '#e2e8f0'));

    svg.append('g').attr('transform', `translate(0,${height})`)
      .call(axisBottom(x).ticks(6).tickFormat((d: any) => timeFormat('%b %d')(d as Date)))
      .call((g: any) => g.select('.domain').attr('stroke', '#e2e8f0'))
      .selectAll('text').style('font-size', '10px').style('fill', '#64748b');

    svg.append('g').call(axisLeft(y).ticks(5))
      .call((g: any) => g.select('.domain').remove())
      .selectAll('text').style('font-size', '10px').style('fill', '#64748b');

    svg.append('text').attr('transform', 'rotate(-90)')
      .attr('y', -42).attr('x', -height / 2).attr('text-anchor', 'middle')
      .style('font-size', '10px').style('fill', '#64748b').text('kWh');

    const areaGen = d3area<any>()
      .x((d: any) => x(d.date)).y0(height).y1((d: any) => y(d.value)).curve(curveMonotoneX);

    svg.append('path').datum(parsed).attr('fill', 'url(#areaGrad)').attr('d', areaGen);

    const lineGen = d3line<any>()
      .x((d: any) => x(d.date)).y((d: any) => y(d.value)).curve(curveMonotoneX);

    const path = svg.append('path').datum(parsed)
      .attr('fill', 'none').attr('stroke', '#0f766e').attr('stroke-width', 2).attr('d', lineGen);

    const totalLength = (path.node() as SVGPathElement).getTotalLength();
    path
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition().duration(1000).ease(easeCubicOut)
      .attr('stroke-dashoffset', 0);

    svg.selectAll('.dot').data(parsed).enter().append('circle')
      .attr('cx', (d: any) => x(d.date)).attr('cy', (d: any) => y(d.value))
      .attr('r', parsed.length > 50 ? 0 : 3)
      .attr('fill', '#0f766e').attr('stroke', '#fff').attr('stroke-width', 1.5)
      .style('opacity', 0)
      .transition().duration(400).delay(1000).style('opacity', 1);
  }
}
