import React, { useRef, useEffect, useState } from 'react';
import { Investment } from '../../types';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import DateRangeFilter from './DateRangeFilter';
import CategoryFilter from './CategoryFilter';
import { Category, CategoryColors, DEFAULT_CATEGORY_COLOR } from '../../types/constants.js';
import { createInvestmentLink, formatDate } from './TableUtils';

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
    const [selectedCategories, setSelectedCategories] = useState<Category[]>(Object.values(Category));
    const [showUncategorized, setShowUncategorized] = useState<boolean>(true);
    const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string } | null>(null);
    const [webGLSupported, setWebGLSupported] = useState<boolean | null>(null);

    // Apply all filters together
    const applyAllFilters = () => {
        // Start with all investments
        let filtered = [...investments];

        // Apply date filter if it exists
        if (dateRange) {
            filtered = filtered.filter(inv => {
                if (!inv.dateApproved) return false;
                const investmentDate = new Date(inv.dateApproved);
                const start = new Date(dateRange.startDate);
                const end = new Date(dateRange.endDate);
                return investmentDate >= start && investmentDate <= end;
            });
        }

        // Apply category filters
        filtered = filtered.filter(inv => {
            // If it has a category, check if that category is selected
            if (inv.category) {
                return selectedCategories.includes(inv.category);
            }
            // If it doesn't have a category, check if we're showing uncategorized
            return showUncategorized;
        });

        setFilteredInvestments(filtered);
    };

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
        setDateRange({ startDate, endDate });
    };

    // Handle category toggle
    const handleCategoryToggle = (category: Category) => {
        setSelectedCategories(prev => {
            const isSelected = prev.includes(category);

            if (isSelected) {
                // Remove the category if it's already selected
                return prev.filter(c => c !== category);
            } else {
                // Add the category if it's not already selected
                return [...prev, category];
            }
        });
    };

    // Handle uncategorized toggle
    const handleUncategorizedToggle = () => {
        setShowUncategorized(!showUncategorized);
    };

    // Get color for investment based on its category
    const getInvestmentColor = (investment: Investment): string => {
        if (!investment.category) {
            return DEFAULT_CATEGORY_COLOR;
        }

        return CategoryColors[investment.category];
    };

    // Create custom marker element
    const createMarkerElement = (investment: Investment, amount: number, locationIndex: number, totalLocations: number) => {
        // Determine size based on investment amount (logarithmic scale)
        const size = Math.max(35, Math.min(80, 25 + Math.log10(amount / 1000000) * 15));

        // Get color based on investment category
        const color = getInvestmentColor(investment);

        // Create the marker element
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.borderRadius = '50%';
        el.style.background = color;
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

        // For investments with multiple locations, add a small indicator
        let markerContent = formattedAmount;
        if (totalLocations > 1) {
            // Calculate a font size based on the marker size
            const indicatorSize = Math.max(8, Math.min(10, size / 5));

            markerContent = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                    <div style="line-height: 1;">${formattedAmount}</div>
                    <div style="font-size: ${indicatorSize}px; font-weight: normal; opacity: 0.9; margin-top: 2px; line-height: 1;">
                        ${locationIndex + 1} από ${totalLocations}
                    </div>
                </div>
            `;
        }

        el.innerHTML = markerContent;

        return el;
    };

    // Add markers to map
    const addMarkersToMap = () => {
        if (!map.current) return;

        // Clear previous markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        // Get current map state
        const currentZoom = map.current.getZoom();
        const currentBearing = map.current.getBearing();
        const currentPitch = map.current.getPitch();

        // Add new markers - adjust based on current viewport state
        const geolocatedInvestments = filteredInvestments.filter(inv =>
            inv.locations && inv.locations.some(loc => loc.lat && loc.lon)
        );

        geolocatedInvestments.forEach(investment => {
            // Count valid locations for this investment (those with lat/lon)
            const totalValidLocations = investment.locations.filter(loc => loc.lat && loc.lon).length;
            let validLocationIndex = 0;

            investment.locations.forEach(location => {
                if (location.lat && location.lon) {
                    // Create marker element
                    const totalAmount = investment.totalAmount || 0;
                    const el = createMarkerElement(investment, totalAmount, validLocationIndex, totalValidLocations);

                    // Create and add the marker with correct position
                    const marker = new mapboxgl.Marker({
                        element: el,
                        anchor: 'bottom', // Anchor point at bottom of marker
                        rotationAlignment: 'map', // Keep alignment with map rotation
                        pitchAlignment: 'map'  // Keep alignment with map pitch
                    })
                        .setLngLat([location.lon, location.lat])
                        .addTo(map.current!);

                    // Use the universal ID function to create a permalink
                    const investmentLink = createInvestmentLink(investment);

                    // Create a popup with investment info and a permalink button
                    const popup = new mapboxgl.Popup({
                        offset: 25, // Offset to account for bottom anchor
                        closeButton: true,
                        closeOnClick: false,
                        maxWidth: '300px'
                    }).setHTML(`
                        <div class="popup-container">
                            <div class="px-4 py-3 border-b border-gray-100 bg-gray-50">
                                <h3 class="font-bold text-lg text-gray-900">${investment.name}</h3>
                                <p class="text-sm text-gray-600 mt-1">${location.description || 'Τουριστικό συγκρότημα'}</p>
                                ${totalValidLocations > 1 ?
                            `<span class="inline-block px-2 py-0.5 mt-1 bg-gray-200 text-gray-700 text-xs rounded-full">
                                    Τοποθεσία ${validLocationIndex + 1} από ${totalValidLocations}
                                </span>` : ''}
                            </div>
                            
                            <div class="p-4">
                                <div class="flex justify-between items-center">
                                    <div class="text-lg font-bold text-gray-900">€${investment.totalAmount?.toLocaleString('el-GR') || 'N/A'}</div>
                                    <div class="text-sm text-gray-500">${formatDate(investment.dateApproved)}</div>
                                </div>
                                
                                ${investment.incentivesApproved && investment.incentivesApproved.length > 0 ?
                            `<div class="mt-3 pt-3 border-t border-gray-100">
                                    <div class="text-xs text-gray-500 mb-1.5">Κίνητρα</div>
                                    <div class="flex flex-wrap gap-1">
                                        ${investment.incentivesApproved.slice(0, 3).map(incentive =>
                                `<span class="inline-block px-2 py-1 bg-indigo-100 text-indigo-800 text-xs rounded-full">
                                        ${incentive.name}
                                    </span>`
                            ).join('')}
                                        ${investment.incentivesApproved.length > 3 ?
                                `<span class="inline-block px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                                        +${investment.incentivesApproved.length - 3}
                                    </span>` : ''}
                                    </div>
                                </div>` : ''}
                                
                                <div class="mt-4 pt-3 border-t border-gray-100 flex justify-center">
                                    <a 
                                        href="${investmentLink}" 
                                        class="flex items-center justify-center gap-2 px-3 py-2 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm font-medium"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                            <polyline points="15 3 21 3 21 9"></polyline>
                                            <line x1="10" y1="14" x2="21" y2="3"></line>
                                        </svg>
                                        Δείτε λεπτομέρειες
                                    </a>
                                </div>
                            </div>
                        </div>
                    `);

                    marker.setPopup(popup);

                    markersRef.current.push(marker);

                    // Increment our counter of valid locations
                    validLocationIndex++;
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

        // Check if WebGL is supported before initializing the map
        if (!mapboxgl.supported()) {
            setWebGLSupported(false);
            setLoading(false);
            return;
        }

        setWebGLSupported(true);

        // On Android, we need to give the browser a moment to calculate viewport dimensions
        setTimeout(() => {
            if (!mapContainer.current) return;

            map.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/mapbox/light-v11',
                center: [23.7275, 37.9838], // Athens coordinates as default center
                zoom: 6,
                attributionControl: false,
                failIfMajorPerformanceCaveat: false, // Allow map to render even with performance issues
                trackResize: true, // Ensure the map tracks container resizes
            });

            // Add attribution only (removed navigation controls)
            map.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

            // Setup map
            map.current.on('load', () => {
                // Force a resize to ensure the map takes correct dimensions
                if (map.current) map.current.resize();

                setLoading(false);
                addMarkersToMap();

                // Add event listeners for viewport changes that might affect marker positions
                map.current?.on('rotate', () => {
                    // Remove and re-add markers to ensure correct positioning after rotation
                    addMarkersToMap();
                });

                map.current?.on('pitch', () => {
                    // Remove and re-add markers to ensure correct positioning after pitch change
                    addMarkersToMap();
                });

                // Handle resize events more actively for mobile rotations
                window.addEventListener('resize', () => {
                    if (map.current) {
                        map.current.resize();
                        // Brief timeout to let the resize complete before repositioning markers
                        setTimeout(() => addMarkersToMap(), 100);
                    }
                });
            });

            // Cleanup function
            return () => {
                window.removeEventListener('resize', () => {
                    if (map.current) map.current.resize();
                });
                if (map.current) {
                    map.current.remove();
                    map.current = null;
                }
            };
        }, 100); // Small delay to allow viewport to settle
    }, []);

    // Update markers when filtered investments change
    useEffect(() => {
        addMarkersToMap();
    }, [filteredInvestments]);

    // Apply all filters whenever any filter state changes
    useEffect(() => {
        applyAllFilters();
    }, [selectedCategories, showUncategorized, dateRange]);

    return (
        <div className="relative w-full h-full flex-1" style={{ zIndex: 0 }}>
            {/* Map container - Increased z-index to be above header on mobile */}
            <div ref={mapContainer} className="w-full h-full absolute inset-0 map-container" style={{ zIndex: 1 }}></div>

            {/* Loading state */}
            {loading && webGLSupported !== false && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-3 text-gray-700">Loading map...</p>
                    </div>
                </div>
            )}

            {/* WebGL not supported message */}
            {webGLSupported === false && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-10 p-6">
                    <div className="max-w-md text-center bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-xl font-bold text-red-600 mb-3">Map Not Available</h3>
                        <p className="text-gray-700 mb-4">
                            Your browser or device doesn't support WebGL, which is required to display the map.
                        </p>
                        <div className="text-sm text-gray-500 mt-3">
                            <p>Suggestions:</p>
                            <ul className="list-disc list-inside mt-2 text-left">
                                <li>Try using a different browser (Chrome or Safari)</li>
                                <li>Check if hardware acceleration is enabled in your browser settings</li>
                                <li>Try using a desktop computer or a newer mobile device</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Combined info panel, category filter, and date filter */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-5 w-full max-w-xl px-4">
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

                    {/* Category filter section */}
                    <div className="px-4 py-2 border-b border-gray-200/50">
                        <CategoryFilter
                            selectedCategories={selectedCategories}
                            onCategoryToggle={handleCategoryToggle}
                            onUncategorizedToggle={handleUncategorizedToggle}
                            showUncategorized={showUncategorized}
                            investments={investments}
                        />
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