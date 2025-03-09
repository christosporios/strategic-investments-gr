import axios from 'axios';
import { CollectDataParams } from '../types/index.js';

/**
 * Check if a decision is a revision of a previous one
 * @param decision Decision object from Diavgeia API
 * @returns Object with isRevision flag and the ADA of the revised decision if applicable
 */
export async function checkIfRevision(decision: any): Promise<{ isRevision: boolean, revisesADA?: string }> {
    // Check if the subject contains keywords indicating a revision
    const revisionKeywords = [
        'Τροποποίηση', 'τροποποίηση', // Amendment
        'Διόρθωση', 'διόρθωση',       // Correction
        'Ανάκληση', 'ανάκληση',       // Revocation
        'Αντικατάσταση', 'αντικατάσταση', // Replacement
        'Ορθή επανάληψη', 'ορθή επανάληψη' // Correct repetition
    ];

    const isRevisionBySubject = decision.subject &&
        revisionKeywords.some(keyword => decision.subject.includes(keyword));

    // Check if correctedVersionId exists in the metadata
    const hasCorrectingId = !!decision.correctedVersionId;

    // Check if it's explicitly marked as a corrected version in extraFieldValues
    const isExplicitlyMarkedAsRevision = decision.extraFieldValues &&
        (decision.extraFieldValues.relatedDecisions &&
            decision.extraFieldValues.relatedDecisions.length > 0);

    const isRevision = isRevisionBySubject || hasCorrectingId || isExplicitlyMarkedAsRevision;

    // If it's a potential revision based on initial checks, we need to get more details
    if (isRevision) {
        try {
            // Extract references to previous decisions from the subject
            let revisedADA: string | undefined;

            // First check if there are explicit related decisions in the metadata
            if (isExplicitlyMarkedAsRevision &&
                decision.extraFieldValues.relatedDecisions &&
                decision.extraFieldValues.relatedDecisions.length > 0) {

                // Take the first related decision's ADA as the one being revised
                revisedADA = decision.extraFieldValues.relatedDecisions[0];
            }

            // If not found in metadata, try extracting from subject
            if (!revisedADA && isRevisionBySubject) {
                // Try to extract the ADA from the subject if it's mentioned
                // ADA format: 10 characters of Greek uppercase letters and digits
                const adaPattern = /[ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ0-9]{10}/g;
                const adaMatches = decision.subject.match(adaPattern);

                if (adaMatches && adaMatches.length > 0) {
                    // First match might be our ADA, so look for others
                    const potentialADAs = adaMatches.filter((ada: string) => ada !== decision.ada);
                    if (potentialADAs.length > 0) {
                        revisedADA = potentialADAs[0];
                    }
                }

                // If we didn't find an ADA, try to find a protocol number reference
                if (!revisedADA) {
                    // Look for a protocol number pattern like "υπ' αριθμ. 12345" or similar
                    const protocolPattern = /υπ['\s]+(αρ|αριθ|αριθμ)[.\s]+(\d+)/i;
                    const protocolMatch = decision.subject.match(protocolPattern);

                    if (protocolMatch && protocolMatch[2]) {
                        const protocolNumber = protocolMatch[2];
                        // We found a protocol number but not an ADA, so we'll just log it
                        console.log(`Found protocol number reference in subject: ${protocolNumber}, but could not determine ADA`);
                    }
                }
            }

            // If we couldn't find it in the subject and there's a correctedVersionId,
            // try to get more info from the API
            if (!revisedADA && hasCorrectingId) {
                try {
                    // Get the corrected version to find its ADA
                    const response = await axios.get(`https://diavgeia.gov.gr/luminapi/api/decisions/version/${decision.correctedVersionId}`);
                    if (response.data && response.data.ada) {
                        revisedADA = response.data.ada;
                    }
                } catch (error) {
                    console.warn(`Could not fetch corrected version for ID ${decision.correctedVersionId}`, error);
                }
            }

            if (revisedADA) {
                return {
                    isRevision: true,
                    revisesADA: revisedADA
                };
            } else {
                console.warn(`Decision ${decision.ada} appears to be a revision, but could not determine which decision it revises`);
                return { isRevision: true };
            }
        } catch (error) {
            console.error(`Error checking if decision ${decision.ada} is a revision:`, error);
            // Consider it a revision even if we couldn't get details
            return { isRevision: true };
        }
    }

    return { isRevision: false };
}

/**
 * Query Diavgeia API for strategic investments
 * @param params Collection parameters including optional date range
 * @returns Array of decisions from the API
 */
export async function queryDiavgeiaAPI(params: CollectDataParams): Promise<any[]> {
    try {
        // Use the specific endpoint for strategic investments from Ministry of Development
        const queryParams = new URLSearchParams();

        // Use the specific organization and unit IDs
        queryParams.append('q', 'organizationUid:100081597'); // Ministry of Development
        queryParams.append('fq', 'unitUid:100007316'); // Specific unit for strategic investments

        // Add date filters if provided
        if (params.startDate) {
            queryParams.append('from_date', params.startDate);
        } else {
            // Default to last 10 years if no date provided
            const tenYearsAgo = new Date();
            tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
            queryParams.append('from_date', tenYearsAgo.toISOString().split('T')[0]);
        }
        if (params.endDate) {
            queryParams.append('to_date', params.endDate);
        }

        // Set page and sort by recent
        queryParams.append('page', '0');
        queryParams.append('sort', 'recent');

        // Set size to get more results
        queryParams.append('size', '100');

        console.log(`Searching with query: ${queryParams.toString()}`);

        // Make the API request
        const response = await axios.get(`https://diavgeia.gov.gr/luminapi/api/search?${queryParams.toString()}`);

        // Log the total number of results found
        console.log(`Total results found: ${response.data.info.total}`);

        return response.data.decisions || [];
    } catch (error) {
        console.error('Error querying Diavgeia API:', error);
        return [];
    }
} 