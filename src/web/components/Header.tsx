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
        <div className="sticky top-4 z-50 mx-2 md:mx-6">
            <div className="bg-white/80 backdrop-blur-md border border-gray-200 shadow-md rounded-lg">
                <div className="container mx-auto flex flex-col md:flex-row items-center justify-center md:justify-between px-2 py-2 md:py-0 md:h-16 md:px-6">
                    <h1 className="text-sm md:text-base lg:text-xl font-semibold leading-tight text-center md:text-left py-2 md:py-0">
                        <span className="whitespace-nowrap">{totalInvestments} στρατηγικές επενδύσεις</span>
                        <span className="whitespace-nowrap"> αξίας {formattedAmount} δις €</span>
                    </h1>

                    <div className="flex items-center space-x-1 bg-muted p-1 rounded-md mb-2 md:mb-0">
                        <button
                            onClick={() => handleViewChange('map')}
                            className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-sm text-xs md:text-sm font-medium transition-colors ${activeView === 'map'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-background/50'
                                }`}
                        >
                            <MapIcon className="h-3 w-3 md:h-4 md:w-4" />
                            <span className="inline">Χάρτης</span>
                        </button>

                        <button
                            onClick={() => handleViewChange('table')}
                            className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-sm text-xs md:text-sm font-medium transition-colors ${activeView === 'table'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-background/50'
                                }`}
                        >
                            <TableIcon className="h-3 w-3 md:h-4 md:w-4" />
                            <span className="inline">Πίνακας</span>
                        </button>

                        <button
                            onClick={() => handleViewChange('help')}
                            className={`flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-sm text-xs md:text-sm font-medium transition-colors ${activeView === 'help'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-background/50'
                                }`}
                        >
                            <HelpCircleIcon className="h-3 w-3 md:h-4 md:w-4" />
                            <span className="inline">Βοήθεια</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Header; 