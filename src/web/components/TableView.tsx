import React, { useEffect, useState } from 'react';
import { Investment } from '../../types';
import InvestmentTable from './InvestmentTable';
import { convertToCSV, downloadCSV, findInvestmentById, parseInvestmentId } from './TableUtils';

interface TableViewProps {
    investments: Investment[];
    totalAmount: number;
}

const TableView: React.FC<TableViewProps> = ({ investments, totalAmount }) => {
    const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);

    // Handle URL hash change to show specific investment
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash.startsWith('#/table/investment/')) {
                const encodedId = hash.replace('#/table/investment/', '');
                const id = decodeURIComponent(encodedId);

                // Use the new findInvestmentById utility
                const investment = findInvestmentById(id, investments);

                setSelectedInvestment(investment || null);

                if (!investment) {
                    console.warn(`Investment with ID ${id} not found`);
                }
            } else {
                setSelectedInvestment(null);
            }
        };

        // Initial check
        handleHashChange();

        // Listen for hash changes
        window.addEventListener('hashchange', handleHashChange);

        // Cleanup
        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, [investments]);

    // Handle CSV export
    const handleExportCSV = () => {
        const csvContent = convertToCSV(investments);
        downloadCSV(csvContent, 'strategic-investments.csv');
    };

    return (
        <div className="px-4 py-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Στρατηγικές Επενδύσεις</h2>
                    <div className="mt-2">
                        <span className="font-semibold">{investments.length}</span> επενδύσεις συνολικού ποσού{' '}
                        <span className="font-bold">€{totalAmount.toLocaleString('el-GR')}</span>
                    </div>
                </div>

                <InvestmentTable
                    investments={investments}
                    onExportCSV={handleExportCSV}
                    selectedInvestment={selectedInvestment}
                />
            </div>
        </div>
    );
};

export default TableView; 