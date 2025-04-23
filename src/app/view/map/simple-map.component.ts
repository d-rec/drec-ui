import { Component, OnInit } from '@angular/core';
import * as L from 'leaflet';
import { DeviceService } from '../../auth/services/device.service';

interface Device {
  id: string;
  externalId: string;
  latitude: number;
  longitude: number;
  organizationname?: string;
  capacity?: number;
  countryname?: string;
  deviceTypeCode?: string;
  fuelCode?: string;
  commissioningDate?: string;
}

interface DeviceResponse {
  data: Device[];
}

@Component({
  selector: 'app-simple-map',
  template: `
    <div class="map-container">
      <div
        class="map"
        leaflet
        [leafletOptions]="options"
        (leafletMapReady)="onMapReady($event)"
      ></div>
      <div *ngIf="loading" class="loading-overlay">
        <div class="spinner">Loading devices...</div>
      </div>
    </div>
  `,
  styles: [
    `
      .map-container {
        height: 400px;
        width: 100%;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
        position: relative;
      }
      .map {
        height: 100%;
        width: 100%;
      }
      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: rgba(255, 255, 255, 0.7);
        z-index: 1000;
      }
      .spinner {
        padding: 10px 15px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        border-radius: 4px;
        font-weight: bold;
      }
    `,
  ],
})
export class SimpleMapComponent implements OnInit {
  // Custom icon
  private createCustomIcon() {
    return L.icon({
      iconUrl: 'assets/images/map-location.svg',
      iconSize: [32, 32], // Size of the icon
      iconAnchor: [16, 32], // Point of the icon which corresponds to marker's location
      popupAnchor: [0, -32], // Point from which the popup should open relative to the iconAnchor
    });
  }

  // Map options
  options = {
    layers: [
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        {
          minZoom: 3,
          maxZoom: 17,
          attribution:
            '&copy; <a href="https://carto.com/">carto.com</a> contributors',
        },
      ),
    ],
    zoom: 3,
    center: L.latLng(20, 0), // Center of the world map
  };

  // Map instance
  map!: L.Map;
  devices: Device[] = [];
  markerGroup = L.featureGroup();
  loading = false;

  constructor(private deviceService: DeviceService) {}

  ngOnInit(): void {
    this.getDevices();
  }

  getDevices() {
    this.loading = true;
    this.deviceService.GetDevicesForAdmin().subscribe({
      next: (devices) => {
        this.devices = devices.devices;

        if (this.map) {
          console.log(this.devices);
          this.addMarkers();
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading devices:', err);
        this.loading = false;
        // Fall back to a default map view if API call fails
        if (this.map) {
          this.map.setView([20, 0], 2);
        }
      },
    });
  }

  onMapReady(map: L.Map): void {
    this.map = map;
    this.markerGroup.addTo(this.map);

    // If devices already loaded, add markers
    if (this.devices.length > 0) {
      this.addMarkers();
    }
  }

  addMarkers(): void {
    // Clear any existing markers
    this.markerGroup.clearLayers();

    // If no devices with valid coordinates, don't attempt to add markers
    if (!this.devices.length) {
      console.log('No devices with valid coordinates to display on map');
      return;
    }

    // Create custom icon
    const customIcon = this.createCustomIcon();

    // Add markers for each device
    this.devices.forEach((device: Device) => {
      const lat = Number(device.latitude);
      const lng = Number(device.longitude);

      // Skip invalid coordinates
      if (isNaN(lat) || isNaN(lng)) {
        return;
      }

      const marker = L.marker([lat, lng], {
        title: device.externalId,
        icon: customIcon,
      });

      // Format date if available
      let formattedDate = '';
      if (device.commissioningDate) {
        try {
          formattedDate = new Date(
            device.commissioningDate,
          ).toLocaleDateString();
        } catch (e) {
          formattedDate = device.commissioningDate;
        }
      }

      // Add popup with device info
      marker.bindPopup(`
        <div style="min-width: 200px;">
          <h3 style="margin: 0 0 8px 0; color: #333;">${device.externalId || 'Unknown Device'}</h3>
          ${device.organizationname ? `<p style="margin: 4px 0;"><strong>Organization:</strong> ${device.organizationname}</p>` : ''}
          ${device.capacity ? `<p style="margin: 4px 0;"><strong>Capacity:</strong> ${device.capacity} kW</p>` : ''}
          ${device.countryname ? `<p style="margin: 4px 0;"><strong>Country:</strong> ${device.countryname}</p>` : ''}
          ${device.deviceTypeCode ? `<p style="margin: 4px 0;"><strong>Device Type:</strong> ${device.deviceTypeCode}</p>` : ''}
          ${device.fuelCode ? `<p style="margin: 4px 0;"><strong>Fuel Code:</strong> ${device.fuelCode}</p>` : ''}
          ${formattedDate ? `<p style="margin: 4px 0;"><strong>Commissioned:</strong> ${formattedDate}</p>` : ''}
          <p style="margin: 4px 0;"><strong>Location:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
        </div>
      `);

      this.markerGroup.addLayer(marker);
    });

    // Fit the map to show all markers if we have any
    if (this.devices.length > 0) {
      try {
        const validCoordinates = this.devices
          .filter(
            (d) => !isNaN(Number(d.latitude)) && !isNaN(Number(d.longitude)),
          )
          .map(
            (d) => [Number(d.latitude), Number(d.longitude)] as L.LatLngTuple,
          );

        if (validCoordinates.length > 0) {
          const bounds = L.latLngBounds(validCoordinates);
          this.map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (e) {
        console.error('Error setting map bounds:', e);
        // Fall back to default view if bounds calculation fails
        this.map.setView([20, 0], 2);
      }
    }
  }
}
