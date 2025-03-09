import { FilterFn, RowData } from '@tanstack/react-table';
import { Investment } from '../../types';

// Normalize Greek text for case-insensitive and accent-insensitive searching
export const normalizeGreekText = (text: string): string => {
    if (!text) return '';

    // Convert to lowercase
    let normalized = text.toLowerCase();

    // Replace Greek accented characters with their non-accented equivalents
    const accentMap: Record<string, string> = {
        'ά': 'α', 'έ': 'ε', 'ή': 'η', 'ί': 'ι', 'ό': 'ο', 'ύ': 'υ', 'ώ': 'ω',
        'ϊ': 'ι', 'ϋ': 'υ', 'ΐ': 'ι', 'ΰ': 'υ'
    };

    for (const accent in accentMap) {
        normalized = normalized.replace(new RegExp(accent, 'g'), accentMap[accent]);
    }

    return normalized;
};

// Greek-aware fuzzy filter for table search
export const greekFuzzyFilter: FilterFn<any> = (row, columnId, filterValue, addMeta) => {
    // Normalize filter value
    const normalizedFilterValue = normalizeGreekText(filterValue);

    // Get value from row
    const getValue = (obj: any, path: string) => {
        const keys = path.split('.');
        let value = obj;
        for (const key of keys) {
            if (value === null || value === undefined) return '';
            value = value[key];
        }
        return value;
    };

    // Special case for nested values
    let value;
    if (columnId.includes('.')) {
        value = getValue(row.original, columnId);
    } else {
        value = row.getValue(columnId);
    }

    // Handle various types of values
    if (typeof value === 'number') {
        value = value.toString();
    }

    if (typeof value === 'string') {
        const normalizedValue = normalizeGreekText(value);
        return normalizedValue.includes(normalizedFilterValue);
    }

    // Handle arrays like incentivesApproved
    if (Array.isArray(value)) {
        return value.some((item: any) => {
            if (typeof item === 'string') {
                return normalizeGreekText(item).includes(normalizedFilterValue);
            }
            if (item && typeof item === 'object' && 'name' in item) {
                return normalizeGreekText(item.name).includes(normalizedFilterValue);
            }
            return false;
        });
    }

    return false;
};

// Convert investment data to CSV format for download
export const convertToCSV = (data: Investment[]): string => {
    if (data.length === 0) return '';

    // Define CSV headers
    const headers = [
        'Όνομα Επένδυσης',
        'Δικαιούχος',
        'Ημ/νία Έγκρισης',
        'Συνολικό Ποσό (€)',
        'Κατηγορία',
        'Κίνητρα',
        'Τοποθεσίες',
        'Πηγές Χρηματοδότησης',
        'Αναφορά ΦΕΚ',
        'ADA Διαύγειας'
    ];

    // Convert each investment to a CSV row
    const rows = data.map(inv => {
        // Format incentives
        const incentives = inv.incentivesApproved
            ? inv.incentivesApproved.map(inc => inc.name).join('; ')
            : '';

        // Format locations
        const locations = inv.locations
            ? inv.locations.map(loc => `${loc.description}: ${loc.textLocation || ''}`).join('; ')
            : '';

        // Format funding sources
        const fundingSources = inv.fundingSource
            ? inv.fundingSource.map(src => {
                const parts = [];
                parts.push(src.source);
                if (src.perc) parts.push(`${(src.perc * 100).toFixed(1)}%`);
                if (src.amount) parts.push(`€${src.amount}`);
                return parts.join(' ');
            }).join('; ')
            : '';

        return [
            inv.name || '',
            inv.beneficiary || '',
            inv.dateApproved || '',
            inv.totalAmount ? inv.totalAmount.toString() : '0',
            inv.category || '',
            incentives,
            locations,
            fundingSources,
            inv.reference?.fek || '',
            inv.reference?.diavgeiaADA || ''
        ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
    });

    // Combine headers and rows
    return [headers.join(','), ...rows].join('\n');
};

// Function to download CSV file
export const downloadCSV = (csvContent: string, filename: string): void => {
    // Create a blob with the CSV content
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });

    // Create a temporary URL for the blob
    const url = window.URL.createObjectURL(blob);

    // Create a link element
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);

    // Append to the document, click it, and remove it
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL
    window.URL.revokeObjectURL(url);
};

// Create a URL for the Diavgeia decision
export const createDiavgeiaURL = (ada: string): string => {
    return `https://diavgeia.gov.gr/decision/view/${encodeURIComponent(ada)}`;
}; 