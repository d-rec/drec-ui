import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { Device } from '../../models/device.model';

@Injectable({
  providedIn: 'root',
})
export class MapDevicesService {
  // Create custom icon for map markers
  createCustomIcon(): L.Icon {
    return L.icon({
      iconUrl: 'assets/images/map-location.svg',
      iconSize: [32, 32], // Size of the icon
      iconAnchor: [16, 32], // Point of the icon which corresponds to marker's location
      popupAnchor: [0, -32], // Point from which the popup should open relative to the iconAnchor
    });
  }

  // Create map tile layer
  createTileLayer(): L.TileLayer {
    return L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      {
        minZoom: 3,
        maxZoom: 17,
        attribution:
          '&copy; <a href="https://carto.com/">carto.com</a> contributors',
      },
    );
  }

  // Add markers to map for devices
  addDeviceMarkers(
    map: L.Map,
    devices: Device[],
    markerGroup: L.FeatureGroup,
  ): void {
    // Clear any existing markers
    markerGroup.clearLayers();

    // If no devices with valid coordinates, don't attempt to add markers
    if (!devices.length) {
      console.log('No devices with valid coordinates to display on map');
      return;
    }

    // Create custom icon
    const customIcon = this.createCustomIcon();

    // Add markers for each device
    devices.forEach((device: Device) => {
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

      markerGroup.addLayer(marker);
    });

    // Fit the map to show all markers if we have any
    this.fitMapToBounds(map, devices);
  }

  // Fit map view to include all device markers
  fitMapToBounds(map: L.Map, devices: Device[]): void {
    if (devices.length > 0) {
      try {
        const validCoordinates = devices
          .filter(
            (d) => !isNaN(Number(d.latitude)) && !isNaN(Number(d.longitude)),
          )
          .map(
            (d) => [Number(d.latitude), Number(d.longitude)] as L.LatLngTuple,
          );

        if (validCoordinates.length > 0) {
          const bounds = L.latLngBounds(validCoordinates);
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (e) {
        console.error('Error setting map bounds:', e);
        // Fall back to default view if bounds calculation fails
        map.setView([20, 0], 2);
      }
    }
  }
}
