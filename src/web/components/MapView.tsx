import React, { useRef, useEffect, useState } from 'react';
import { Investment } from '../../types';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import DateRangeFilter from './DateRangeFilter';

// Set Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoiY2hyaXN0b3Nwb3Jpb3MiLCJhIjoiY204MXJpejN0MDRzbzJrcXZzbXRzbDdoYiJ9.kEGfS3xl4_kqFEEkQrxGNA';

interface MapViewProps {
    investments: Investment[];
}

const MapView: React.FC<MapViewProps> = ({ investments }) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const [loading, setLoading] = useState(true);
    const [filteredInvestments, setFilteredInvestments] = useState<Investment[]>(investments);

    // Filter investments that have valid coordinates
    const geolocatedInvestments = filteredInvestments.filter(investment =>
        investment.locations &&
        investment.locations.some(loc => loc.lat && loc.lon)
    );

    // Calculate total investment amount
    const totalAmount = geolocatedInvestments.reduce(
        (sum, inv) => sum + (inv.totalAmount || 0), 0
    );

    // Format amount as billions or millions
    const formatLargeAmount = (amount: number): string => {
        if (amount >= 1000000000) {
            return `${(amount / 1000000000).toFixed(1)} δις`;
        } else {
            return `${(amount / 1000000).toFixed(0)} εκ.`;
        }
    };

    // Handle date filter change
    const handleDateFilterChange = (startDate: string, endDate: string) => {
        const filtered = investments.filter(inv => {
            if (!inv.dateApproved) return false;
            const investmentDate = new Date(inv.dateApproved);
            const start = new Date(startDate);
            const end = new Date(endDate);
            return investmentDate >= start && investmentDate <= end;
        });

        setFilteredInvestments(filtered);
    };

    // Create custom marker element
    const createMarkerElement = (investment: Investment, amount: number) => {
        // Determine size based on investment amount (logarithmic scale)
        const size = Math.max(35, Math.min(80, 25 + Math.log10(amount / 1000000) * 15));

        // Create the marker element
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.borderRadius = '50%';
        el.style.background = 'rgba(67, 56, 202, 0.8)';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
        el.style.color = 'white';
        el.style.textAlign = 'center';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontWeight = 'bold';
        el.style.fontSize = `${Math.max(10, Math.min(16, Math.log10(amount / 1000000) * 5 + 10))}px`;
        el.style.cursor = 'pointer';

        // Format the amount (in millions/billions)
        let formattedAmount: string;
        if (amount >= 1000000000) {
            formattedAmount = `${(amount / 1000000000).toFixed(1)}B`;
        } else {
            formattedAmount = `${(amount / 1000000).toFixed(0)}M`;
        }

        el.innerHTML = formattedAmount;

        return el;
    };

    // Add markers to map
    const addMarkersToMap = () => {
        if (!map.current) return;

        // Clear previous markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        // Add new markers
        geolocatedInvestments.forEach(investment => {
            investment.locations.forEach(location => {
                if (location.lat && location.lon) {
                    // Create a permalink to the investment details in the table view with proper URL encoding
                    const ada = investment.reference?.diavgeiaADA || '';
                    const investmentLink = `#/table/investment/${encodeURIComponent(ada)}`;

                    // Create a popup with investment info and a permalink button
                    const popup = new mapboxgl.Popup({ offset: 0 }).setHTML(`
                        <div class="p-3">
                            <h3 class="font-bold text-base mb-1">${investment.name}</h3>
                            <p class="text-sm">${location.description}</p>
                            <div class="mt-3 pt-2 border-t border-gray-200 flex justify-between">
                                <span class="text-sm font-semibold">€${investment.totalAmount?.toLocaleString('el-GR') || 'N/A'}</span>
                                <span class="text-xs text-gray-500">${investment.dateApproved || 'N/A'}</span>
                            </div>
                            <div class="mt-2 text-center">
                                <a 
                                    href="${investmentLink}" 
                                    class="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3">
                                        <path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3"></path>
                                        <line x1="8" y1="12" x2="16" y2="12"></line>
                                    </svg>
                                    Δείτε λεπτομέρειες
                                </a>
                            </div>
                        </div>
                    `);

                    // Create a custom marker
                    const marker = new mapboxgl.Marker({
                        element: createMarkerElement(investment, investment.totalAmount || 0),
                        anchor: 'center'
                    })
                        .setLngLat([location.lon, location.lat])
                        .setPopup(popup)
                        .addTo(map.current!);

                    markersRef.current.push(marker);
                }
            });
        });

        // Fit map to markers if there are any
        if (markersRef.current.length > 0) {
            const bounds = new mapboxgl.LngLatBounds();

            geolocatedInvestments.forEach(investment => {
                investment.locations.forEach(location => {
                    if (location.lat && location.lon) {
                        bounds.extend([location.lon, location.lat]);
                    }
                });
            });

            map.current.fitBounds(bounds, {
                padding: 50,
                maxZoom: 12
            });
        }
    };

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/light-v11',
            center: [23.7275, 37.9838], // Athens coordinates as default center
            zoom: 6,
            attributionControl: false
        });

        // Add attribution only (removed navigation controls)
        map.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

        // Setup map
        map.current.on('load', () => {
            setLoading(false);
            addMarkersToMap();
        });

        // Cleanup function
        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []);

    // Update markers when filtered investments change
    useEffect(() => {
        addMarkersToMap();
    }, [filteredInvestments]);

    return (
        <div className="relative w-full h-full">
            {/* Map container */}
            <div ref={mapContainer} className="w-full h-full absolute inset-0 z-0"></div>

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 z-20">
                    <div className="text-center">
                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Φόρτωση χάρτη...</p>
                    </div>
                </div>
            )}

            {/* Combined info panel and date filter */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10 w-full max-w-xl px-4">
                <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md overflow-hidden">
                    {/* Info section */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/50">
                        <div className="flex items-center space-x-3">
                            <div className="text-indigo-600 font-semibold">{geolocatedInvestments.length} επενδύσεις</div>
                            <div className="h-4 w-px bg-gray-300"></div>
                            <div className="text-sm">€{formatLargeAmount(totalAmount)}</div>
                        </div>
                        <div className="text-xs text-gray-500">από σύνολο {investments.length}</div>
                    </div>

                    {/* Date filter section */}
                    <div className="px-4 py-3">
                        <DateRangeFilter
                            investments={investments}
                            onFilterChange={handleDateFilterChange}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MapView; 