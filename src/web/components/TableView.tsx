import React, { useState, useMemo, useEffect } from 'react';
import { Investment, Location, AmountBreakdown, FundingSource, Incentive } from '../../types';
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    flexRender,
    ColumnDef,
    RowData,
    Row,
    FilterFn,
    SortingState,
    ExpandedState,
    createColumnHelper,
    RowSelectionState
} from '@tanstack/react-table';
import {
    ChevronDown,
    ChevronUp,
    ChevronRight,
    Search,
    SortAsc,
    SortDesc,
    Download,
    ExternalLink,
    CheckSquare,
    Square,
    Link2Icon
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { DebouncedInput } from './ui/debounced-input';

// Extend RowData to include our custom types
declare module '@tanstack/react-table' {
    interface TableMeta<TData extends RowData> {
        updateData: (rowIndex: number, columnId: string, value: unknown) => void
    }
}

// Helper function to normalize Greek text for searching
const normalizeGreekText = (text: string): string => {
    if (!text) return '';

    // Convert to lowercase
    let normalized = text.toLowerCase();

    // Remove accents (diacritics)
    normalized = normalized
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    // Map specific Greek characters
    const replacements: Record<string, string> = {
        'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ϊ': 'ι', 'ΐ': 'ι',
        'ό': 'ο', 'ύ': 'υ', 'ϋ': 'υ', 'ΰ': 'υ', 'ώ': 'ω'
    };

    // Apply character replacements
    Object.entries(replacements).forEach(([accented, plain]) => {
        normalized = normalized.replace(new RegExp(accented, 'g'), plain);
    });

    return normalized;
};

// Greek-aware fuzzy filter
const greekFuzzyFilter: FilterFn<any> = (row, columnId, filterValue, addMeta) => {
    // Normalize the filter value
    const normalizedFilterValue = normalizeGreekText(filterValue);

    // Handle cases where columnId represents nested or complex data
    const getValue = (obj: any, path: string) => {
        const keys = path.split('.');
        return keys.reduce((acc, key) => {
            if (acc === null || acc === undefined) return '';
            if (Array.isArray(acc) && key === 'length') return acc.length;
            if (Array.isArray(acc)) {
                return acc.map(item => item[key] || '').join(' ');
            }
            return acc[key];
        }, obj);
    };

    let value = getValue(row.original, columnId);

    // For special cases like locations array
    if (columnId === 'locations' && Array.isArray(value)) {
        value = value.map((loc: Location) => loc.description || '').join(' ');
    }

    // Convert to string and normalize
    const normalizedValue = normalizeGreekText(String(value));

    // Check if the value includes the filter value
    return normalizedValue.includes(normalizedFilterValue);
};

// Helper to convert investments to CSV
const convertToCSV = (data: Investment[]): string => {
    // Define CSV headers
    const headers = [
        'Όνομα',
        'Δικαιούχος',
        'Ημερομηνία Έγκρισης',
        'Ποσό (€)',
        'ΦΕΚ',
        'Διαύγεια ΑΔΑ',
        'Τοποθεσίες',
        'Πηγές Χρηματοδότησης',
        'Επιδοτήσεις'
    ];

    // Map data to CSV rows
    const rows = data.map((investment) => {
        // Format locations
        const locations = investment.locations
            ? investment.locations.map(loc => loc.description).join(', ')
            : '';

        // Format funding sources
        const fundingSources = investment.fundingSource
            ? investment.fundingSource.map(src => `${src.source} ${src.perc ? `(${src.perc}%)` : ''}`).join(', ')
            : '';

        // Format incentives
        const incentives = investment.incentivesApproved
            ? investment.incentivesApproved.map(inc => inc.name).join(', ')
            : '';

        return [
            investment.name || '',
            investment.beneficiary || '',
            investment.dateApproved || '',
            investment.totalAmount?.toString() || '',
            investment.reference?.fek || '',
            investment.reference?.diavgeiaADA || '',
            locations,
            fundingSources,
            incentives
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
    });

    // Combine headers and rows
    return [headers.join(','), ...rows].join('\n');
};

// Helper to download CSV file
const downloadCSV = (csvContent: string, filename: string): void => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Helper to create Diavgeia URL
const createDiavgeiaURL = (ada: string): string => {
    if (!ada) return '';
    return `https://diavgeia.gov.gr/decision/view/${encodeURIComponent(ada)}`;
};

// Interfaces for the expandable rows
interface DetailRowProps {
    investment: Investment;
}

// Component for the expanded row details
const DetailRow: React.FC<DetailRowProps> = ({ investment }) => {
    const ada = investment.reference?.diavgeiaADA || '';
    const investmentLink = `#/table/investment/${encodeURIComponent(ada)}`;

    return (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 my-2">
            <div className="flex justify-between mb-2">
                <h2 className="text-xl font-bold">{investment.name}</h2>
                <a
                    href={investmentLink}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(window.location.origin + window.location.pathname + investmentLink);
                        alert('Ο σύνδεσμος αντιγράφηκε στο πρόχειρο');
                    }}
                    title="Αντιγραφή συνδέσμου"
                >
                    <Link2Icon className="h-4 w-4" />
                    <span>Σύνδεσμος</span>
                </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Basic Information */}
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Βασικές Πληροφορίες</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <span className="text-gray-500">Όνομα:</span>
                            <span className="font-medium">{investment.name}</span>
                            <span className="text-gray-500">Δικαιούχος:</span>
                            <span className="font-medium">{investment.beneficiary}</span>
                            <span className="text-gray-500">Ημερομηνία Έγκρισης:</span>
                            <span className="font-medium">{investment.dateApproved}</span>
                            <span className="text-gray-500">Συνολικό Ποσό:</span>
                            <span className="font-medium">€{investment.totalAmount?.toLocaleString('el-GR')}</span>
                        </div>
                    </div>

                    {/* Reference */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Αναφορές</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <span className="text-gray-500">ΦΕΚ:</span>
                            <span className="font-medium">{investment.reference?.fek || 'N/A'}</span>
                            <span className="text-gray-500">Διαύγεια ΑΔΑ:</span>
                            {investment.reference?.diavgeiaADA ? (
                                <a
                                    href={createDiavgeiaURL(investment.reference.diavgeiaADA)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center font-medium"
                                >
                                    {investment.reference.diavgeiaADA}
                                    <ExternalLink className="h-3.5 w-3.5 ml-1" />
                                </a>
                            ) : (
                                <span className="font-medium">N/A</span>
                            )}
                        </div>
                    </div>

                    {/* Locations */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Τοποθεσίες</h3>
                        {investment.locations && investment.locations.length > 0 ? (
                            <div className="space-y-2">
                                {investment.locations.map((location, idx) => (
                                    <div key={idx} className="p-2 bg-white rounded border border-gray-200">
                                        <div className="flex justify-between items-start">
                                            <span className="font-medium">{location.description}</span>
                                            {location.lat && location.lon && (
                                                <Badge variant="outline" className="ml-2">
                                                    Γεωγραφικά δεδομένα: {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
                                                </Badge>
                                            )}
                                        </div>
                                        {location.textLocation && (
                                            <div className="text-sm text-gray-600 mt-1">{location.textLocation}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500">Δεν υπάρχουν καταχωρημένες τοποθεσίες</div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Amount Breakdown */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Ανάλυση Ποσού</h3>
                        {investment.amountBreakdown && investment.amountBreakdown.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Περιγραφή</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Ποσό (€)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {investment.amountBreakdown.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="px-4 py-2 text-sm text-gray-900">{item.description}</td>
                                                <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.amount.toLocaleString('el-GR')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500">Δεν υπάρχει διαθέσιμη ανάλυση</div>
                        )}
                    </div>

                    {/* Funding Sources */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Πηγές Χρηματοδότησης</h3>
                        {investment.fundingSource && investment.fundingSource.length > 0 ? (
                            <div className="space-y-2">
                                {investment.fundingSource.map((source, idx) => (
                                    <div key={idx} className="flex justify-between p-2 bg-white rounded border border-gray-200">
                                        <span className="font-medium">{source.source}</span>
                                        <div className="text-right">
                                            {source.perc && <span className="text-xs text-gray-500 mr-2">{(source.perc * 100).toFixed(1)}%</span>}
                                            {source.amount && <span className="font-medium">€{source.amount.toLocaleString('el-GR')}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500">Δεν υπάρχουν καταχωρημένες πηγές χρηματοδότησης</div>
                        )}
                    </div>

                    {/* Incentives */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Παροχές & Κίνητρα</h3>
                        {investment.incentivesApproved && investment.incentivesApproved.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {investment.incentivesApproved.map((incentive, idx) => (
                                    <Badge key={idx} variant="secondary">{incentive.name}</Badge>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500">Δεν υπάρχουν καταχωρημένα κίνητρα</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Table component
interface TableViewProps {
    investments: Investment[];
    totalAmount: number;
}

const TableView: React.FC<TableViewProps> = ({ investments, totalAmount }) => {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [expanded, setExpanded] = useState<ExpandedState>({});
    const [globalFilter, setGlobalFilter] = useState<string>('');
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

    // Update the useEffect for handling URL hash for specific investment
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash.startsWith('#/table/investment/')) {
                const encodedAda = hash.split('/').pop() || '';
                const ada = decodeURIComponent(encodedAda);
                console.log('Hash navigation: Looking for investment with ADA:', ada);
                console.log('Current investments count:', investments.length);

                if (ada) {
                    // Find the row index with this ADA
                    const rowIndex = investments.findIndex(inv => {
                        const investmentAda = inv.reference?.diavgeiaADA || '';
                        return investmentAda === ada;
                    });

                    // Log the match after finding it
                    if (rowIndex >= 0) {
                        console.log('Found matching investment at index:', rowIndex);
                        console.log('Expanding row at index:', rowIndex);
                        // Expand that row
                        setExpanded({ [rowIndex]: true });

                        // Wait for the table to render, then scroll to the element
                        setTimeout(() => {
                            const elementId = `investment-${ada}`;
                            console.log('Looking for element with ID:', elementId);
                            const element = document.getElementById(elementId);
                            if (element) {
                                console.log('Found element, scrolling into view');
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            } else {
                                console.log(`Could not find element with ID: ${elementId}`);
                                console.log('Available IDs:', Array.from(document.querySelectorAll('[id^="investment-"]')).map(el => el.id));
                            }
                        }, 500); // Increased timeout further to ensure DOM is updated
                    } else {
                        console.log(`Investment with ADA ${ada} not found`);
                        console.log('Available ADAs:', investments.map(inv => inv.reference?.diavgeiaADA).filter(Boolean));
                    }
                }
            }
        };

        // Add a bit of delay on initial load to ensure investments are loaded
        if (investments.length > 0) {
            setTimeout(handleHashChange, 300);
        }

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [investments]);

    // Define table columns
    const columns = useMemo<ColumnDef<Investment>[]>(
        () => [
            {
                id: 'select',
                header: ({ table }) => (
                    <div className="px-1">
                        <Button
                            variant="ghost"
                            size="xs"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={table.getToggleAllRowsSelectedHandler()}
                        >
                            {table.getIsAllRowsSelected() ? (
                                <CheckSquare className="h-4 w-4" />
                            ) : (
                                <Square className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                ),
                cell: ({ row }) => (
                    <div className="px-1">
                        <Button
                            variant="ghost"
                            size="xs"
                            className="h-4 w-4 p-0 hover:bg-transparent"
                            onClick={row.getToggleSelectedHandler()}
                        >
                            {row.getIsSelected() ? (
                                <CheckSquare className="h-4 w-4" />
                            ) : (
                                <Square className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                ),
                enableSorting: false,
            },
            {
                id: 'expander',
                header: () => null,
                cell: ({ row }) => {
                    return (
                        <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => row.toggleExpanded()}
                            className="p-0 hover:bg-transparent"
                        >
                            {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                    )
                },
                enableSorting: false,
            },
            {
                accessorKey: 'name',
                header: 'Όνομα',
                cell: ({ row }) => (
                    <div className="font-medium text-sm max-w-[250px] truncate" title={row.original.name}>
                        {row.original.name}
                    </div>
                ),
            },
            {
                accessorKey: 'beneficiary',
                header: 'Δικαιούχος',
                cell: ({ row }) => (
                    <div className="text-sm max-w-[180px] truncate" title={row.original.beneficiary}>
                        {row.original.beneficiary}
                    </div>
                ),
            },
            {
                accessorKey: 'dateApproved',
                header: 'Ημερομηνία Έγκρισης',
                cell: ({ row }) => {
                    try {
                        const date = new Date(row.original.dateApproved);
                        return isNaN(date.getTime())
                            ? row.original.dateApproved
                            : date.toLocaleDateString('el-GR');
                    } catch (e) {
                        return row.original.dateApproved;
                    }
                },
            },
            {
                accessorKey: 'totalAmount',
                header: 'Ποσό (€)',
                cell: ({ row }) => (
                    <div className="text-right font-medium">
                        {row.original.totalAmount?.toLocaleString('el-GR') || 'N/A'}
                    </div>
                ),
            },
            {
                accessorKey: 'reference.diavgeiaADA',
                header: 'Διαύγεια',
                cell: ({ row }) => {
                    const ada = row.original.reference?.diavgeiaADA;
                    if (!ada) return 'N/A';

                    return (
                        <a
                            href={createDiavgeiaURL(ada)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center text-sm"
                            title="Προβολή απόφασης στη Διαύγεια"
                        >
                            {ada.length > 15 ? `${ada.substring(0, 12)}...` : ada}
                            <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                    );
                },
            },
            {
                accessorKey: 'locations',
                header: 'Τοποθεσίες',
                cell: ({ row }) => {
                    const locations = row.original.locations;
                    if (!locations || locations.length === 0) return 'N/A';

                    // Join all location descriptions for the title tooltip
                    const allLocations = locations.map(loc => loc.description).join(', ');

                    return (
                        <div className="flex flex-wrap gap-1 max-w-[150px] overflow-hidden" title={allLocations}>
                            {locations.length <= 1 ? (
                                // If only one location, show it normally
                                locations.map((loc, idx) => (
                                    <Badge key={idx} variant="outline" className="truncate max-w-full">
                                        {loc.description}
                                        {loc.lat && loc.lon ? ' 📍' : ''}
                                    </Badge>
                                ))
                            ) : (
                                // If multiple locations, show limited format
                                <>
                                    <Badge variant="outline" className="truncate max-w-[110px]">
                                        {locations[0].description}
                                    </Badge>
                                    <Badge variant="outline" className="whitespace-nowrap">
                                        +{locations.length - 1}
                                    </Badge>
                                </>
                            )}
                        </div>
                    );
                },
                enableSorting: false,
            },
        ],
        []
    );

    // Handle CSV export
    const handleExportCSV = () => {
        let dataToExport: Investment[] = [];

        // If there are selected rows, export only those
        if (Object.keys(rowSelection).length > 0) {
            const selectedRowIndices = Object.keys(rowSelection).map(Number);
            dataToExport = selectedRowIndices.map(index => table.getRowModel().rows[index].original);
        }
        // If filtering is applied, export filtered data
        else if (globalFilter) {
            dataToExport = table.getFilteredRowModel().rows.map(row => row.original);
        }
        // Otherwise export all data
        else {
            dataToExport = investments;
        }

        // Generate CSV content
        const csvContent = convertToCSV(dataToExport);

        // Download CSV file
        downloadCSV(csvContent, `investments-export-${new Date().toISOString().slice(0, 10)}.csv`);
    };

    // Initialize Tanstack Table with Greek-aware filtering
    const table = useReactTable({
        data: investments,
        columns,
        state: {
            sorting,
            expanded,
            globalFilter,
            rowSelection,
        },
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        filterFns: {
            greekFuzzy: greekFuzzyFilter,
        },
        globalFilterFn: greekFuzzyFilter,
        onSortingChange: setSorting,
        onExpandedChange: setExpanded,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        initialState: {
            pagination: {
                pageSize: 50,
            },
        },
    });

    // Selected rows count
    const selectedCount = Object.keys(rowSelection).length;

    return (
        <>
            {/* Dashboard summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="p-6 bg-white rounded-lg shadow-sm">
                    <div className="pb-2">
                        <h2 className="text-2xl font-semibold">Συνολικός Αριθμός</h2>
                        <p className="text-gray-500">Αριθμός στρατηγικών επενδύσεων</p>
                    </div>
                    <div>
                        <p className="text-4xl font-bold">{table.getFilteredRowModel().rows.length}</p>
                        {globalFilter && (
                            <p className="text-sm text-gray-500 mt-1">από σύνολο {investments.length}</p>
                        )}
                    </div>
                </div>

                <div className="p-6 bg-white rounded-lg shadow-sm">
                    <div className="pb-2">
                        <h2 className="text-2xl font-semibold">Συνολικό Ποσό</h2>
                        <p className="text-gray-500">Συνολική αξία επενδύσεων</p>
                    </div>
                    <div>
                        <p className="text-4xl font-bold">
                            €{table.getFilteredRowModel().rows
                                .reduce((sum, row) => sum + (row.original.totalAmount || 0), 0)
                                .toLocaleString('el-GR')}
                        </p>
                    </div>
                </div>

                <div className="p-6 bg-white rounded-lg shadow-sm">
                    <div className="pb-2">
                        <h2 className="text-2xl font-semibold">Μέσο Μέγεθος</h2>
                        <p className="text-gray-500">Μέση αξία επένδυσης</p>
                    </div>
                    <div>
                        <p className="text-4xl font-bold">
                            €{table.getFilteredRowModel().rows.length > 0
                                ? Math.round(
                                    table.getFilteredRowModel().rows.reduce((sum, row) => sum + (row.original.totalAmount || 0), 0) /
                                    table.getFilteredRowModel().rows.length
                                ).toLocaleString('el-GR')
                                : 0}
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm mb-10">
                {/* Table Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-between items-center flex-wrap gap-4">
                        <div>
                            <h2 className="text-xl font-semibold">Αναλυτικός Πίνακας Επενδύσεων</h2>
                            <p className="text-gray-500 mt-1">
                                Πλήρης λίστα με δυνατότητα επέκτασης για περισσότερες λεπτομέρειες
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Export Button */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportCSV}
                                className="flex items-center gap-1"
                            >
                                <Download className="h-4 w-4" />
                                <span>
                                    {selectedCount > 0
                                        ? `Εξαγωγή (${selectedCount})`
                                        : 'Εξαγωγή'}
                                </span>
                            </Button>

                            {/* Search */}
                            <div className="relative w-full md:max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <DebouncedInput
                                    value={globalFilter ?? ''}
                                    onChange={value => setGlobalFilter(String(value))}
                                    className="pl-10"
                                    placeholder="Αναζήτηση..."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => (
                                        <th
                                            key={header.id}
                                            colSpan={header.colSpan}
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                        >
                                            {header.isPlaceholder ? null : (
                                                <div
                                                    className={
                                                        header.column.getCanSort()
                                                            ? 'cursor-pointer select-none flex items-center gap-1'
                                                            : ''
                                                    }
                                                    onClick={header.column.getToggleSortingHandler()}
                                                >
                                                    {flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                                    {{
                                                        asc: <SortAsc className="h-3 w-3 ml-1" />,
                                                        desc: <SortDesc className="h-3 w-3 ml-1" />,
                                                    }[header.column.getIsSorted() as string] ?? null}
                                                </div>
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {table.getRowModel().rows.length > 0 ? (
                                table.getRowModel().rows.map(row => (
                                    <React.Fragment key={row.id}>
                                        <tr
                                            id={`investment-${row.original.reference?.diavgeiaADA || ''}`}
                                            className={row.getIsExpanded() ? 'bg-blue-50/50' : 'hover:bg-gray-50'}
                                        >
                                            {row.getVisibleCells().map(cell => (
                                                <td key={cell.id} className="px-6 py-4 text-sm">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </td>
                                            ))}
                                        </tr>
                                        {row.getIsExpanded() && (
                                            <tr>
                                                <td colSpan={row.getVisibleCells().length} className="px-4 pb-4">
                                                    <DetailRow investment={row.original} />
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={columns.length} className="px-6 py-10 text-center text-gray-500">
                                        Δεν βρέθηκαν αποτελέσματα με τα κριτήρια αναζήτησης
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6">
                    <div className="flex-1 flex justify-between sm:hidden">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            Προηγούμενο
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            Επόμενο
                        </Button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div className="flex gap-x-2 items-baseline">
                            <span className="text-sm text-gray-700">
                                Σελίδα <span className="font-medium">{table.getState().pagination.pageIndex + 1}</span> από <span className="font-medium">{table.getPageCount()}</span>
                            </span>
                            <select
                                value={table.getState().pagination.pageSize}
                                onChange={e => {
                                    table.setPageSize(Number(e.target.value))
                                }}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 text-sm"
                            >
                                {[10, 20, 50, 100].map(pageSize => (
                                    <option key={pageSize} value={pageSize}>
                                        Εμφάνιση {pageSize}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => table.setPageIndex(0)}
                                    disabled={!table.getCanPreviousPage()}
                                    className="rounded-l-md"
                                >
                                    &laquo;
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => table.previousPage()}
                                    disabled={!table.getCanPreviousPage()}
                                >
                                    &lsaquo;
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => table.nextPage()}
                                    disabled={!table.getCanNextPage()}
                                >
                                    &rsaquo;
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                    disabled={!table.getCanNextPage()}
                                    className="rounded-r-md"
                                >
                                    &raquo;
                                </Button>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default TableView; 