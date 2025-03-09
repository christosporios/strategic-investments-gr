import React, { useEffect, useState } from 'react';
import { Investment } from '../types';
import { Tabs, TabsContent } from './components/ui/tabs';
import './styles.css';

// Import our custom components
import Header from './components/Header';
import TableView from './components/TableView';
import MapView from './components/MapView';
import HelpView from './components/HelpView';

// Define the structure of our JSON data
interface InvestmentsData {
    metadata: {
        generatedAt: string;
        totalInvestments: number;
        revisionsExcluded?: Array<{
            original: string;
            replacedBy: string;
        }>;
    };
    investments: Investment[];
}

const App: React.FC = () => {
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [metadata, setMetadata] = useState<InvestmentsData['metadata'] | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<string>('map');

    // Set the initial view based on URL hash when the app loads
    useEffect(() => {
        const hash = window.location.hash;
        if (hash.startsWith('#/map')) {
            setActiveView('map');
        } else if (hash.startsWith('#/table')) {
            setActiveView('table');
        } else if (hash.startsWith('#/help')) {
            setActiveView('help');
        } else if (!hash) {
            // Set default hash if none exists
            window.location.hash = '#/map';
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            try {
                const response = await fetch('./data/investments.json');
                if (!response.ok) {
                    throw new Error(`Error loading data: ${response.statusText}`);
                }
                const data = await response.json();

                // Check if the data has the expected structure
                if (data && typeof data === 'object' && Array.isArray(data.investments)) {
                    setInvestments(data.investments);
                    if (data.metadata) {
                        setMetadata(data.metadata);
                    }
                } else if (Array.isArray(data)) {
                    // Handle the case where the data is directly an array
                    setInvestments(data);
                } else {
                    console.error('Unexpected data format:', data);
                    setError('Λάθος μορφή δεδομένων επενδύσεων - δεν βρέθηκε η λίστα επενδύσεων');
                }
                setLoading(false);
            } catch (err) {
                console.error('Error loading data:', err);
                setError((err as Error).message || 'Failed to load investment data');
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Calculate total investment amount with safety check
    const totalAmount = Array.isArray(investments)
        ? investments.reduce((sum, investment) => sum + (investment.totalAmount || 0), 0)
        : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-96 p-6 bg-white rounded-lg shadow-lg">
                    <h2 className="text-xl font-bold mb-2">Φόρτωση...</h2>
                    <p className="text-gray-500 mb-4">Ανάκτηση δεδομένων στρατηγικών επενδύσεων</p>
                    <div className="h-4 w-full bg-gray-200 animate-pulse rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-96 p-6 bg-white border border-red-500 rounded-lg shadow-lg">
                    <h2 className="text-xl font-bold text-red-500 mb-2">Σφάλμα</h2>
                    <p className="text-gray-500 mb-4">Αποτυχία φόρτωσης δεδομένων επενδύσεων</p>
                    <p className="text-red-700">{error}</p>
                </div>
            </div>
        );
    }

    // Special class for map view to remove padding and take full screen
    const containerClass = activeView === 'map'
        ? 'absolute inset-0 w-full h-full'
        : 'container mx-auto pt-24 pb-6 px-4 w-full';

    return (
        <div className="min-h-screen bg-gray-50 relative">
            {/* Sticky Header - Increased z-index to be above map on mobile */}
            <Header
                totalInvestments={Array.isArray(investments) ? investments.length : 0}
                totalAmount={totalAmount}
                activeView={activeView}
                onViewChange={setActiveView}
            />

            <div className={containerClass} style={{ paddingTop: activeView === 'map' ? '0' : undefined }}>
                {/* Content based on active view */}
                <Tabs value={activeView} onValueChange={setActiveView} className={activeView === 'map' ? 'h-full' : ''}>
                    <TabsContent value="map" className="h-full relative" style={{ top: 0, bottom: 0 }}>
                        <MapView investments={investments} />
                    </TabsContent>

                    <TabsContent value="table" className="w-full overflow-x-hidden">
                        <TableView
                            investments={investments}
                            totalAmount={totalAmount}
                        />
                    </TabsContent>

                    <TabsContent value="help" className="w-full overflow-x-hidden">
                        <HelpView metadata={metadata} />
                    </TabsContent>
                </Tabs>

                {activeView !== 'map' && (
                    <footer className="text-center text-sm text-gray-500 py-10">
                        <p>Πύλη Δεδομένων Στρατηγικών Επενδύσεων &copy; {new Date().getFullYear()}</p>
                    </footer>
                )}
            </div>
        </div>
    );
};

export default App; 