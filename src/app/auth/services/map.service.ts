import { Injectable } from '@angular/core';
import * as L from 'leaflet';
import { MapMarker } from '../../view/map/map.component';

@Injectable({
  providedIn: 'root',
})
export class MapService {
  createCustomIcon(): L.Icon {
    return L.icon({
      iconUrl: 'assets/images/map-location.svg',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  }

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

  addMarkers(
    map: L.Map,
    markers: MapMarker[],
    markerGroup: L.FeatureGroup,
  ): void {
    markerGroup.clearLayers();

    if (!markers || !Array.isArray(markers) || markers.length === 0) {
      return;
    }

    const customIcon = this.createCustomIcon();

    markers.forEach((markerData: MapMarker) => {
      const { latitude, longitude, title } = markerData;

      if (isNaN(latitude) || isNaN(longitude)) {
        return;
      }

      const marker = L.marker([latitude, longitude], {
        title,
        icon: customIcon,
      });

      markerGroup.addLayer(marker);
    });

    this.fitToBounds(map, markers);
  }

  fitToBounds(map: L.Map, markers: MapMarker[]): void {
    const validCoordinates = markers
      .filter((m) => !isNaN(m.latitude) && !isNaN(m.longitude))
      .map((m) => [m.latitude, m.longitude] as L.LatLngTuple);

    if (validCoordinates.length > 0) {
      const bounds = L.latLngBounds(validCoordinates);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView([20, 0], 2); // default world view
    }
  }
}
