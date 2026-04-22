import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  SatellitePreview,
  satellitePreview,
} from '../../view/map/map.component';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-sat-preview',
  template: `
    <div
      *ngIf="preview"
      class="sat-preview"
      [style.top.px]="y"
      [style.left.px]="x"
    >
      <div class="sat-preview__label">{{ label }}</div>
      <div class="sat-preview__tiles">
        <div
          [style.left.px]="preview.offsetX"
          [style.top.px]="preview.offsetY"
          style="position:absolute"
        >
          <img
            *ngFor="let t of preview.tiles"
            [src]="t.url"
            width="256"
            height="256"
            style="position:absolute"
            [style.left.px]="t.left"
            [style.top.px]="t.top"
            alt=""
          />
        </div>
      </div>
      <div class="sat-preview__date" *ngIf="satDate">🛰 {{ satDate }}</div>
    </div>
  `,
  styles: [
    `
      .sat-preview {
        position: fixed;
        z-index: 10000;
        background: #1e293b;
        border-radius: 6px;
        padding: 6px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        pointer-events: none;
        color: #fff;
      }
      .sat-preview__label {
        font-size: 11px;
        font-weight: 600;
        text-align: center;
        margin-bottom: 4px;
      }
      .sat-preview__tiles {
        width: 256px;
        height: 256px;
        overflow: hidden;
        position: relative;
        border-radius: 4px;
      }
      .sat-preview__tiles img {
        display: block;
      }
      .sat-preview__date {
        font-size: 10px;
        color: #94a3b8;
        text-align: center;
        margin-top: 4px;
      }
    `,
  ],
})
export class SatellitePreviewComponent implements OnChanges {
  @Input() lat: number | null = null;
  @Input() lng: number | null = null;
  @Input() label = '';
  @Input() x = 0;
  @Input() y = 0;

  preview: SatellitePreview | null = null;
  satDate = '';

  constructor(private http: HttpClient) {}

  private prevLat: number | null = null;
  private prevLng: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.lat == null || this.lng == null) {
      this.preview = null;
      this.satDate = '';
      this.prevLat = null;
      this.prevLng = null;
      return;
    }
    // Only refetch tiles & date when coordinates change, not on x/y moves
    if (this.lat === this.prevLat && this.lng === this.prevLng) return;
    this.prevLat = this.lat;
    this.prevLng = this.lng;
    this.preview = satellitePreview(this.lat, this.lng, 19);
    this.satDate = '';
    this.http
      .get<{ date: string | null }>(
        `${environment.API_URL}device-reviews/satellite-date`,
        {
          params: {
            lat: this.lat.toString(),
            lng: this.lng.toString(),
          },
        },
      )
      .subscribe({
        next: (res) => {
          if (res.date) {
            const d = new Date(res.date);
            this.satDate = d.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
          }
        },
      });
  }

  /**
   * Utility to create a DOM overlay for use on Leaflet maps.
   * Returns the element so callers can position/remove it.
   */
  static createOverlay(
    label: string,
    lat: number,
    lng: number,
    http: HttpClient,
  ): HTMLElement {
    const sp = satellitePreview(lat, lng, 19);
    const tilesHtml = sp.tiles
      .map(
        (t) =>
          `<img src="${t.url}" width="256" height="256" style="position:absolute;left:${t.left}px;top:${t.top}px" />`,
      )
      .join('');

    const el = document.createElement('div');
    el.className = 'sat-pin-overlay';
    el.style.cssText =
      'position:fixed;z-index:10000;pointer-events:none;background:#1e293b;border-radius:6px;padding:6px;box-shadow:0 4px 12px rgba(0,0,0,0.4);color:#fff;';
    el.innerHTML = `<div style="text-align:center">
      <div style="font-size:11px;font-weight:600;margin-bottom:4px">${label}</div>
      <div style="width:256px;height:256px;overflow:hidden;position:relative;border-radius:4px">
        <div style="position:absolute;left:${sp.offsetX}px;top:${sp.offsetY}px">${tilesHtml}</div>
      </div>
      <div class="sat-pin-date" style="font-size:10px;color:#94a3b8;margin-top:4px;text-align:center"></div>
    </div>`;

    document.body.appendChild(el);

    http
      .get<{
        date: string | null;
      }>(`${environment.API_URL}device-reviews/satellite-date`, {
        params: { lat: lat.toString(), lng: lng.toString() },
      })
      .subscribe({
        next: (res) => {
          if (res.date) {
            const d = new Date(res.date);
            const dateEl = el.querySelector('.sat-pin-date');
            if (dateEl)
              dateEl.textContent =
                '\u{1F6F0} ' +
                d.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });
          }
        },
      });

    return el;
  }

  /**
   * Position a pin overlay relative to a Leaflet map.
   */
  static positionOverlay(
    el: HTMLElement,
    map: L.Map,
    lat: number,
    lng: number,
  ): void {
    const mapRect = map.getContainer().getBoundingClientRect();
    const px = map.latLngToContainerPoint([lat, lng]);
    const screenX = mapRect.left + px.x;
    const screenY = mapRect.top + px.y;
    const boxW = 270;
    const boxH = 310;
    const gap = 16;
    const rightFits = screenX + gap + boxW < window.innerWidth;
    el.style.left = (rightFits ? screenX + gap : screenX - gap - boxW) + 'px';
    el.style.top =
      Math.min(Math.max(screenY - boxH / 2, 4), window.innerHeight - boxH - 4) +
      'px';
  }
}
