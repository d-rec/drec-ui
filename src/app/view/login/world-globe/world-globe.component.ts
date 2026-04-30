import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { select } from 'd3-selection';
import {
  geoOrthographic,
  geoPath,
  geoGraticule10,
  geoDistance,
} from 'd3-geo';
import { timer, Timer } from 'd3-timer';
import { feature } from 'topojson-client';
import { environment } from '../../../../environments/environment';

interface SiteDot {
  lon: number;
  lat: number;
  phase: number;
}

interface FeaturedSite {
  lat: number;
  lon: number;
  label?: string;
}

@Component({
  standalone: false,
  selector: 'app-world-globe',
  templateUrl: './world-globe.component.html',
  styleUrls: ['./world-globe.component.scss'],
})
export class WorldGlobeComponent implements AfterViewInit, OnDestroy {
  @ViewChild('globeSvg', { static: true })
  svgRef!: ElementRef<SVGSVGElement>;

  private animTimer: Timer | null = null;
  private cutawayTimeout: any = null;
  private resizeObserver: ResizeObserver | null = null;
  private destroyed = false;

  private width = 800;
  private height = 800;
  private rotation: [number, number, number] = [-20, -10, 0];
  private rotationSpeed = 6; // deg/sec → ~60s/rev
  private lastFrameMs = 0;

  private projection = geoOrthographic();
  private pathGen = geoPath(this.projection);

  private countries: any = null;
  private sites: SiteDot[] = [];
  private featured: FeaturedSite[] = [];

  private cutawayActive = false;
  private cutawayStartMs = 0;
  private cutawayPos: [number, number] | null = null;
  private cutawayMaxR = 70;

  constructor(
    private http: HttpClient,
    private zone: NgZone,
    private host: ElementRef,
  ) {}

  ngAfterViewInit() {
    this.measure();
    this.loadAssets();
    this.resizeObserver = new ResizeObserver(() => {
      this.measure();
    });
    this.resizeObserver.observe(this.host.nativeElement);
  }

  ngOnDestroy() {
    this.destroyed = true;
    if (this.animTimer) this.animTimer.stop();
    if (this.cutawayTimeout) clearTimeout(this.cutawayTimeout);
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  private measure() {
    const el = this.host.nativeElement as HTMLElement;
    this.width = el.clientWidth || window.innerWidth;
    this.height = el.clientHeight || window.innerHeight;
    const radius = Math.min(this.width, this.height) * 0.48;
    this.projection
      .scale(radius)
      .translate([this.width / 2, this.height / 2])
      .rotate(this.rotation);
    this.pathGen = geoPath(this.projection);

    const svg = select(this.svgRef.nativeElement);
    svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);
    svg
      .select<SVGCircleElement>('circle.ocean')
      .attr('cx', this.width / 2)
      .attr('cy', this.height / 2)
      .attr('r', radius);
  }

  private loadAssets() {
    Promise.all([
      this.http.get<any>('assets/world-110m.json').toPromise(),
      this.http.get<number[][]>('assets/world-sites.json').toPromise(),
    ]).then((res: any[]) => {
      if (this.destroyed) return;
      const topo = res[0];
      const siteCoords = res[1] as number[][];
      this.countries = feature(topo, topo.objects.countries);
      this.sites = (siteCoords || []).map((c: number[], i: number) => ({
        lat: c[0],
        lon: c[1],
        phase: (i * 0.137) % 1,
      }));
      this.renderInitial();
      this.startAnimation();
      this.scheduleCutaway(6000);
      this.loadFeaturedSites();
    });
  }

  /** Inject curated unjittered coords for the satellite cutaway. */
  setFeaturedSites(featured: FeaturedSite[]) {
    this.featured = featured || [];
  }

  private loadFeaturedSites() {
    this.http
      .get<FeaturedSite[]>(`${environment.API_URL}featured-sites`)
      .subscribe({
        next: (list: FeaturedSite[]) => {
          if (this.destroyed) return;
          this.setFeaturedSites(list || []);
        },
        error: () => {
          // Silent fail — globe still rotates with dots, just no cutaway.
        },
      });
  }

  private renderInitial() {
    const svg = select(this.svgRef.nativeElement);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);

    svg.append('defs');

    const radius = this.projection.scale();
    svg
      .append('circle')
      .attr('class', 'ocean')
      .attr('cx', this.width / 2)
      .attr('cy', this.height / 2)
      .attr('r', radius);

