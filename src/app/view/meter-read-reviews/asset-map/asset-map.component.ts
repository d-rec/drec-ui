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
import { mapPinIcon } from '../../../shared/map-pin';

const STATUS_COLOR: Record<string, string> = {
  approved: '#22c55e',
  rejected: '#ef4444',
  pending: '#f59e0b',
  flagged: '#7c3aed',
};

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
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      noWrap: true,
    }).addTo(this.map);
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
          `<strong style="font-size:14px">${d.siteName}</strong><br>` +
          `<span style="color:#64748b;font-size:11px">${d.externalId}</span><br>` +
          `<span style="color:${color};font-weight:600">${d.reviewStatus.charAt(0).toUpperCase() + d.reviewStatus.slice(1)}</span><br>` +
          `<span style="color:#64748b;font-size:11px">${lat.toFixed(5)}, ${lng.toFixed(5)}</span><br>` +
          `Reads: ${d.readCount} · ${d.totalKwh.toLocaleString('en-US', { maximumFractionDigits: 1 })} kWh<br>` +
          `Latest: ${fmtDate(d.latestReadDate)}` +
          `</div>`,
      );

      const marker = L.marker([lat, lng], { icon: mapPinIcon(color) })
        .bindPopup(popup)
        .on('mouseover', (e) => (e.target as L.Marker).openPopup())
        .on('mouseout', (e) => (e.target as L.Marker).closePopup())
        .on('click', () => this.pinClick.emit(d.deviceId))
        .addTo(this.map!);
      this.markers.push(marker);
    }
  }
}
