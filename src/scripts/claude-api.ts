import Anthropic from '@anthropic-ai/sdk';
import { Investment } from '../types/index.js';
import { IncentiveType, Category } from '../types/constants.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Claude model to use
export const MODEL = 'claude-3-7-sonnet-20250219';

/**
 * Get the Anthropic client instance with the API key from environment
 * This ensures we always get a fresh instance with the current API key
 */
export function getAnthropicClient() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
    }

    return new Anthropic({ apiKey });
}

/**
 * Sleep/delay utility function
 * @param ms Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Filter decisions that are about "Έγκριση χορήγησης κινήτρων" using Claude
 * @param decisions Array of decisions from Diavgeia API
 * @returns Filtered array of relevant decisions
 */
export async function filterRelevantDecisions(decisions: any[]): Promise<any[]> {
    console.log(`Filtering ${decisions.length} decisions to find Έγκριση χορήγησης κινήτρων...`);

    // Prepare metadata for Claude to analyze
    const decisionMetadata = decisions.map(d => {
        // Safely parse the date
        let formattedDate = '';
        try {
            if (d.issueDate) {
                // Try to parse the date, but handle different formats
                const dateObj = new Date(d.issueDate);
                if (!isNaN(dateObj.getTime())) {
                    formattedDate = dateObj.toISOString().split('T')[0];
                } else {
                    formattedDate = d.issueDate; // Keep original if can't parse
                }
            }
        } catch (e) {
            console.log(`Date parsing error for ${d.ada}: ${e}`);
            formattedDate = 'N/A';
        }

        // Include revision information if available
        const metadata: any = {
            ada: d.ada,
            subject: d.subject,
            protocolNumber: d.protocolNumber,
            url: d.documentUrl,
            organization: d.organization?.label || d.organizationId || 'Unknown',
            issueDate: formattedDate,
            // Add revision-related fields if they exist
            correctedVersionId: d.correctedVersionId || null,
            revisesADA: d.revisesADA || null
        };

        // Include related decisions if they exist in extraFieldValues
        if (d.extraFieldValues && d.extraFieldValues.relatedDecisions && d.extraFieldValues.relatedDecisions.length > 0) {
            metadata.relatedDecisions = d.extraFieldValues.relatedDecisions;
        }

        return metadata;
    });

    // Get a fresh client instance
    const client = getAnthropicClient();

    // Use Claude to filter relevant decisions
    const message = await client.messages.create({
        model: MODEL,
        max_tokens: 1000,
        temperature: 0,
        system: "You are an expert in Greek administrative documents, particularly those related to strategic investments and incentives. You can identify when a document is a revision or amendment of an earlier decision.",
        messages: [
            {
                role: "user",
                content: `I need to identify decisions that are specifically about "Έγκριση χορήγησης κινήτρων" (Approval of Incentives) for strategic investments. Please analyze the following list of document metadata from Diavgeia, and return ONLY the ADA codes (in an array format) for documents that are likely about approving incentives for strategic investments.

IMPORTANT: If there are multiple versions of the same decision (indicated by subjects containing words like "Τροποποίηση", "τροποποίηση", "Διόρθωση", "διόρθωση", "Ανάκληση", "ανάκληση", "Αντικατάσταση", "αντικατάσταση", "Ορθή επανάληψη", or "ορθή επανάληψη"), ONLY include the most recent version and exclude the older version(s) that have been revised or amended. This is to prevent double-counting the same investment.

${JSON.stringify(decisionMetadata, null, 2)}

Return your answer as a valid JSON array containing only the ADA codes of relevant documents, like this: ["ADA1", "ADA2"]`
            }
        ]
    });

    // Extract the ADA codes from Claude's response
    try {
        const responseContent = message.content.find(block => block.type === 'text');
        if (!responseContent || responseContent.type !== 'text') {
            throw new Error("No text content in Claude's response");
        }

        const jsonResponse = responseContent.text.trim();
        // Extract JSON array from the response (it might be wrapped in code blocks or other text)
        const jsonMatch = jsonResponse.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error("No JSON array found in Claude's response");
        }

        const relevantADAs = JSON.parse(jsonMatch[0]);
        console.log(`Found ${relevantADAs.length} relevant decisions about incentive approvals`);

        // Check if any decisions with revision markers were excluded
        const possibleOlderVersions = decisions.filter(d =>
            !relevantADAs.includes(d.ada) &&
            d.subject && (
                d.subject.includes('Τροποποίηση') ||
                d.subject.includes('τροποποίηση') ||
                d.subject.includes('Διόρθωση') ||
                d.subject.includes('διόρθωση') ||
                d.revisesADA ||
                d.correctedVersionId
            )
        );

        if (possibleOlderVersions.length > 0) {
            console.log(`\n🧠 Claude appears to have excluded ${possibleOlderVersions.length} possible older version(s) of decisions:`);
            possibleOlderVersions.forEach(d => {
                console.log(`  • ${d.ada}: ${d.subject?.substring(0, 50)}${d.subject?.length > 50 ? '...' : ''}`);
            });
        }

        // Filter the original decisions array to get only the relevant ones
        return decisions.filter(d => relevantADAs.includes(d.ada));
    } catch (error) {
        console.error('Error parsing Claude response:', error);
        console.log('Claude response:', message.content);
        return [];
    }
}

