import React, { useState, useEffect, useRef } from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    ColumnDef,
    flexRender,
    createColumnHelper,
    RowSelectionState,
    Row
} from '@tanstack/react-table';
import { Investment, Incentive } from '../../types';
import { Category, CategoryColors, DEFAULT_CATEGORY_COLOR } from '../../types/constants';
import IncentiveTag from './IncentiveTag';
import DetailView from './DetailView';
import { greekFuzzyFilter, getInvestmentId } from './TableUtils';

interface InvestmentTableProps {
    investments: Investment[];
    onExportCSV: () => void;
    selectedInvestment: Investment | null;
}

const InvestmentTable: React.FC<InvestmentTableProps> = ({
    investments,
    onExportCSV,
    selectedInvestment
}) => {
    const [globalFilter, setGlobalFilter] = useState('');
    const [rowSelection, setRowSelection] = useState({});
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const tableRef = useRef<HTMLDivElement>(null);

    const toggleRowExpanded = (rowId: string) => {
        setExpandedRows(prev => ({
            ...prev,
            [rowId]: !prev[rowId]
        }));
    };

    const isRowExpanded = (rowId: string): boolean => {
        return !!expandedRows[rowId];
    };

    // Handle selectedInvestment to expand the corresponding row
    useEffect(() => {
        if (selectedInvestment) {
            // Generate ID for the selected investment
            const selectedId = getInvestmentId(selectedInvestment);

            // Find the row index for the selected investment
            const rowIndex = investments.findIndex(inv => {
                const invId = getInvestmentId(inv);
                return invId === selectedId;
            });

            if (rowIndex !== -1) {
                // Expand the row
                setExpandedRows(prev => ({
                    ...prev,
                    [rowIndex.toString()]: true
                }));

                // Scroll to the investment row
                setTimeout(() => {
                    // Use the universal ID for the element ID
                    const elementId = `investment-${selectedId.replace(/:/g, '-')}`;
                    const element = document.getElementById(elementId);

                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

                        // Add highlight effect
                        element.classList.add('bg-yellow-100');
                        setTimeout(() => {
                            element.classList.remove('bg-yellow-100');
                        }, 2000);
                    } else {
                        console.warn(`Element with ID ${elementId} not found`);
                    }
                }, 100);
            }
        }
    }, [selectedInvestment, investments]);

    // Format amount as currency
    const formatAmount = (amount: number | undefined): string => {
        if (amount === undefined) return '-';
        return `€${amount.toLocaleString('el-GR')}`;
    };

    // Get category display name
    const getCategoryName = (category?: Category): string => {
        if (!category) return 'Χωρίς κατηγορία';

        switch (category) {
            case Category.PRODUCTION_MANUFACTURING:
                return 'Παραγωγή';
            case Category.TECHNOLOGY_INNOVATION:
                return 'Τεχνολογία';
            case Category.TOURISM_CULTURE:
                return 'Τουρισμός';
            case Category.SERVICES_EDUCATION:
                return 'Υπηρεσίες';
            case Category.HEALTHCARE_WELFARE:
                return 'Υγεία';
            default:
                return String(category);
        }
    };

    // Format long text to display in two lines with ellipsis
    const formatLongText = (text: string, maxLength: number = 50): JSX.Element => {
        if (!text) return <span>-</span>;

        if (text.length <= maxLength) {
            return <span>{text}</span>;
        }

        // Try to find a natural breaking point
        let breakpoint = Math.floor(maxLength / 2);
        const spaceIndices = [];

        // Find all space positions
        for (let i = 0; i < text.length; i++) {
            if (text[i] === ' ') {
                spaceIndices.push(i);
            }
        }

        // Find the space closest to the middle
        if (spaceIndices.length > 0) {
            let closestSpace = spaceIndices[0];
            let minDiff = Math.abs(breakpoint - closestSpace);

            for (const idx of spaceIndices) {
                const diff = Math.abs(breakpoint - idx);
                if (diff < minDiff && idx < maxLength - 10) { // ensure we're not too close to the end
                    minDiff = diff;
                    closestSpace = idx;
                }
            }

            breakpoint = closestSpace;
        }

        const firstLine = text.substring(0, breakpoint);
        let secondLine = text.substring(breakpoint + 1);

        // Truncate second line if it's still too long
        if (secondLine.length > maxLength - 10) {
            secondLine = secondLine.substring(0, maxLength - 10) + '...';
        }

        return (
            <div className="flex flex-col">
                <span>{firstLine}</span>
                <span>{secondLine}</span>
            </div>
        );
    };

    const columnHelper = createColumnHelper<Investment>();

    const columns = [
        columnHelper.accessor('name', {
            header: 'Όνομα Επένδυσης',
            cell: info => (
                <div className="w-48 md:w-60" title={info.getValue()}>
                    {formatLongText(info.getValue() || '', 60)}
                </div>
            ),
            footer: info => info.column.id,
        }),
        columnHelper.accessor('beneficiary', {
            header: 'Δικαιούχος',
            cell: info => (
                <div className="w-40 md:w-52" title={info.getValue()}>
                    {formatLongText(info.getValue() || '', 50)}
                </div>
            ),
            footer: info => info.column.id,
        }),
        columnHelper.accessor('totalAmount', {
            header: 'Ποσό',
            cell: info => formatAmount(info.getValue()),
            footer: info => info.column.id,
        }),
        columnHelper.accessor('dateApproved', {
            header: 'Ημερομηνία',
            cell: info => info.getValue() || '-',
            footer: info => info.column.id,
        }),
        columnHelper.accessor('category', {
            header: 'Κατηγορία',
            cell: info => {
                const category = info.getValue();
                const bgColor = category ? CategoryColors[category as Category] : DEFAULT_CATEGORY_COLOR;
                return (
                    <span
                        className="inline-block px-2 py-1 rounded-full text-xs"
                        style={{
                            backgroundColor: bgColor,
                            color: 'white'
                        }}
                    >
                        {getCategoryName(category)}
                    </span>
                );
            },
            footer: info => info.column.id,
        }),
        columnHelper.accessor('incentivesApproved', {
            header: 'Κίνητρα',
            cell: info => {
                const incentives = info.getValue();
                if (!incentives || incentives.length === 0) return '-';

                return (
                    <div className="flex flex-wrap gap-1">
                        {incentives.map((incentive: Incentive, idx: number) => (
                            idx < 2 ? (
                                <IncentiveTag key={idx} incentive={incentive} size="small" />
                            ) : idx === 2 ? (
                                <span
                                    key={idx}
                                    className="text-xs px-2 py-1 bg-gray-200 rounded-full"
                                    title={`${incentives.length - 2} ακόμη κίνητρα`}
                                >
                                    +{incentives.length - 2}
                                </span>
                            ) : null
                        ))}
                    </div>
                );
            },
            footer: info => info.column.id,
        }),
    ] as ColumnDef<Investment>[];

    const table = useReactTable({
        data: investments,
        columns,
        state: {
            globalFilter,
            rowSelection,
        },
        filterFns: {
            greekFuzzy: greekFuzzyFilter,
        },
        globalFilterFn: greekFuzzyFilter,
        onGlobalFilterChange: setGlobalFilter,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        enableFilters: true,
        enableGlobalFilter: true,
        enableMultiRowSelection: true,
        initialState: {
            pagination: {
                pageSize: 100,
            },
        },
    });

    return (
        <div>
            {/* Search and Export Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
                <div className="relative">
                    <input
                        type="text"
                        value={globalFilter ?? ''}
                        onChange={e => setGlobalFilter(e.target.value)}
                        className="p-2 pl-8 border border-gray-300 rounded-md w-full md:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Αναζήτηση..."
                    />
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                <button
                    onClick={onExportCSV}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                    Εξαγωγή CSV
                </button>
            </div>

            {/* Table for larger screens */}
            <div className="hidden md:block overflow-x-auto rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <th
                                        key={header.id}
                                        scope="col"
                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                    >
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext()
                                            )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {table.getRowModel().rows.map(row => {
                            const isExpanded = isRowExpanded(row.id);
                            const investment = row.original;

                            return (
                                <React.Fragment key={row.id}>
                                    <tr
                                        className={`${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'} cursor-pointer`}
                                        onClick={() => toggleRowExpanded(row.id)}
                                        id={`investment-${getInvestmentId(investment).replace(/:/g, '-')}`}
                                    >
                                        {row.getVisibleCells().map(cell => (
                                            <td
                                                key={cell.id}
                                                className="px-6 py-4 text-sm text-gray-500"
                                            >
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </td>
                                        ))}
                                    </tr>

                                    {isExpanded && (
                                        <tr>
                                            <td colSpan={columns.length} className="px-6 py-4">
                                                <DetailView investment={investment} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Card view for mobile screens */}
            <div className="md:hidden space-y-4">
                {table.getRowModel().rows.map(row => {
                    const isExpanded = isRowExpanded(row.id);
                    const investment = row.original;

                    return (
                        <div key={row.id} className="bg-white rounded-lg shadow overflow-hidden">
                            <div
                                className="p-3 cursor-pointer border-b border-gray-200"
                                onClick={() => toggleRowExpanded(row.id)}
                            >
                                <h3
                                    className="font-medium line-clamp-2"
                                    title={investment.name}
                                >
                                    {investment.name}
                                </h3>

                                <div className="mt-2 flex justify-between items-start">
                                    <div className="flex-1 mr-4">
                                        <div className="text-sm text-gray-500">Δικαιούχος</div>
                                        <div
                                            className="text-sm font-medium line-clamp-2"
                                            title={investment.beneficiary}
                                        >
                                            {investment.beneficiary}
                                        </div>
                                    </div>

                                    <div className="text-right flex-shrink-0">
                                        <div className="text-sm text-gray-500">Ποσό</div>
                                        <div className="text-sm font-bold">{formatAmount(investment.totalAmount)}</div>
                                    </div>
                                </div>

                                <div className="mt-2 flex justify-between items-center">
                                    <div>
                                        <div className="text-sm text-gray-500">Ημερομηνία</div>
                                        <div className="text-sm">{investment.dateApproved || '-'}</div>
                                    </div>

                                    <div>
                                        <div className="text-sm text-gray-500">Κατηγορία</div>
                                        <span
                                            className="inline-block px-2 py-1 rounded-full text-xs"
                                            style={{
                                                backgroundColor: investment.category ? CategoryColors[investment.category as Category] : DEFAULT_CATEGORY_COLOR,
                                                color: 'white'
                                            }}
                                        >
                                            {getCategoryName(investment.category)}
                                        </span>
                                    </div>
                                </div>

                                {investment.incentivesApproved && investment.incentivesApproved.length > 0 && (
                                    <div className="mt-2">
                                        <div className="text-sm text-gray-500 mb-1">Κίνητρα</div>
                                        <div className="flex flex-wrap gap-1">
                                            {investment.incentivesApproved.map((incentive: Incentive, idx: number) => (
                                                idx < 2 ? (
                                                    <IncentiveTag key={idx} incentive={incentive} size="small" />
                                                ) : idx === 2 ? (
                                                    <span
                                                        key={idx}
                                                        className="text-xs px-2 py-1 bg-gray-200 rounded-full"
                                                        title={`${investment.incentivesApproved.length - 2} ακόμη κίνητρα`}
                                                    >
                                                        +{investment.incentivesApproved.length - 2}
                                                    </span>
                                                ) : null
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-3 text-center text-xs text-gray-500">
                                    {isExpanded ? 'Πατήστε για απόκρυψη λεπτομερειών' : 'Πατήστε για προβολή λεπτομερειών'}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="p-0">
                                    <DetailView investment={investment} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4 flex-wrap gap-4">
                <div className="flex items-center gap-2">
                    <button
                        className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                    >
                        {'<<'}
                    </button>
                    <button
                        className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        {'<'}
                    </button>
                    <button
                        className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        {'>'}
                    </button>
                    <button
                        className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                    >
                        {'>>'}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">
                        Σελίδα <strong>{table.getState().pagination.pageIndex + 1}</strong> από{' '}
                        <strong>{table.getPageCount()}</strong>
                    </span>

                    <select
                        className="px-2 py-1 border border-gray-300 rounded-md"
                        value={table.getState().pagination.pageSize}
                        onChange={e => {
                            table.setPageSize(Number(e.target.value));
                        }}
                    >
                        {[10, 20, 30, 50].map(pageSize => (
                            <option key={pageSize} value={pageSize}>
                                {pageSize} ανά σελίδα
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
};

export default InvestmentTable; 