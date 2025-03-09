import { Investment } from '../types/index.js';

/**
 * Warning types for investment data health checks
 */
export enum WarningType {
    MISSING_LOCATION_COORDS = 'MISSING_LOCATION_COORDS',
    FUNDING_SOURCES_SUM_MISMATCH = 'FUNDING_SOURCES_SUM_MISMATCH',
    AMOUNT_BREAKDOWN_SUM_MISMATCH = 'AMOUNT_BREAKDOWN_SUM_MISMATCH',
    TOTAL_AMOUNT_ZERO = 'TOTAL_AMOUNT_ZERO',
    MISSING_DIAVGEIA_ADA = 'MISSING_DIAVGEIA_ADA'
}

/**
 * Data health warning
 */
export interface DataHealthWarning {
    type: WarningType;
    message: string;
    details?: any;
}

/**
 * Check if an investment has missing or inconsistent data
 * @param investment The investment to check
 * @returns Array of data health warnings
 */
export function checkInvestmentHealth(investment: Investment): DataHealthWarning[] {
    // Handle case of undefined or null investment
    if (!investment) {
        return [{
            type: WarningType.TOTAL_AMOUNT_ZERO,
            message: 'Investment object is undefined or null'
        }];
    }

    const warnings: DataHealthWarning[] = [];

    // Check for missing location coordinates
    if (Array.isArray(investment.locations) && investment.locations.length > 0) {
        const locationsWithMissingCoords = investment.locations.filter(
            loc => loc && loc.textLocation && (!loc.lat || !loc.lon)
        );

        if (locationsWithMissingCoords.length > 0) {
            warnings.push({
                type: WarningType.MISSING_LOCATION_COORDS,
                message: `${locationsWithMissingCoords.length}/${investment.locations.length} locations missing coordinates`,
                details: locationsWithMissingCoords.map(loc => loc.textLocation)
            });
        }
    }

    // Check if the total amount is zero
    if (!investment.totalAmount || investment.totalAmount === 0) {
        warnings.push({
            type: WarningType.TOTAL_AMOUNT_ZERO,
            message: 'Total investment amount is zero or not specified'
        });
    }

    // Check if amount breakdown adds up to total
    if (Array.isArray(investment.amountBreakdown) &&
        investment.amountBreakdown.length > 0 &&
        investment.totalAmount &&
        investment.totalAmount > 0) {

        const breakdownSum = investment.amountBreakdown.reduce(
            (sum, item) => sum + (item && typeof item.amount === 'number' ? item.amount : 0),
            0
        );

        // Allow for small rounding differences (0.01% tolerance)
        const tolerance = investment.totalAmount * 0.0001;

        if (Math.abs(breakdownSum - investment.totalAmount) > tolerance) {
            warnings.push({
                type: WarningType.AMOUNT_BREAKDOWN_SUM_MISMATCH,
                message: `Amount breakdown sum (${breakdownSum}) doesn't match total amount (${investment.totalAmount})`,
                details: {
                    breakdown: investment.amountBreakdown,
                    breakdownSum,
                    totalAmount: investment.totalAmount,
                    difference: breakdownSum - investment.totalAmount
                }
            });
        }
    }

    // Check for missing or empty Diavgeia ADA
    if (!investment.reference || !investment.reference.diavgeiaADA) {
        warnings.push({
            type: WarningType.MISSING_DIAVGEIA_ADA,
            message: 'Diavgeia ADA code is missing or empty'
        });
    }

    // Check if funding sources add up to total
    if (Array.isArray(investment.fundingSource) &&
        investment.fundingSource.length > 0 &&
        investment.totalAmount &&
        investment.totalAmount > 0) {

        // First check if we have percentages
        const fundingSourcesWithPerc = investment.fundingSource.filter(fs => fs && fs.perc !== undefined);

        if (fundingSourcesWithPerc.length === investment.fundingSource.length) {
            // All funding sources have percentages, so check if they add up to 1 (100%)
            const percSum = fundingSourcesWithPerc.reduce(
                (sum, fs) => sum + (fs && typeof fs.perc === 'number' ? fs.perc : 0),
                0
            );

            // Allow for small rounding differences (1% tolerance)
            if (Math.abs(percSum - 1) > 0.01) {
                warnings.push({
                    type: WarningType.FUNDING_SOURCES_SUM_MISMATCH,
                    message: `Funding source percentages sum to ${percSum * 100}% instead of 100%`,
                    details: {
                        fundingSources: fundingSourcesWithPerc,
                        percSum,
                        difference: percSum - 1
                    }
                });
            }
        } else {
            // Check absolute amounts
            const fundingSourcesWithAmount = investment.fundingSource.filter(fs => fs && fs.amount !== undefined);

            if (fundingSourcesWithAmount.length === investment.fundingSource.length) {
                const amountSum = fundingSourcesWithAmount.reduce(
                    (sum, fs) => sum + (fs && typeof fs.amount === 'number' ? fs.amount : 0),
                    0
                );

                // Allow for small rounding differences (0.01% tolerance)
                const tolerance = investment.totalAmount * 0.0001;

                if (Math.abs(amountSum - investment.totalAmount) > tolerance) {
                    warnings.push({
                        type: WarningType.FUNDING_SOURCES_SUM_MISMATCH,
                        message: `Funding source amounts sum (${amountSum}) doesn't match total amount (${investment.totalAmount})`,
                        details: {
                            fundingSources: fundingSourcesWithAmount,
                            amountSum,
                            totalAmount: investment.totalAmount,
                            difference: amountSum - investment.totalAmount
                        }
                    });
                }
            }
        }
    }

    return warnings;
}

/**
 * Count warnings by type across multiple investments
 * @param investments Array of investments to check
 * @returns Object with counts by warning type
 */
export function countWarningsByType(investments: Investment[]): Record<WarningType, number> {
    const counts: Record<WarningType, number> = {
        [WarningType.MISSING_LOCATION_COORDS]: 0,
        [WarningType.FUNDING_SOURCES_SUM_MISMATCH]: 0,
        [WarningType.AMOUNT_BREAKDOWN_SUM_MISMATCH]: 0,
        [WarningType.TOTAL_AMOUNT_ZERO]: 0,
        [WarningType.MISSING_DIAVGEIA_ADA]: 0
    };

    if (!Array.isArray(investments)) {
        return counts;
    }

    investments.forEach(investment => {
        if (investment) {
            const warnings = checkInvestmentHealth(investment);
            warnings.forEach(warning => {
                counts[warning.type]++;
            });
        }
    });

    return counts;
} 