/**
 * Extract investment data from a decision using Claude
 * @param decision Decision object from Diavgeia API
 * @returns Structured Investment data or null if extraction failed
 */
export async function extractInvestmentData(decision: any): Promise<Investment | null> {
    const maxRetries = 5;
    let retryCount = 0;
    let backoffTime = 2000; // Start with 2 seconds

    while (retryCount <= maxRetries) {
        try {
            // Truncate long titles to 50 characters and always include ADA
            const truncatedSubject = decision.subject ?
                (decision.subject.length > 50 ? decision.subject.substring(0, 50) + '...' : decision.subject) :
                'No subject';

            console.log(`Extracting data [${decision.ada}]: "${truncatedSubject}"`);

            // Prepare detailed context about the document
            const decisionContext = {
                ada: decision.ada,
                documentUrl: decision.documentUrl,
                subject: decision.subject,
                protocolNumber: decision.protocolNumber,
                organization: decision.organization?.label || 'Unknown',
                issueDate: decision.issueDate,
                decisionType: decision.decisionType?.label || 'Unknown',
                correctedVersionId: decision.correctedVersionId,
                revisesADA: decision.revisesADA  // Add this field if it exists
            };

            // Get a fresh client instance
            const client = getAnthropicClient();

            // Use Claude to extract structured data from the PDF
            const message = await client.messages.create({
                model: MODEL,
                max_tokens: 8192,
                temperature: 0,
                system: "You are an expert in Greek administrative documents, particularly those related to strategic investments and incentives. Your primary task is to extract accurate information, with special attention to financial data like the total investment amount. Search thoroughly throughout the document for these details, as they're critical for analysis. Analyze all sections of the document where financial information might appear.",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "document",
                                source: {
                                    type: "url",
                                    url: decision.documentUrl
                                }
                            },
                            {
                                type: "text",
                                text: `Please analyze this strategic investment incentive approval document and extract the following data in the exact format specified:

Document Context:
${JSON.stringify(decisionContext, null, 2)}

Extract these fields:
1. Date approved (dateApproved): Date in YYYY-MM-DD format
2. Beneficiary company (beneficiary): Full name of the company
3. Name of the investment project (name): Full project name

4. Total amount in euros (totalAmount): Number with no formatting
   - CRITICAL: The total amount is one of the most important pieces of information
   - Search the entire document for mentions of the total investment cost/amount
   - Look for phrases like "συνολικό κόστος", "συνολικό ποσό επένδυσης", "προϋπολογισμός επένδυσης"
   - Ensure you extract just the number with no currency symbols or formatting
   - This should be the total cost of the investment, not funding amounts or incentives
   - If you find multiple amounts, choose the one explicitly labeled as the total investment amount

5. References:
   - Government Gazette reference (fek): Exact FEK reference in the format "ΦΕΚ [SERIES]/[NUMBER]/[DATE]" (e.g., "ΦΕΚ Β' 123/15.07.2023")
   - Diavgeia ADA (diavgeiaADA): The ADA code

6. Amount breakdown (amountBreakdown): List of {amount: number, description: string}
   - This should capture how the money will be spent (NOT the funding sources)
   - Only include the first-level breakdown categories
   - The amounts should add up to the total amount
   - Example: [{amount: 10000000, description: "Construction costs"}, {amount: 5000000, description: "Equipment"}]

7. Locations (locations): List of {description: string, textLocation: string}
   - List each location where the investment will be built/established
   - 'description' field should describe what will be built in that location (e.g., "hotel", "factory", "marina")
   - 'textLocation' field should contain the address or verbal description of the place
   - IMPORTANT: Format the textLocation in a way that helps geocoding:
     * Include city, municipality, or region names
     * Use proper spelling and include postal codes if available
     * Include full address when possible (street, number, city, region)
     * Avoid abbreviations and use standard place names
     * Format: "Street Name Number, City, Region, Postal Code, Greece"
   - Example: [{description: "Main hotel complex", textLocation: "Λεωφόρος Ποσειδώνος 10, Γλυφάδα, Αττική, 16674, Greece"}]

8. Funding source (fundingSource): List of {source: string, perc?: number, amount?: number}
   - This should list how the project will be funded
   - 'source' is the name of the funding source (e.g., "Ίδια κεφάλαια", "Τραπεζικός δανεισμός")
   - 'perc' is the percentage of total funding (e.g., 0.7 for 70%) if specified
   - 'amount' is the absolute amount if specified instead of percentage
   - If both percentage and amount are specified, prioritize using percentage
   - Example: [{source: "Ίδια κεφάλαια", perc: 0.3}, {source: "Τραπεζικός δανεισμός", perc: 0.7}]

9. Incentives approved (incentivesApproved): List of {name: string, incentiveType?: string}
   - List all incentives that were approved in the document
   - Classify each incentive according to these predefined types:
     * FAST_TRACK_LICENSING: For fast-track or expedited licensing procedures
     * SPECIAL_ZONING: For special zoning arrangements or location incentives
     * TAX_RATE_FREEZE: For freezing tax rates for a period
     * TAX_EXEMPTION: For tax exemptions or reductions
     * ACCELERATED_DEPRECIATION: For accelerated depreciation allowances
     * INVESTMENT_GRANT: For direct grants or subsidies on the investment
     * LEASING_SUBSIDY: For leasing subsidies
     * EMPLOYMENT_COST_SUBSIDY: For subsidies related to employment costs
     * AUDITOR_MONITORING: For auditor monitoring benefits
     * SHORELINE_USE: For shoreline use rights
     * EXPROPRIATION_SUPPORT: For support with expropriation procedures
   - Assign the most appropriate type based on the description in the document
   - A single incentive can only have one type
   - If the incentive doesn't clearly match any type, omit the incentiveType field
   - Example: [{name: "Φορολογικές απαλλαγές", incentiveType: "TAX_EXEMPTION"}, {name: "Επιτάχυνση αδειοδότησης", incentiveType: "FAST_TRACK_LICENSING"}]

10. Category (category): One of the following strings that best describes the investment's sector:
   - PRODUCTION_MANUFACTURING: For investments in production facilities, factories, manufacturing, processing, construction, energy production, or similar industrial activities (Παραγωγή & Μεταποίηση)
   - TECHNOLOGY_INNOVATION: For investments in technology companies, R&D centers, software development, telecommunications, digital services, or innovative projects (Τεχνολογία & Καινοτομία) 
   - TOURISM_CULTURE: For investments in hotels, resorts, tourism facilities, cultural venues, entertainment facilities, or heritage sites (Τουρισμός & Πολιτισμός)
   - SERVICES_EDUCATION: For investments in service sector, educational institutions, training centers, or business services (Υπηρεσίες & Εκπαίδευση)
   - HEALTHCARE_WELFARE: For investments in hospitals, clinics, care facilities, medical centers, or social welfare projects (Υγεία & Κοινωνική Μέριμνα)
   - You MUST select EXACTLY ONE category that best matches the investment
   - Base your classification on the project description, activities, and purpose described in the document
   - Example: "TOURISM_CULTURE"

IMPORTANT:
- Make your best effort to find ALL requested information, especially the total amount
- If information is unclear or appears in multiple places, choose the most authoritative occurrence
- Return ONLY the exact data structure specified with no additional text or explanations
- Do not leave the total amount as 0 unless you are absolutely certain it's not mentioned anywhere in the document`
                            }
                        ]
                    }
                ]
            });

            // Extract the JSON from Claude's response
            try {
                const responseContent = message.content.find(block => block.type === 'text');
                if (!responseContent || responseContent.type !== 'text') {
                    throw new Error("No text content in Claude's response");
                }

                const jsonResponse = responseContent.text.trim();
                // Extract JSON object from the response
                const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error("No JSON object found in Claude's response");
                }

                const investmentData = JSON.parse(jsonMatch[0]) as Investment;

                // Ensure reference object exists
                if (!investmentData.reference) {
                    investmentData.reference = {
                        fek: '',
                        diavgeiaADA: decision.ada || '' // Use the ADA from the decision
                    };
                }

                // Ensure diavgeiaADA exists
                if (!investmentData.reference.diavgeiaADA) {
                    investmentData.reference.diavgeiaADA = decision.ada || '';
                }

                // Standardize FEK reference format if it exists
                if (investmentData.reference?.fek) {
                    // If it doesn't already start with "ΦΕΚ", add it
                    if (!investmentData.reference.fek.startsWith("ΦΕΚ")) {
                        investmentData.reference.fek = `ΦΕΚ ${investmentData.reference.fek}`;
                    }

                    // Ensure consistent spacing and formatting
                    investmentData.reference.fek = investmentData.reference.fek
                        .replace(/\s+/g, ' ')     // Normalize spaces
                        .replace(/ΦΕΚ\s*([^\/\s]+)\s*\/\s*(\d+)\s*\/\s*(.+)/, 'ΦΕΚ $1 $2/$3') // Format as "ΦΕΚ [SERIES] [NUMBER]/[DATE]"
                        .trim();
                }

                // If total amount is missing, try to infer it from other fields
                if (!investmentData.totalAmount && investmentData.amountBreakdown && investmentData.amountBreakdown.length > 0) {
                    // Sum up all the breakdown amounts
                    investmentData.totalAmount = investmentData.amountBreakdown.reduce(
                        (sum, item) => sum + (item && typeof item.amount === 'number' ? item.amount : 0),
                        0
                    );
                    console.log(`Inferred total amount from breakdown: ${investmentData.totalAmount}`);
                }

                // Ensure all required fields exist with defaults if necessary
                if (!investmentData.name) {
                    investmentData.name = decisionContext.subject || 'Unknown investment';
                }

                if (!investmentData.dateApproved) {
                    // Try to use the decision date
                    try {
                        const dateObj = new Date(decisionContext.issueDate);
                        if (!isNaN(dateObj.getTime())) {
                            investmentData.dateApproved = dateObj.toISOString().split('T')[0];
                        } else {
                            investmentData.dateApproved = 'Unknown';
                        }
                    } catch (e) {
                        investmentData.dateApproved = 'Unknown';
                    }
                }

                if (!investmentData.beneficiary) {
                    investmentData.beneficiary = 'Unknown';
                }

                if (!investmentData.totalAmount) {
                    investmentData.totalAmount = 0;
                }

                if (!Array.isArray(investmentData.amountBreakdown)) {
                    investmentData.amountBreakdown = [];
                }

                if (!Array.isArray(investmentData.locations)) {
                    investmentData.locations = [];
                }

                if (!Array.isArray(investmentData.fundingSource)) {
                    investmentData.fundingSource = [];
                }

                if (!Array.isArray(investmentData.incentivesApproved)) {
                    investmentData.incentivesApproved = [];
                }

                // Validate the category is one of the enum values (if provided)
                if (investmentData.category && !Object.values(Category).includes(investmentData.category as Category)) {
                    console.warn(`Invalid category value: ${investmentData.category}, setting to undefined`);
                    investmentData.category = undefined;
                }

                return investmentData;
            } catch (error) {
                console.error(`Error parsing extracted data for decision ${decision.ada}:`, error);
                console.log('Claude response:', message.content);
                return null;
            }
        } catch (error: any) {
            // Handle rate limit errors with exponential backoff
            if (error.status === 429) {
                if (retryCount < maxRetries) {
                    // Extract retry time from headers if available, or use exponential backoff
                    const retryAfter = error.headers?.['retry-after'] ?
                        parseInt(error.headers['retry-after'], 10) * 1000 :
                        backoffTime;

                    console.log(`Rate limit hit for ${decision.ada}. Retrying after ${retryAfter / 1000} seconds... (Attempt ${retryCount + 1}/${maxRetries})`);

                    await sleep(retryAfter);
                    backoffTime *= 2; // Exponential backoff
                    retryCount++;
                    continue; // Retry the operation
                } else {
                    console.error(`Maximum retries (${maxRetries}) reached for ${decision.ada}. Skipping document.`);
                }
            }

            console.error(`Error extracting data from decision ${decision.ada}:`, error);
            return null;
        }

        // If we reach here without hitting a continue, we've either succeeded or hit a non-retryable error
        break;
    }

    // If we've exhausted all retries without success
    if (retryCount > maxRetries) {
        console.error(`Failed to extract data from decision ${decision.ada} after ${maxRetries} attempts.`);
    }

    return null;
}

