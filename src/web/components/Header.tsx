import React, { useEffect } from 'react';
import { MapIcon, TableIcon, HelpCircleIcon } from 'lucide-react';

interface HeaderProps {
    totalInvestments: number;
    totalAmount: number;
    activeView: string;
    onViewChange: (view: string) => void;
}

const Header: React.FC<HeaderProps> = ({
    totalInvestments,
    totalAmount,
    activeView,
    onViewChange
}) => {
    // Format the amount to billions with one decimal place
    const formattedAmount = (totalAmount / 1000000000).toFixed(1);

    // Handle navigation with URL hash
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash.startsWith('#/map')) {
                onViewChange('map');
            } else if (hash.startsWith('#/table')) {
                onViewChange('table');
            } else if (hash.startsWith('#/help')) {
                onViewChange('help');
            }
        };

        // Set initial hash if none exists
        if (!window.location.hash) {
            window.location.hash = `#/${activeView}`;
        } else {
            handleHashChange();
        }

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [onViewChange]);

    // Update URL hash when view changes
    useEffect(() => {
        // Only update if the current hash doesn't match the active view
        // This prevents infinite loops when hash changes trigger view changes
        const currentHash = window.location.hash;
        const viewHash = `#/${activeView}`;

        if (!currentHash.startsWith(viewHash)) {
            window.location.hash = viewHash;
        }
    }, [activeView]);

    // Navigation handler now updates the URL hash
    const handleViewChange = (view: string) => {
        window.location.hash = `#/${view}`;
    };

    return (
        <div className="sticky top-4 z-50 mx-4 md:mx-6">
            <div className="bg-white/80 backdrop-blur-md border border-gray-200 shadow-md rounded-lg">
                <div className="container mx-auto flex items-center justify-between h-16 px-4 md:px-6">
                    <h1 className="text-xl font-semibold">
                        {totalInvestments} στρατηγικές επενδύσεις αξίας {formattedAmount} δις €
                    </h1>

                    <div className="flex items-center space-x-1 bg-muted p-1 rounded-md">
                        <button
                            onClick={() => handleViewChange('map')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${activeView === 'map'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-background/50'
                                }`}
                        >
                            <MapIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Χάρτης</span>
                        </button>

                        <button
                            onClick={() => handleViewChange('table')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${activeView === 'table'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-background/50'
                                }`}
                        >
                            <TableIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Πίνακας</span>
                        </button>

                        <button
                            onClick={() => handleViewChange('help')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${activeView === 'help'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-background/50'
                                }`}
                        >
                            <HelpCircleIcon className="h-4 w-4" />
                            <span className="hidden sm:inline">Βοήθεια</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Header; 