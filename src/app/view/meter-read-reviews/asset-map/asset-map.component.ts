import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import * as L from 'leaflet';
import { MeterReadReviewDevice } from '../meter-read-review.model';

const STATUS_COLOR: Record<string, string> = {
  approved: '#22c55e',
  rejected: '#ef4444',
  pending: '#f59e0b',
  flagged: '#7c3aed',
};

function pinIcon(color: string): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 24 12 24S24 20.25 24 12C24 5.373 18.627 0 12 0z"
            fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" fill="#fff" fill-opacity="0.85"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
}

@Component({
  standalone: false,
  selector: 'app-mrr-asset-map',
  template: `<div #mapEl class="map-container"></div>`,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .map-container {
        width: 100%;
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MrrAssetMapComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() devices: MeterReadReviewDevice[] = [];
  @Output() pinClick = new EventEmitter<number>();
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      zoomControl: true,
      attributionControl: false,
      minZoom: 3,
      maxBounds: L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180)),
      maxBoundsViscosity: 1.0,
    }).setView([20, 0], 3);
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      { maxZoom: 17, noWrap: true },
    ).addTo(this.map);
    this.updateMarkers();

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapEl.nativeElement);
  }

  ngOnChanges(): void {
    if (this.map) this.updateMarkers();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }

  private updateMarkers(): void {
    this.markers.forEach((m) => m.remove());
    this.markers = [];

    for (const d of this.devices) {
      const lat = d.lat != null ? +d.lat : null;
      const lng = d.long != null ? +d.long : null;
      if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) continue;
      const color = STATUS_COLOR[d.reviewStatus] ?? '#6b7280';
      const fmtDate = (s: string | null) =>
        s ? new Date(s).toLocaleDateString('en-GB') : '—';
      const popup = L.popup({
        closeButton: false,
        offset: [0, -6],
      }).setContent(
        `<div style="min-width:160px;font-size:13px;line-height:1.6">` +
          `<strong style="font-size:14px">${d.projectName}</strong><br>` +
          `<span style="color:#64748b;font-size:11px">${d.externalId}</span><br>` +
          `<span style="color:${color};font-weight:600">${d.reviewStatus.charAt(0).toUpperCase() + d.reviewStatus.slice(1)}</span><br>` +
          `<span style="color:#64748b;font-size:11px">${lat.toFixed(5)}, ${lng.toFixed(5)}</span><br>` +
          `Reads: ${d.readCount} · ${d.totalKwh.toLocaleString('en-US', { maximumFractionDigits: 1 })} kWh<br>` +
          `Latest: ${fmtDate(d.latestReadDate)}` +
          `</div>`,
      );

      const marker = L.marker([lat, lng], { icon: pinIcon(color) })
        .bindPopup(popup)
        .on('mouseover', (e) => (e.target as L.Marker).openPopup())
        .on('mouseout', (e) => (e.target as L.Marker).closePopup())
        .on('click', () => this.pinClick.emit(d.deviceId))
        .addTo(this.map!);
      this.markers.push(marker);
    }
  }
}
