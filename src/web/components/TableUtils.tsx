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

/**
 * Generate a universal identifier for an investment
 * This handles cases where the investment doesn't have a Diavgeia ADA
 * @param investment The investment object
 * @returns A string identifier that's unique for the investment
 */
export const getInvestmentId = (investment: Investment): string => {
    // First try to use the Diavgeia ADA if available
    if (investment.reference?.diavgeiaADA) {
        return `ada:${investment.reference.diavgeiaADA}`;
    }

    // Next try to use ministry URL if available
    if (investment.reference?.ministryUrl) {
        // Create a shorter ID by hashing the URL
        const urlHash = hashString(investment.reference.ministryUrl);
        return `url:${urlHash}`;
    }

    // As a fallback, create a hash from the name, beneficiary, and amount
    const hashInput = `${investment.name}|${investment.beneficiary}|${investment.totalAmount}`;
    return `hash:${hashString(hashInput)}`;
};

/**
 * Parse an investment ID into its components
 * @param id The investment ID string
 * @returns Object with type and value
 */
export const parseInvestmentId = (id: string): { type: string, value: string } => {
    const parts = id.split(':');
    if (parts.length === 2) {
        return {
            type: parts[0],
            value: parts[1]
        };
    }
    return { type: 'unknown', value: id };
};

/**
 * Find an investment by ID
 * @param id The investment ID
 * @param investments Array of investments to search
 * @returns The matching investment or undefined
 */
export const findInvestmentById = (id: string, investments: Investment[]): Investment | undefined => {
    const { type, value } = parseInvestmentId(id);

    switch (type) {
        case 'ada':
            return investments.find(inv => inv.reference?.diavgeiaADA === value);

        case 'url':
            // Find by URL hash
            return investments.find(inv => {
                if (!inv.reference?.ministryUrl) return false;
                const urlHash = hashString(inv.reference.ministryUrl);
                return urlHash === value;
            });

        case 'hash':
            // Find by combined hash
            return investments.find(inv => {
                const hashInput = `${inv.name}|${inv.beneficiary}|${inv.totalAmount}`;
                return hashString(hashInput) === value;
            });

        default:
            return undefined;
    }
};

/**
 * Create a link to an investment detail view
 * @param investment The investment object
 * @returns URL hash for linking to the investment
 */
export const createInvestmentLink = (investment: Investment): string => {
    const id = getInvestmentId(investment);
    return `#/table/investment/${encodeURIComponent(id)}`;
};

/**
 * Simple string hashing function
 * @param str String to hash
 * @returns A string hash
 */
function hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();

    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // Make hash positive and convert to base36 for shorter strings
    return Math.abs(hash).toString(36);
}

/**
 * Format a date string in Greek locale format
 * @param dateStr ISO date string (YYYY-MM-DD)
 * @returns Formatted date string in Greek locale (DD/MM/YYYY)
 */
export const formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '-';

    try {
        const date = new Date(dateStr);

        // Check if date is valid
        if (isNaN(date.getTime())) return dateStr;

        // Format the date in Greek locale
        return date.toLocaleDateString('el-GR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        // If any error occurs parsing the date, return the original string
        return dateStr;
    }
}; 