    svg.append('path').attr('class', 'graticule');
    svg.append('g').attr('class', 'countries');
    svg.append('g').attr('class', 'dots');
    svg.append('g').attr('class', 'cutaway');
  }

  private startAnimation() {
    this.lastFrameMs = performance.now();
    this.zone.runOutsideAngular(() => {
      this.animTimer = timer(() => this.tick());
    });
  }

  private tick() {
    if (this.destroyed) return;
    const now = performance.now();
    const dt = now - this.lastFrameMs;
    this.lastFrameMs = now;

    if (!this.cutawayActive) {
      this.rotation[0] =
        (this.rotation[0] - (this.rotationSpeed * dt) / 1000) % 360;
      this.projection.rotate(this.rotation);
    }
    this.draw(now);
  }

  private draw(now: number) {
    const svg = select(this.svgRef.nativeElement);

    svg
      .select<SVGPathElement>('path.graticule')
      .attr('d', (this.pathGen(geoGraticule10()) as any) || '');

    const countrySel = svg
      .select('g.countries')
      .selectAll<SVGPathElement, any>('path')
      .data(this.countries.features);
    countrySel
      .enter()
      .append('path')
      .attr('class', 'country')
      .merge(countrySel as any)
      .attr('d', (d: any) => (this.pathGen(d) as any) || '');
    countrySel.exit().remove();

    const center: [number, number] = [-this.rotation[0], -this.rotation[1]];
    const dotG = svg.select('g.dots');
    const dotSel = dotG
      .selectAll<SVGCircleElement, SiteDot>('circle')
      .data(this.sites);
    const dotsEnter = dotSel
      .enter()
      .append('circle')
      .attr('class', 'site-dot');
    const dotsAll: any = dotsEnter.merge(dotSel as any);

    const tSec = now / 1000;
    dotsAll.each((d: any, i: number, nodes: any) => {
      const node = select(nodes[i]);
      const visible =
        geoDistance([d.lon, d.lat], center) < Math.PI / 2 - 0.02;
      if (!visible) {
        node.attr('display', 'none');
        return;
      }
      const p = this.projection([d.lon, d.lat]);
      if (!p) {
        node.attr('display', 'none');
        return;
      }
      const phase = (tSec * 0.5 + d.phase) % 1;
      const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
      node
        .attr('display', null)
        .attr('cx', p[0])
        .attr('cy', p[1])
        .attr('r', 1.2 + pulse * 1.4)
        .attr('opacity', 0.4 + pulse * 0.4);
    });
    dotSel.exit().remove();

    if (this.cutawayActive) {
      this.drawCutaway(now);
    }
  }

  private scheduleCutaway(delayMs: number) {
    if (this.cutawayTimeout) clearTimeout(this.cutawayTimeout);
    this.cutawayTimeout = setTimeout(() => this.startCutaway(), delayMs);
  }

  private startCutaway() {
    if (this.destroyed) return;
    if (!this.featured.length) {
      this.scheduleCutaway(8000);
      return;
    }
    const center: [number, number] = [-this.rotation[0], -this.rotation[1]];
    const visible = this.featured.filter(
      (s: FeaturedSite) =>
        geoDistance([s.lon, s.lat], center) < Math.PI / 2 - 0.25,
    );
    if (!visible.length) {
      this.scheduleCutaway(2000);
      return;
    }
    const site = visible[Math.floor(Math.random() * visible.length)];
    const p = this.projection([site.lon, site.lat]);
    if (!p) {
      this.scheduleCutaway(2000);
      return;
    }

    const url = this.tileUrl(site.lat, site.lon, 16);
    const svg = select(this.svgRef.nativeElement);
    const defs = svg.select('defs');
    defs.selectAll('#cutaway-clip').remove();

    defs
      .append('clipPath')
      .attr('id', 'cutaway-clip')
      .append('circle')
      .attr('class', 'cutaway-clip-circle')
      .attr('cx', p[0])
      .attr('cy', p[1])
      .attr('r', 0);

    const cutaway = svg.select('g.cutaway');
    cutaway.selectAll('*').remove();

    const r = this.cutawayMaxR;
    cutaway
      .append('image')
      .attr('class', 'cutaway-img')
      .attr('href', url)
      .attr('x', p[0] - r)
      .attr('y', p[1] - r)
      .attr('width', r * 2)
      .attr('height', r * 2)
      .attr('clip-path', 'url(#cutaway-clip)')
      .attr('opacity', 0.85);
    cutaway
      .append('circle')
      .attr('class', 'cutaway-ring')
      .attr('cx', p[0])
      .attr('cy', p[1])
      .attr('r', 0);

    this.cutawayActive = true;
    this.cutawayStartMs = performance.now();
    this.cutawayPos = p;
  }

  private drawCutaway(now: number) {
    const elapsed = now - this.cutawayStartMs;
    const inDur = 800;
    const hold = 2400;
    const outDur = 800;
    const total = inDur + hold + outDur;
    if (elapsed >= total) {
      this.endCutaway();
      return;
    }
    let r = 0;
    if (elapsed < inDur) r = (elapsed / inDur) * this.cutawayMaxR;
    else if (elapsed < inDur + hold) r = this.cutawayMaxR;
    else r = this.cutawayMaxR * (1 - (elapsed - inDur - hold) / outDur);

    const svg = select(this.svgRef.nativeElement);
    svg
      .select<SVGCircleElement>('defs circle.cutaway-clip-circle')
      .attr('r', r);
    svg.select<SVGCircleElement>('circle.cutaway-ring').attr('r', r);
  }

  private endCutaway() {
    this.cutawayActive = false;
    this.cutawayPos = null;
    const svg = select(this.svgRef.nativeElement);
    svg.select('g.cutaway').selectAll('*').remove();
    svg.select('defs').selectAll('#cutaway-clip').remove();
    this.scheduleCutaway(7000);
  }

  private tileUrl(lat: number, lon: number, zoom: number): string {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lon + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
        n,
    );
    return `https://mt1.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${zoom}`;
  }
}
