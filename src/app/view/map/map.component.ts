import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';

export interface MapMarker {
  latitude: number;
  longitude: number;
  externalId?: string;
}

@Component({
  standalone: false,
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
})
export class MapComponent implements OnInit {
  @Input() markers: MapMarker[] = [];
  @Input() zoom: number = 2;
  @Input() satellite = false;
  @Output() markerClicked = new EventEmitter();

  @ViewChild('overlayCanvas') overlayCanvas!: ElementRef<HTMLCanvasElement>;

  options: L.MapOptions = {
    layers: [],
    zoom: 3,
    center: L.latLng(20, 0),
    scrollWheelZoom: false,
    attributionControl: false,
    maxBounds: L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180)),
    maxBoundsViscosity: 1.0,
  };

  map!: L.Map;
  markerGroup = L.featureGroup();
  isMapInitialized = false;

  // Panel detection state
  detecting = false;
  showOverlay = false;
  showDetectConfirm = false;
  panelCount = 0;
  detectError = '';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.options.layers = [this.satellite ? this.createSatelliteLayer() : this.createTileLayer()];
  }

  onMapReady(map: L.Map): void {
    this.map = map;
    this.markerGroup.addTo(this.map);
    this.isMapInitialized = true;

    this.update();
  }

  ngOnChanges(): void {
    if (this.isMapInitialized) {
      this.update();
    }
  }

  update(): void {
    this.addMarkers();
  }

  // --- Panel detection ---

  detectPanels(): void {
    if (!this.map || this.detecting) return;
    this.showDetectConfirm = true;
  }

  confirmDetect(): void {
    this.showDetectConfirm = false;
    this.detecting = true;
    this.detectError = '';
    setTimeout(() => this.captureAndDetect(), 500);
  }

  cancelDetect(): void {
    this.showDetectConfirm = false;
  }

  clearOverlay(): void {
    this.showOverlay = false;
    this.panelCount = 0;
    this.detectError = '';
    if (this.overlayCanvas) {
      const canvas = this.overlayCanvas.nativeElement;
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  private captureAndDetect(): void {
    const mapEl = this.map.getContainer();
    const w = mapEl.offsetWidth;
    const h = mapEl.offsetHeight;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = w;
    srcCanvas.height = h;
    const srcCtx = srcCanvas.getContext('2d')!;

    const tilePane = mapEl.querySelector('.leaflet-tile-pane') as HTMLElement;
    if (!tilePane) {
      this.detecting = false;
      this.detectError = 'Could not capture map';
      return;
    }

    const mapRect = mapEl.getBoundingClientRect();
    const imgs = tilePane.querySelectorAll('img');
    for (const img of Array.from(imgs)) {
      const rect = img.getBoundingClientRect();
      const x = rect.left - mapRect.left;
      const y = rect.top - mapRect.top;
      try {
        srcCtx.drawImage(img, x, y, rect.width, rect.height);
      } catch {
        // CORS — skip tile
      }
    }

    const cropFraction = 0.7;
    const cropW = Math.round(w * cropFraction);
    const cropH = Math.round(h * cropFraction);
    const cropX = Math.round((w - cropW) / 2);
    const cropY = Math.round((h - cropH) / 2);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    cropCanvas.getContext('2d')!.drawImage(
      srcCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH,
    );

    const base64 = cropCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    this.http.post<any>(
      `${environment.API_URL}device-reviews/detect-panels`,
      { image: base64 },
    ).subscribe({
      next: (data) => this.drawDetections(data, w, h, cropX, cropY, cropW, cropH),
      error: (err) => {
        this.detectError =
          'Detection failed: ' + (err?.error?.message || err?.message || err);
        this.detecting = false;
      },
    });
  }

  private drawDetections(
    data: any, w: number, h: number,
    cropX: number, cropY: number, cropW: number, cropH: number,
  ): void {
    const canvas = this.overlayCanvas.nativeElement;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);

    const outputs = data?.outputs?.[0];
    const predictions = outputs?.predictions?.predictions ?? [];

    const imgW = outputs?.predictions?.image?.width ?? cropW;
    const imgH = outputs?.predictions?.image?.height ?? cropH;
    const scaleX = cropW / imgW;
    const scaleY = cropH / imgH;

    this.panelCount = predictions.length;

    for (const pred of predictions) {
      const points: { x: number; y: number }[] = pred.points ?? [];

      if (points.length > 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x * scaleX + cropX, points[0].y * scaleY + cropY);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x * scaleX + cropX, points[i].y * scaleY + cropY);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 255, 180, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#00ffb4';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        const bx = (pred.x - pred.width / 2) * scaleX + cropX;
        const by = (pred.y - pred.height / 2) * scaleY + cropY;
        const bw = pred.width * scaleX;
        const bh = pred.height * scaleY;
        ctx.fillStyle = 'rgba(0, 255, 180, 0.3)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#00ffb4';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);
      }

      if (pred.confidence) {
        const cx = (pred.x - pred.width / 2) * scaleX + cropX;
        const cy = (pred.y - pred.height / 2) * scaleY + cropY - 4;
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const label = `${Math.round(pred.confidence * 100)}%`;
        const tw = ctx.measureText(label).width;
        ctx.fillRect(cx, cy - 12, tw + 6, 15);
        ctx.fillStyle = '#00ffb4';
        ctx.fillText(label, cx + 3, cy);
      }
    }

    this.showOverlay = true;
    this.detecting = false;
  }

  // --- Tile layers ---

  private createCustomIcon(): L.Icon {
    return L.icon({
      iconUrl: 'assets/images/map-location.svg',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  }

  private createTileLayer(): L.TileLayer {
    return L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      {
        minZoom: 3,
        maxZoom: 17,
        noWrap: true,
        attribution:
          '&copy; <a href="https://carto.com/">carto.com</a> contributors',
      },
    );
  }

  private createSatelliteLayer(): L.TileLayer {
    return L.tileLayer(
      'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      {
        minZoom: 3,
        maxZoom: 21,
        noWrap: true,
        attribution: '&copy; Google',
        crossOrigin: 'anonymous',
      } as L.TileLayerOptions,
    );
  }

  // --- Markers ---

  private addMarkers(): void {
    this.markerGroup.clearLayers();

    if (
      !this.markers ||
      !Array.isArray(this.markers) ||
      this.markers.length === 0
    ) {
      return;
    }

    const customIcon = this.createCustomIcon();

    this.markers.forEach((markerData: MapMarker) => {
      const { latitude, longitude, externalId } = markerData;

      if (isNaN(latitude) || isNaN(longitude)) {
        return;
      }

      const marker = L.marker([latitude, longitude], {
        title: externalId,
        icon: customIcon,
      });

      marker.on('click', () => {
        const deviceData = {
          externalId,
        };
        this.markerClicked.emit(deviceData);
      });

      this.markerGroup.addLayer(marker);
    });

    this.fitToBounds();
  }

  private fitToBounds(): void {
    const validCoordinates = this.markers
      .filter((m) => !isNaN(m.latitude) && !isNaN(m.longitude))
      .map((m) => [m.latitude, m.longitude] as L.LatLngTuple);

    if (validCoordinates.length > 0) {
      if (validCoordinates.length === 1) {
        const position = L.latLng(
          validCoordinates[0][0],
          validCoordinates[0][1],
        );
        this.map.setView(position, this.zoom, { animate: false });
      } else {
        const bounds = L.latLngBounds(validCoordinates);
        this.map.fitBounds(bounds, { padding: [50, 50], animate: false });
      }
    } else {
      this.map.setView([20, 0], this.zoom, { animate: false });
    }
  }
}
