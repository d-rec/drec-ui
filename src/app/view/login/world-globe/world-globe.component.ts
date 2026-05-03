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
  name?: string;
  /** If true, this site gets a label/leader but never a satellite cutaway. */
  labelOnly?: boolean;
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
  private cutawaySite: FeaturedSite | null = null;
  private cutawayMaxR = 70;

  // Card-shaped screen-space exclusion. Cutaways only land outside this rect
  // so they aren't hidden behind the centered login form.
  private cardWidth = 420;
  private cardHeight = 520;
  private cardPadding = 24;

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
    svg.append('g').attr('class', 'featured-leaders');
    svg.append('g').attr('class', 'featured-dots');
    svg.append('g').attr('class', 'featured-labels');
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

    this.rotation[0] =
      (this.rotation[0] - (this.rotationSpeed * dt) / 1000) % 360;
    this.projection.rotate(this.rotation);
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

    this.drawFeaturedAnnotations();

    if (this.cutawayActive) {
      this.drawCutaway(now);
    }
  }

  private drawFeaturedAnnotations() {
    if (!this.featured.length) return;
    const svg = select(this.svgRef.nativeElement);
    const center: [number, number] = [-this.rotation[0], -this.rotation[1]];
    const cx = this.width / 2;
    const cy = this.height / 2;
    const globeR = this.projection.scale();
    const margin = 80;

    interface Render {
      idx: number;
      site: FeaturedSite;
      p: [number, number];
      labelX: number;
      labelY: number;
      ux: number;
      uy: number;
      visible: boolean;
      anchor: 'start' | 'end' | 'middle';
    }

    const renders: Render[] = this.featured.map(
      (s: FeaturedSite, idx: number) => {
        const onHemisphere =
          geoDistance([s.lon, s.lat], center) < Math.PI / 2 - 0.05;
        const p = onHemisphere
          ? this.projection([s.lon, s.lat])
          : null;
        if (!p) {
          return {
            idx,
            site: s,
            p: [0, 0] as [number, number],
            labelX: 0,
            labelY: 0,
            ux: 0,
            uy: 0,
            visible: false,
            anchor: 'middle' as const,
          };
        }
        const dx = p[0] - cx;
        const dy = p[1] - cy;
        const len = Math.hypot(dx, dy);
        const ux = len > 1 ? dx / len : 0;
        const uy = len > 1 ? dy / len : -1;
        const labelDist = globeR + 26;
        let labelX = cx + ux * labelDist;
        let labelY = cy + uy * labelDist;
        labelX = Math.max(margin, Math.min(this.width - margin, labelX));
        labelY = Math.max(20, Math.min(this.height - 20, labelY));
        const anchor: 'start' | 'end' | 'middle' =
          ux > 0.08 ? 'start' : ux < -0.08 ? 'end' : 'middle';
        return { idx, site: s, p, labelX, labelY, ux, uy, visible: true, anchor };
      },
    );

    // Greedy non-overlap label thinning: pick at most one label per ~20px
    // screen-space neighborhood so a tight cluster of featured sites doesn't
    // produce a wall of overlapping leader lines.
    const minLabelDist = 20;
    const labeledIdx = new Set<number>();
    const placed: { x: number; y: number }[] = [];
    for (const r of renders) {
      if (!r.visible || !r.site.name) continue;
      const tooClose = placed.some(
        (q) => Math.hypot(q.x - r.labelX, q.y - r.labelY) < minLabelDist,
      );
      if (tooClose) continue;
      labeledIdx.add(r.idx);
      placed.push({ x: r.labelX, y: r.labelY });
    }

    const dotSel = svg
      .select('g.featured-dots')
      .selectAll<SVGCircleElement, Render>('circle')
      .data(renders, (d: any) => d.idx);
    dotSel
      .enter()
      .append('circle')
      .attr('class', 'featured-dot')
      .merge(dotSel as any)
      .attr('cx', (d: any) => d.p[0])
      .attr('cy', (d: any) => d.p[1])
      .attr('r', 2.6)
      .attr('display', (d: any) => (d.visible ? null : 'none'));

    const leaderSel = svg
      .select('g.featured-leaders')
      .selectAll<SVGLineElement, Render>('line')
      .data(renders, (d: any) => d.idx);
    leaderSel
      .enter()
      .append('line')
      .attr('class', 'leader-line')
      .merge(leaderSel as any)
      .attr('x1', (d: any) => d.p[0])
      .attr('y1', (d: any) => d.p[1])
      .attr('x2', (d: any) => d.labelX - d.ux * 4)
      .attr('y2', (d: any) => d.labelY - d.uy * 4)
      .attr('display', (d: any) => (labeledIdx.has(d.idx) ? null : 'none'));

    const labelSel = svg
      .select('g.featured-labels')
      .selectAll<SVGTextElement, Render>('text')
      .data(renders, (d: any) => d.idx);
    labelSel
      .enter()
      .append('text')
      .attr('class', 'label-text')
      .merge(labelSel as any)
      .attr('x', (d: any) => d.labelX)
      .attr('y', (d: any) => d.labelY)
      .attr('text-anchor', (d: any) => d.anchor)
      .attr('dominant-baseline', 'middle')
      .text((d: any) => (labeledIdx.has(d.idx) ? d.site.name : ''))
      .attr('display', (d: any) => (labeledIdx.has(d.idx) ? null : 'none'));
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
    const eligible = this.featured
      .map((s: FeaturedSite) => {
        if (s.labelOnly) return null;
        if (geoDistance([s.lon, s.lat], center) >= Math.PI / 2 - 0.25) {
          return null;
        }
        const p = this.projection([s.lon, s.lat]);
        if (!p || !this.outsideCardRect(p)) return null;
        return { site: s, p };
      })
      .filter(
        (x: { site: FeaturedSite; p: [number, number] } | null) => x !== null,
      ) as { site: FeaturedSite; p: [number, number] }[];
    if (!eligible.length) {
      this.scheduleCutaway(1500);
      return;
    }
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    const site = pick.site;
    const p = pick.p;

    const tiles = this.cutawayTileGrid(site.lat, site.lon, 18);
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

    // 2×2 tile grid, positioned so the actual lat/lon lands at (p[0], p[1])
    // — so the cutaway center is the panel, not just the tile that contains it.
    for (const t of tiles) {
      cutaway
        .append('image')
        .attr('class', 'cutaway-img')
        .attr('href', t.url)
        .attr('data-dx', t.dx)
        .attr('data-dy', t.dy)
        .attr('x', p[0] - this.cutawayCompX + t.dx * 256)
        .attr('y', p[1] - this.cutawayCompY + t.dy * 256)
        .attr('width', 256)
        .attr('height', 256)
        .attr('clip-path', 'url(#cutaway-clip)')
        .attr('opacity', 0.9);
    }
    cutaway
      .append('circle')
      .attr('class', 'cutaway-ring')
      .attr('cx', p[0])
      .attr('cy', p[1])
      .attr('r', 0);

    this.cutawayActive = true;
    this.cutawayStartMs = performance.now();
    this.cutawaySite = site;
  }

  private drawCutaway(now: number) {
    const elapsed = now - this.cutawayStartMs;
    const inDur = 600;
    const hold = 1800;
    const outDur = 600;
    const total = inDur + hold + outDur;
    if (elapsed >= total || !this.cutawaySite) {
      this.endCutaway();
      return;
    }

    // Track the site as the globe rotates: re-project each frame.
    const center: [number, number] = [-this.rotation[0], -this.rotation[1]];
    const offHemisphere =
      geoDistance(
        [this.cutawaySite.lon, this.cutawaySite.lat],
        center,
      ) >= Math.PI / 2 - 0.05;
    if (offHemisphere) {
      this.endCutaway();
      return;
    }
    const p = this.projection([this.cutawaySite.lon, this.cutawaySite.lat]);
    if (!p) {
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
      .attr('cx', p[0])
      .attr('cy', p[1])
      .attr('r', r);
    const compX = this.cutawayCompX;
    const compY = this.cutawayCompY;
    svg
      .selectAll<SVGImageElement, unknown>('image.cutaway-img')
      .attr('x', function () {
        const dx = +(this.getAttribute('data-dx') || 0);
        return p[0] - compX + dx * 256;
      })
      .attr('y', function () {
        const dy = +(this.getAttribute('data-dy') || 0);
        return p[1] - compY + dy * 256;
      });
    svg
      .select<SVGCircleElement>('circle.cutaway-ring')
      .attr('cx', p[0])
      .attr('cy', p[1])
      .attr('r', r);
  }

  private endCutaway() {
    this.cutawayActive = false;
    this.cutawaySite = null;
    const svg = select(this.svgRef.nativeElement);
    svg.select('g.cutaway').selectAll('*').remove();
    svg.select('defs').selectAll('#cutaway-clip').remove();
    this.scheduleCutaway(3000);
  }

  // Composite-image pixel coords of the cutaway-site lat/lon, set by
  // cutawayTileGrid() and used to keep the imagery centered on the coord
  // as the globe rotates.
  private cutawayCompX = 0;
  private cutawayCompY = 0;

  private cutawayTileGrid(
    lat: number,
    lon: number,
    zoom: number,
  ): { url: string; dx: number; dy: number }[] {
    const n = Math.pow(2, zoom);
    const xFrac = ((lon + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const yFrac =
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      n;
    const tileX = Math.floor(xFrac);
    const tileY = Math.floor(yFrac);
    const pxX = (xFrac - tileX) * 256;
    const pxY = (yFrac - tileY) * 256;
    // Pick the 2×2 grid such that the coord is in the central 256×256 region —
    // guarantees the 70px-radius cutaway is fully covered by imagery.
    const startTileX = pxX < 128 ? tileX - 1 : tileX;
    const startTileY = pxY < 128 ? tileY - 1 : tileY;
    this.cutawayCompX = (tileX - startTileX) * 256 + pxX;
    this.cutawayCompY = (tileY - startTileY) * 256 + pxY;
    const out: { url: string; dx: number; dy: number }[] = [];
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        out.push({
          url: `https://mt1.google.com/vt/lyrs=s&x=${startTileX + dx}&y=${startTileY + dy}&z=${zoom}`,
          dx,
          dy,
        });
      }
    }
    return out;
  }

  private outsideCardRect(p: [number, number]): boolean {
    // Only enforce horizontal exclusion. Vertical exclusion was too aggressive
    // when featured sites cluster at one latitude (e.g. OMC at ~27°N projects
    // to a fixed y above card center, never escaping the vertical band).
    const halfW = this.cardWidth / 2 + this.cutawayMaxR + this.cardPadding;
    const cx = this.width / 2;
    return Math.abs(p[0] - cx) > halfW;
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
