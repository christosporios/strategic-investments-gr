import React, { useEffect, useState, useMemo } from 'react';
import { Investment } from '../../types';
import InvestmentTable from './InvestmentTable';
import { convertToCSV, downloadCSV, findInvestmentById } from './TableUtils';
import { Category, IncentiveType } from '../../types/constants';
import { X, Filter, ChevronDown, ChevronUp, Search } from 'lucide-react';

interface TableViewProps {
    investments: Investment[];
    totalAmount: number;
}

const TableView: React.FC<TableViewProps> = ({ investments, totalAmount }) => {
    const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Filter states
    const [amountRange, setAmountRange] = useState<{ min: number | ''; max: number | '' }>({ min: '', max: '' });
    const [beneficiaryFilter, setBeneficiaryFilter] = useState<string>('');
    const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
    const [selectedIncentives, setSelectedIncentives] = useState<IncentiveType[]>([]);

    // Filtered investments
    const [filteredInvestments, setFilteredInvestments] = useState<Investment[]>(investments);

    // Get unique beneficiaries for dropdown
    const uniqueBeneficiaries = useMemo(() => {
        const beneficiaries = new Set<string>();
        investments.forEach(inv => {
            if (inv.beneficiary) {
                beneficiaries.add(inv.beneficiary);
            }
        });
        return Array.from(beneficiaries).sort();
    }, [investments]);

    // Get unique categories with counts
    const categoriesWithCount = useMemo(() => {
        const counts = new Map<Category, number>();
        // Initialize counts for all categories
        Object.values(Category).forEach(cat => counts.set(cat, 0));

        // Count investments by category
        investments.forEach(inv => {
            if (inv.category) {
                counts.set(inv.category, (counts.get(inv.category) || 0) + 1);
            }
        });

        // Convert to array and sort by count
        return Array.from(counts.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count); // Sort by count descending
    }, [investments]);

    // Get unique incentives with counts
    const incentivesWithCount = useMemo(() => {
        const counts = new Map<IncentiveType, number>();
        // Initialize counts for all incentive types
        Object.values(IncentiveType).forEach(inc => counts.set(inc, 0));

        // Count investments by incentive type
        investments.forEach(inv => {
            if (inv.incentivesApproved) {
                inv.incentivesApproved.forEach(incentive => {
                    if (incentive.incentiveType) {
                        counts.set(incentive.incentiveType, (counts.get(incentive.incentiveType) || 0) + 1);
                    }
                });
            }
        });

        // Convert to array and sort by count
        return Array.from(counts.entries())
            .map(([incentiveType, count]) => ({ incentiveType, count }))
            .filter(item => item.count > 0) // Only include incentives that exist
            .sort((a, b) => b.count - a.count); // Sort by count descending
    }, [investments]);

    // Calculate min/max investment amounts
    const amountStats = useMemo(() => {
        let min = Infinity;
        let max = 0;

        investments.forEach(inv => {
            if (inv.totalAmount) {
                min = Math.min(min, inv.totalAmount);
                max = Math.max(max, inv.totalAmount);
            }
        });

        return { min: min === Infinity ? 0 : min, max };
    }, [investments]);

    // Toggle category selection
    const toggleCategory = (category: Category) => {
        setSelectedCategories(prev => {
            if (prev.includes(category)) {
                return prev.filter(c => c !== category);
            } else {
                return [...prev, category];
            }
        });
    };

    // Toggle incentive selection
    const toggleIncentive = (incentiveType: IncentiveType) => {
        setSelectedIncentives(prev => {
            if (prev.includes(incentiveType)) {
                return prev.filter(c => c !== incentiveType);
            } else {
                return [...prev, incentiveType];
            }
        });
    };

    // Get category name for display
    const getCategoryName = (category: Category): string => {
        switch (category) {
            case Category.PRODUCTION_MANUFACTURING:
                return 'Παραγωγή & Μεταποίηση';
            case Category.TECHNOLOGY_INNOVATION:
                return 'Τεχνολογία & Καινοτομία';
            case Category.TOURISM_CULTURE:
                return 'Τουρισμός & Πολιτισμός';
            case Category.SERVICES_EDUCATION:
                return 'Υπηρεσίες & Εκπαίδευση';
            case Category.HEALTHCARE_WELFARE:
                return 'Υγεία & Κοινωνική Μέριμνα';
            default:
                return category;
        }
    };

    // Get incentive name for display
    const getIncentiveName = (incentiveType: IncentiveType): string => {
        switch (incentiveType) {
            case IncentiveType.FAST_TRACK_LICENSING:
                return 'Ταχεία αδειοδότηση';
            case IncentiveType.SPECIAL_ZONING:
                return 'Ειδική χωροθέτηση';
            case IncentiveType.TAX_RATE_FREEZE:
                return 'Σταθεροποίηση φορ. συντελεστή';
            case IncentiveType.TAX_EXEMPTION:
                return 'Φορολογικές απαλλαγές';
            case IncentiveType.ACCELERATED_DEPRECIATION:
                return 'Επιταχυνόμενες αποσβέσεις';
            case IncentiveType.INVESTMENT_GRANT:
                return 'Επιχορήγηση επένδυσης';
            case IncentiveType.LEASING_SUBSIDY:
                return 'Επιδότηση leasing';
            case IncentiveType.EMPLOYMENT_COST_SUBSIDY:
                return 'Επιδότηση κόστους απασχόλησης';
            case IncentiveType.AUDITOR_MONITORING:
                return 'Παρακολούθηση ελεγκτή';
            case IncentiveType.SHORELINE_USE:
                return 'Χρήση αιγιαλού';
            case IncentiveType.EXPROPRIATION_SUPPORT:
                return 'Υποστήριξη απαλλοτριώσεων';
            default:
                return incentiveType;
        }
    };

    // Reset all filters
    const resetFilters = () => {
        setAmountRange({ min: '', max: '' });
        setBeneficiaryFilter('');
        setSelectedCategories([]);
        setSelectedIncentives([]);
    };

    // Apply filters
    useEffect(() => {
        let result = [...investments];

        // Apply amount filter
        if (amountRange.min !== '') {
            result = result.filter(inv => inv.totalAmount && inv.totalAmount >= Number(amountRange.min));
        }
        if (amountRange.max !== '') {
            result = result.filter(inv => inv.totalAmount && inv.totalAmount <= Number(amountRange.max));
        }

        // Apply beneficiary filter
        if (beneficiaryFilter) {
            result = result.filter(inv => inv.beneficiary === beneficiaryFilter);
        }

        // Apply category filter
        if (selectedCategories.length > 0) {
            result = result.filter(inv => inv.category && selectedCategories.includes(inv.category));
        }

        // Apply incentive filter
        if (selectedIncentives.length > 0) {
            result = result.filter(inv =>
                inv.incentivesApproved &&
                inv.incentivesApproved.some(incentive =>
                    incentive.incentiveType && selectedIncentives.includes(incentive.incentiveType)
                )
            );
        }

        setFilteredInvestments(result);
    }, [investments, amountRange, beneficiaryFilter, selectedCategories, selectedIncentives]);

    // Calculate filtered total amount
    const filteredTotalAmount = useMemo(() => {
        return filteredInvestments.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    }, [filteredInvestments]);

    // Handle URL hash change to show specific investment
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash.startsWith('#/table/investment/')) {
                const encodedId = hash.replace('#/table/investment/', '');
                const id = decodeURIComponent(encodedId);

                // Use the findInvestmentById utility
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
        // Export only filtered investments
        const csvContent = convertToCSV(filteredInvestments);
        downloadCSV(csvContent, 'strategic-investments.csv');
    };

    return (
        <div className="px-4 py-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Στρατηγικές Επενδύσεις</h2>
                        <div className="mt-2">
                            <span className="font-semibold">{filteredInvestments.length}</span>
                            {filteredInvestments.length !== investments.length && (
                                <span className="text-gray-500 text-sm"> από {investments.length}</span>
                            )}
                            {' '}επενδύσεις συνολικού ποσού{' '}
                            <span className="font-bold">€{filteredTotalAmount.toLocaleString('el-GR')}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <Filter className="h-4 w-4" />
                        Φίλτρα
                        {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-gray-900">Φίλτρα αναζήτησης</h3>

                            <div className="flex gap-2">
                                <button
                                    onClick={resetFilters}
                                    className="inline-flex items-center px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100"
                                >
                                    <X className="h-3 w-3 mr-1" />
                                    Καθαρισμός
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Amount Filter */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Ποσό επένδυσης (€)
                                </label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="number"
                                        placeholder="Από"
                                        min={0}
                                        value={amountRange.min}
                                        onChange={(e) => setAmountRange(prev => ({ ...prev, min: e.target.value ? Number(e.target.value) : '' }))}
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    />
                                    <span className="text-gray-500">-</span>
                                    <input
                                        type="number"
                                        placeholder="Έως"
                                        min={0}
                                        value={amountRange.max}
                                        onChange={(e) => setAmountRange(prev => ({ ...prev, max: e.target.value ? Number(e.target.value) : '' }))}
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    />
                                </div>
                                <div className="text-xs text-gray-500">
                                    Εύρος: {amountStats.min.toLocaleString('el-GR')} - {amountStats.max.toLocaleString('el-GR')} €
                                </div>
                            </div>

                            {/* Beneficiary Filter */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Δικαιούχος
                                </label>
                                <div className="relative">
                                    <select
                                        value={beneficiaryFilter}
                                        onChange={(e) => setBeneficiaryFilter(e.target.value)}
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm appearance-none"
                                    >
                                        <option value="">Όλοι οι δικαιούχοι</option>
                                        {uniqueBeneficiaries.map(beneficiary => (
                                            <option key={beneficiary} value={beneficiary}>
                                                {beneficiary}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500">
                                    {uniqueBeneficiaries.length} δικαιούχοι
                                </div>
                            </div>

                            {/* Category Filter */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Κατηγορία
                                </label>
                                <div className="max-h-36 overflow-y-auto border border-gray-300 rounded-md p-2">
                                    {categoriesWithCount.map(({ category, count }) => (
                                        <div key={category} className="flex items-center mb-1 last:mb-0">
                                            <input
                                                type="checkbox"
                                                id={`cat-${category}`}
                                                checked={selectedCategories.includes(category)}
                                                onChange={() => toggleCategory(category)}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            />
                                            <label htmlFor={`cat-${category}`} className="ml-2 block text-sm text-gray-900 flex-1 cursor-pointer">
                                                {getCategoryName(category)}
                                            </label>
                                            <span className="text-xs text-gray-500 bg-gray-100 px-1.5 rounded-full">
                                                {count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Incentives Filter */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Κίνητρα
                                </label>
                                <div className="max-h-36 overflow-y-auto border border-gray-300 rounded-md p-2">
                                    {incentivesWithCount.map(({ incentiveType, count }) => (
                                        <div key={incentiveType} className="flex items-center mb-1 last:mb-0">
                                            <input
                                                type="checkbox"
                                                id={`inc-${incentiveType}`}
                                                checked={selectedIncentives.includes(incentiveType)}
                                                onChange={() => toggleIncentive(incentiveType)}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            />
                                            <label htmlFor={`inc-${incentiveType}`} className="ml-2 block text-sm text-gray-900 flex-1 cursor-pointer truncate">
                                                {getIncentiveName(incentiveType)}
                                            </label>
                                            <span className="text-xs text-gray-500 bg-gray-100 px-1.5 rounded-full">
                                                {count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <InvestmentTable
                    investments={filteredInvestments}
                    onExportCSV={handleExportCSV}
                    selectedInvestment={selectedInvestment}
                />
            </div>
        </div>
    );
};

export default TableView; 