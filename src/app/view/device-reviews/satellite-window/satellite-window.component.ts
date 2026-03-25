import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';
import { AssetService } from '../asset.service';

const STATUS_COLOR: Record<string, string> = {
  approved: '#22c55e',
  rejected: '#ef4444',
  pending: '#f59e0b',
  legacy: '#a0845c',
};

@Component({
  standalone: false,
  selector: 'app-ds-satellite-window',
  template: `
    <app-ds-floating-window
      title="🛰 Satellite Map"
      [initX]="600"
      [initY]="390"
      [initWidth]="560"
      [initHeight]="360"
      [zIndex]="zIndex"
      (bringToFront)="bringToFront.emit()"
      (close)="close.emit()"
    >
      <div #mapEl style="width:100%;height:100%"></div>
    </app-ds-floating-window>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SatelliteWindowComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() zIndex = 150;
  @Output() bringToFront = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private sub: Subscription | null = null;

  constructor(readonly svc: AssetService) {}

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, {
      zoomControl: true,
      attributionControl: false,
      maxZoom: 19,
    }).setView([20, 0], 2);

    L.tileLayer(
      'https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 21,
      },
    ).addTo(this.map);

    this.updateMarkers();

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapEl.nativeElement);

    this.sub = this.svc.flyTo$.subscribe(({ lat, lng }) => {
      this.map?.setView([lat, lng], this.map.getMaxZoom(), { animate: false });
    });
  }

  ngOnChanges(): void {
    if (this.map) this.updateMarkers();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.sub?.unsubscribe();
    this.map?.remove();
  }

  private updateMarkers(): void {
    this.markers.forEach((m) => m.remove());
    this.markers = [];

    for (const asset of this.svc.assets$.value) {
      if (asset.lat === null || asset.long === null) continue;
      const color = STATUS_COLOR[asset.status] ?? '#6b7280';
      const fmt = (d: Date | null) => (d ? d.toLocaleDateString() : '—');

      const popup = L.popup({ closeButton: false, offset: [0, -6] }).setContent(
        `<div style="min-width:160px;font-size:13px;line-height:1.6">` +
          `<strong style="font-size:14px">${asset.projectName}</strong><br>` +
          `<span style="color:#64748b;font-size:11px">${asset.serial}</span><br>` +
          `<span style="color:${color};font-weight:600">${asset.status.charAt(0).toUpperCase() + asset.status.slice(1)}</span><br>` +
          `<span style="color:#64748b;font-size:11px">${asset.lat.toFixed(5)}, ${asset.long.toFixed(5)}</span><br>` +
          (asset.reviewer ? `Reviewer: ${asset.reviewer}<br>` : '') +
          `Added: ${fmt(asset.dateAdded)}<br>` +
          (asset.dateSubmitted
            ? `Submitted: ${fmt(asset.dateSubmitted)}<br>`
            : '') +
          (asset.notes
            ? `<em style="color:#64748b;font-size:12px">${asset.notes}</em>`
            : '') +
          `</div>`,
      );

      const icon = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
      });
      const marker = L.marker([asset.lat, asset.long], { icon })
        .bindPopup(popup)
        .on('mouseover', (e) => (e.target as L.Marker).openPopup())
        .on('mouseout', (e) => (e.target as L.Marker).closePopup())
        .addTo(this.map!);

      this.markers.push(marker);
    }
  }
}