/**
 * Process a batch of items with rate limiting and progress reporting
 * @param items Array of items to process
 * @param batchSize Number of items to process at once
 * @param processFn Function that processes each item
 * @param onProgress Callback for progress updates
 * @returns Array of processed results
 */
export async function processBatch<T, R>(
    items: T[],
    batchSize: number,
    processFn: (item: T) => Promise<R>,
    onProgress: (completed: number, total: number) => void
): Promise<R[]> {
    const results: R[] = [];
    let processed = 0;

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        // Process items in the current batch in parallel
        const batchResults = await Promise.all(
            batch.map(async (item) => {
                const result = await processFn(item);
                processed++;
                // Don't call onProgress here - we'll do it once after batch is complete
                return result;
            })
        );

        results.push(...batchResults);

        // Call progress callback once after the entire batch is processed
        onProgress(processed, items.length);

        // Add a small delay between batches to avoid rate limits
        if (i + batchSize < items.length) {
            await sleep(1000);
        }
    }

    return results;
}

/**
 * Extract investment data from a ministry website HTML page using Claude
 * @param html HTML content of the ministry page
 * @param url URL of the ministry page
 * @param basicData Partial investment data already extracted
 * @returns Structured Investment data or null if extraction failed
 */
export async function extractMinistryInvestmentData(
    html: string,
    url: string,
    basicData: Partial<Investment>
): Promise<Investment | null> {
    const maxRetries = 5;
    let retryCount = 0;
    let backoffTime = 2000; // Start with 2 seconds

    while (retryCount <= maxRetries) {
        try {
            console.log(`Extracting data from ministry URL: ${url}`);

            // Get a fresh client instance
            const client = getAnthropicClient();

            // Use Claude to extract structured data from the HTML
            const message = await client.messages.create({
                model: MODEL,
                max_tokens: 8192,
                temperature: 0,
                system: "You are an expert in Greek strategic investments and government data. Your task is to extract structured information from HTML content of investment websites.",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `Please analyze this strategic investment webpage content and extract the following data in the exact format specified:

URL Context:
${url}

HTML Content (truncated for brevity):
${html.substring(0, 15000)}

Extract these fields:
1. Date approved (dateApproved): Date in YYYY-MM-DD format
2. Beneficiary company (beneficiary): Full name of the company 
3. Name of the investment project (name): Full project name

4. Total amount in euros (totalAmount): Number with no formatting
   - CRITICAL: The total amount is one of the most important pieces of information
   - Look for phrases like "συνολικό κόστος", "συνολικό ποσό επένδυσης", "προϋπολογισμός επένδυσης"
   - Ensure you extract just the number with no currency symbols or formatting

5. References:
   - Government Gazette reference (fek): Exact FEK reference in the format "ΦΕΚ [SERIES]/[NUMBER]/[DATE]" (e.g., "ΦΕΚ Β' 123/15.07.2023")

6. Amount breakdown (amountBreakdown): List of {amount: number, description: string}
   - This should capture how the money will be spent (NOT the funding sources)
   - Example: [{amount: 10000000, description: "Construction costs"}, {amount: 5000000, description: "Equipment"}]

7. Locations (locations): List of {description: string, textLocation: string}
   - List each location where the investment will be built/established
   - Format the textLocation in a way that helps geocoding with city, region, postal code when possible

8. Funding source (fundingSource): List of {source: string, perc?: number, amount?: number}
   - This should list how the project will be funded (eg. own funds, bank loans)

9. Incentives approved (incentivesApproved): List of {name: string, incentiveType?: string}
   - List all incentives that were approved in the document
   - Classify each incentive according to the same predefined types used for diavgeia data

10. Category (category): One of the following strings that best describes the investment's sector:
   - PRODUCTION_MANUFACTURING
   - TECHNOLOGY_INNOVATION
   - TOURISM_CULTURE
   - SERVICES_EDUCATION
   - HEALTHCARE_WELFARE
   - You MUST select EXACTLY ONE category that best matches the investment

I've already attempted to extract the following, please use this as a starting point and correct/enhance it:
${JSON.stringify(basicData, null, 2)}

IMPORTANT:
- Make your best effort to find ALL requested information
- If information is unclear or appears in multiple places, choose the most authoritative occurrence
- Return ONLY the exact data structure specified with no additional text or explanations`
                            }
                        ]
                    }
                ]
            });

            // Extract the JSON from Claude's response
            try {
                const responseContent = message.content.find(block => block.type === 'text');
                if (!responseContent || responseContent.type !== 'text') {
                    throw new Error("No text content in Claude's response");
                }

                const jsonResponse = responseContent.text.trim();
                // Extract JSON object from the response
                const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error("No JSON object found in Claude's response");
                }

                const investmentData = JSON.parse(jsonMatch[0]) as Investment;

                // Ensure reference object exists and preserves the ministryUrl
                if (!investmentData.reference) {
                    investmentData.reference = {
                        fek: '',
                        diavgeiaADA: '',
                        ministryUrl: url
                    };
                } else if (!investmentData.reference.ministryUrl) {
                    investmentData.reference.ministryUrl = url;
                }

                // Ensure all required fields exist with defaults if necessary
                if (!investmentData.dateApproved) {
                    investmentData.dateApproved = 'Unknown';
                }

                if (!investmentData.beneficiary) {
                    investmentData.beneficiary = basicData.beneficiary || 'Unknown';
                }

                if (!investmentData.name) {
                    investmentData.name = basicData.name || 'Unknown investment';
                }

                if (!investmentData.totalAmount && basicData.totalAmount) {
                    investmentData.totalAmount = basicData.totalAmount;
                } else if (!investmentData.totalAmount) {
                    investmentData.totalAmount = 0;
                }

                if (!Array.isArray(investmentData.amountBreakdown)) {
                    investmentData.amountBreakdown = [];
                }

                if (!Array.isArray(investmentData.locations)) {
                    investmentData.locations = [];
                }

                if (!Array.isArray(investmentData.fundingSource)) {
                    investmentData.fundingSource = [];
                }

                if (!Array.isArray(investmentData.incentivesApproved)) {
                    investmentData.incentivesApproved = [];
                }

                // Validate the category is one of the enum values (if provided)
                if (investmentData.category && !Object.values(Category).includes(investmentData.category as Category)) {
                    console.warn(`Invalid category value: ${investmentData.category}, setting to undefined`);
                    investmentData.category = undefined;
                }

                // Normalize funding source percentages if they are whole numbers instead of decimals
                if (investmentData.fundingSource && investmentData.fundingSource.length > 0) {
                    investmentData.fundingSource = investmentData.fundingSource.map(source => {
                        if (source.perc !== undefined && source.perc > 0) {
                            // If percentage is over 1, it's likely in whole percent format (e.g. 70 instead of 0.7)
                            if (source.perc > 1) {
                                console.log(`Normalizing funding percentage: ${source.perc} → ${source.perc / 100} for ${source.source}`);
                                source.perc = source.perc / 100;
                            }
                        }
                        return source;
                    });
                }

                return investmentData;
            } catch (error) {
                console.error(`Error parsing extracted data for ministry URL ${url}:`, error);
                console.log('Claude response:', message.content);
                return null;
            }
        } catch (error: any) {
            // Handle rate limit errors with exponential backoff
            if (error.status === 429) {
                if (retryCount < maxRetries) {
                    const retryAfter = error.headers?.['retry-after'] ?
                        parseInt(error.headers['retry-after'], 10) * 1000 :
                        backoffTime;

                    console.log(`Rate limit hit for ${url}. Retrying after ${retryAfter / 1000} seconds... (Attempt ${retryCount + 1}/${maxRetries})`);

                    await sleep(retryAfter);
                    backoffTime *= 2; // Exponential backoff
                    retryCount++;
                    continue; // Retry the operation
                } else {
                    console.error(`Maximum retries (${maxRetries}) reached for ${url}. Skipping document.`);
                }
            }

            console.error(`Error extracting data from ministry URL ${url}:`, error);
            return null;
        }

        // If we reach here without hitting a continue, we've either succeeded or hit a non-retryable error
        break;
    }

    // If we've exhausted all retries without success
    if (retryCount > maxRetries) {
        console.error(`Failed to extract data from ministry URL ${url} after ${maxRetries} attempts.`);
    }

    return null;
}

