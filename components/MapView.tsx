
import React, { useEffect, useRef, useState } from 'react';
import { CustomerInfo } from './EstimatePDF';

// Declare google for TypeScript
declare global {
  interface Window {
    google: any;
  }
}

interface MapViewProps {
  customers: CustomerInfo[];
  onUpdateCustomer: (customer: CustomerInfo) => void;
}

const MapView: React.FC<MapViewProps> = ({ customers, onUpdateCustomer }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any | null>(null);
  const [infoWindow, setInfoWindow] = useState<any | null>(null);
  const markersRef = useRef<Map<number, any>>(new Map());

  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) return;

      try {
        const { Map } = await window.google.maps.importLibrary("maps");
        
        const mapInstance = new Map(mapRef.current as HTMLDivElement, {
          center: { lat: 39.8283, lng: -98.5795 }, // Center of US
          zoom: 4,
          mapId: 'FOAM_CRM_MAP', // Required for advanced markers
        });
        setMap(mapInstance);
        
        const infoWindowInstance = new window.google.maps.InfoWindow();
        setInfoWindow(infoWindowInstance);

      } catch (e) {
        console.error("Error loading Google Maps", e);
      }
    };

    if (window.google) {
        initMap();
    }
  }, []);

  useEffect(() => {
    if (!map) return;

    const geocodeAddress = async (customer: CustomerInfo) => {
      try {
        const { Geocoder } = await window.google.maps.importLibrary("geocoding");
        const geocoder = new Geocoder();
        geocoder.geocode({ address: customer.address }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]) {
            const location = results[0].geometry.location;
            const lat = location.lat();
            const lng = location.lng();
            onUpdateCustomer({ ...customer, lat, lng });
          } else {
            console.warn(`Geocode was not successful for the following reason: ${status} for address: ${customer.address}`);
          }
        });
      } catch (e) {
        console.error("Geocoding error", e);
      }
    };

    const placeMarkers = async () => {
        if (!map || !infoWindow) return;

        const { AdvancedMarkerElement } = await window.google.maps.importLibrary("marker");
        const bounds = new window.google.maps.LatLngBounds();
        let locationsFound = 0;
        
        const currentCustomerIds = new Set(customers.map(c => c.id));
        
        // Remove markers for deleted customers
        markersRef.current.forEach((marker, customerId) => {
            if (!currentCustomerIds.has(customerId)) {
                (marker as any).map = null; // AdvancedMarkerElement uses .map
                markersRef.current.delete(customerId);
            }
        });

        for (const customer of customers) {
          if (customer.lat && customer.lng) {
            const position = { lat: customer.lat, lng: customer.lng };
            locationsFound++;
            bounds.extend(position);

            if (!markersRef.current.has(customer.id)) {
                const marker = new AdvancedMarkerElement({
                  map,
                  position,
                  title: customer.name,
                });

                marker.addListener('click', () => {
                  const content = `
                    <div class="font-sans p-1">
                      <h3 class="font-bold text-base text-slate-800">${customer.name}</h3>
                      <p class="text-sm text-slate-600">${customer.address}</p>
                      <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customer.address)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline text-sm font-semibold">Get Directions</a>
                    </div>
                  `;
                  infoWindow.setContent(content);
                  infoWindow.open(map, marker);
                });
                
                markersRef.current.set(customer.id, marker as any);
            }
            
          } else if (customer.address) {
            // Geocode if lat/lng are missing
            geocodeAddress(customer);
          }
        }

        if (locationsFound > 0) {
          if (locationsFound === 1) {
              map.setCenter(bounds.getCenter());
              map.setZoom(14);
          } else {
              map.fitBounds(bounds);
          }
        }
    };

    placeMarkers();

  }, [customers, map, onUpdateCustomer, infoWindow]);

  return <div ref={mapRef} className="w-full h-full" />;
};

export default MapView;