/**
 * Deduplicate investments using Claude to compare and identify duplicates
 * @param diavgeiaInvestments Investments from Diavgeia API
 * @param ministryInvestments Investments from Ministry website
 * @param onProgress Progress callback
 * @returns Combined and deduplicated array of investments
 */
export async function deduplicateInvestments(
    diavgeiaInvestments: Investment[],
    ministryInvestments: Investment[],
    onProgress: (completed: number, total: number) => void
): Promise<Investment[]> {
    console.log('\n🔍 Starting deduplication process...');

    // First filter out ministry investments that have a diavgeiaADA (shouldn't happen, but just in case)
    const ministryOnly = ministryInvestments.filter(inv =>
        !inv.reference?.diavgeiaADA || inv.reference.diavgeiaADA === '');

    console.log(`Found ${ministryOnly.length} ministry investments without diavgeiaADA`);

    // For each ministry investment, check if it's a duplicate of a diavgeia investment
    const batchSize = 5; // Process in small batches to avoid rate limits
    const duplicatesMap = new Map<string, string>(); // Maps ministry URL to diavgeia ADA

    // Process the ministry investments in batches
    let processed = 0;

    for (let i = 0; i < ministryOnly.length; i += batchSize) {
        const batch = ministryOnly.slice(i, i + batchSize);

        // Process each investment in the batch sequentially (to avoid rate limits)
        for (const ministryInv of batch) {
            const ministryUrl = ministryInv.reference?.ministryUrl;
            if (!ministryUrl) continue;

            try {
                // Get a fresh client instance
                const client = getAnthropicClient();

                // Extract key fields for comparison
                const ministryData = {
                    name: ministryInv.name,
                    beneficiary: ministryInv.beneficiary,
                    totalAmount: ministryInv.totalAmount,
                    locations: ministryInv.locations,
                    url: ministryUrl,
                    fek: ministryInv.reference?.fek || ''
                };

                // Prepare a subset of diavgeia investments with similar criteria for comparison
                const potentialMatches = diavgeiaInvestments
                    .filter(d => {
                        // Simple filtering to reduce candidates
                        const nameMatch = d.name && ministryInv.name &&
                            (d.name.toLowerCase().includes(ministryInv.name.toLowerCase().substring(0, 10)) ||
                                ministryInv.name.toLowerCase().includes(d.name.toLowerCase().substring(0, 10)));

                        const beneficiaryMatch = d.beneficiary && ministryInv.beneficiary &&
                            (d.beneficiary.toLowerCase().includes(ministryInv.beneficiary.toLowerCase().substring(0, 10)) ||
                                ministryInv.beneficiary.toLowerCase().includes(d.beneficiary.toLowerCase().substring(0, 10)));

                        const amountSimilar = ministryInv.totalAmount > 0 && d.totalAmount > 0 &&
                            Math.abs(d.totalAmount - ministryInv.totalAmount) / Math.max(d.totalAmount, ministryInv.totalAmount) < 0.2;

                        return nameMatch || beneficiaryMatch || amountSimilar;
                    })
                    .slice(0, 20); // Limit to 20 candidates for performance

                if (potentialMatches.length === 0) {
                    console.log(`No potential matches found for ${ministryUrl}`);
                    processed++;
                    onProgress(processed, ministryOnly.length);
                    continue;
                }

                console.log(`Comparing ministry investment "${ministryInv.name}" with ${potentialMatches.length} potential matches...`);

                // Use Claude to find duplicates
                const message = await client.messages.create({
                    model: MODEL,
                    max_tokens: 1000,
                    temperature: 0,
                    system: "You are an expert at identifying duplicate investments in different data sources. Your task is to determine if a ministry website investment is the same as any investment from the Diavgeia database.",
                    messages: [
                        {
                            role: "user",
                            content: `I need to identify if this investment from the ministry website is a duplicate of any investment from the Diavgeia database.

Ministry Website Investment:
${JSON.stringify(ministryData, null, 2)}

Potential Matching Investments from Diavgeia:
${JSON.stringify(potentialMatches.map(d => ({
                                name: d.name,
                                beneficiary: d.beneficiary,
                                totalAmount: d.totalAmount,
                                locations: d.locations,
                                ada: d.reference?.diavgeiaADA || '',
                                fek: d.reference?.fek || ''
                            })), null, 2)}

Analyze these investments and determine:
1. Is the ministry investment a duplicate of any of the Diavgeia investments?
2. If yes, which one? (provide the ADA code)
3. How confident are you in this match? (high, medium, low)

Return your answer as a JSON object with this structure:
{
  "isDuplicate": true/false,
  "matchedADA": "ADA code if duplicate, empty string if not",
  "confidence": "high/medium/low",
  "explanation": "Brief explanation of your reasoning"
}

Important considerations:
- Matching names and beneficiaries might have slight variations in spelling or formatting
- Location information is critical - investments in completely different locations are not duplicates
- Total amounts should be reasonably close for duplicates (within ~10-20%)
- If FEK references match, it's a strong indicator of a duplicate`
                        }
                    ]
                });

                // Extract the result from Claude's response
                const responseContent = message.content.find(block => block.type === 'text');
                if (!responseContent || responseContent.type !== 'text') {
                    throw new Error("No text content in Claude's response");
                }

                const jsonResponse = responseContent.text.trim();
                const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error("No JSON object found in Claude's response");
                }

                const result = JSON.parse(jsonMatch[0]);

                if (result.isDuplicate && result.matchedADA && result.confidence !== 'low') {
                    console.log(`✅ Found duplicate: Ministry URL ${ministryUrl} matches Diavgeia ADA ${result.matchedADA} (confidence: ${result.confidence})`);
                    duplicatesMap.set(ministryUrl, result.matchedADA);
                } else {
                    console.log(`❌ No duplicate found for ministry URL ${ministryUrl}`);
                }

            } catch (error) {
                console.error(`Error during deduplication for ${ministryUrl}:`, error);
            }

            processed++;
            onProgress(processed, ministryOnly.length);

            // Add a small delay between requests to avoid rate limits
            await sleep(1000);
        }
    }

    console.log(`\n🔍 Deduplication complete: Found ${duplicatesMap.size} duplicates out of ${ministryOnly.length} ministry investments`);

    // Filter out ministry investments that were found to be duplicates
    const uniqueMinistryInvestments = ministryOnly.filter(inv =>
        !inv.reference?.ministryUrl || !duplicatesMap.has(inv.reference.ministryUrl)
    );

    console.log(`Adding ${uniqueMinistryInvestments.length} unique ministry investments to the dataset`);

    // Combine diavgeia investments with unique ministry investments
    return [...diavgeiaInvestments, ...uniqueMinistryInvestments];
}
