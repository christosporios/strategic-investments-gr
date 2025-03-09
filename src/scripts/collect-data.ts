import dotenv from 'dotenv';
dotenv.config();

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Investment, CollectDataParams } from '../types/index.js';
import { checkInvestmentHealth, countWarningsByType, WarningType } from '../utils/dataHealthCheck.js';
import {
    filterRelevantDecisions,
    extractInvestmentData,
    processBatch,
} from './claude-api.js';
import { queryDiavgeiaAPI, checkIfRevision } from './diavgeia-api.js';
import { geocodeLocation } from './geocode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const parseArgs = (): CollectDataParams => {
    const args = process.argv.slice(2);
    const params: CollectDataParams = {};

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--startDate' && i + 1 < args.length) {
            params.startDate = args[i + 1];
            i++;
        } else if (args[i] === '--endDate' && i + 1 < args.length) {
            params.endDate = args[i + 1];
            i++;
        } else if (args[i] === '--apiKey' && i + 1 < args.length) {
            // Only set API key from command line if not already set in .env
            if (!process.env.ANTHROPIC_API_KEY) {
                process.env.ANTHROPIC_API_KEY = args[i + 1];
            } else {
                console.log('Using ANTHROPIC_API_KEY from .env file instead of command line argument');
            }
            i++;
        }
    }

    return params;
};

/**
 * Save investment data to a JSON file
 * @param data Investment data to save
 * @param revisionsMap Map of original ADA to the revising ADA
 */
function saveData(data: Investment[], revisionsMap?: Map<string, string>) {
    try {
        // Create data directory if it doesn't exist
        const dataDir = path.resolve(__dirname, '../../data');
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }

        // Add metadata to the saved data
        const dataToSave = {
            metadata: {
                generatedAt: new Date().toISOString(),
                totalInvestments: data.length,
                revisionsExcluded: revisionsMap ? Array.from(revisionsMap.entries()).map(([original, revision]) => ({
                    original,
                    replacedBy: revision
                })) : []
            },
            investments: data
        };

        // Save the data as JSON
        const filePath = path.join(dataDir, 'investments.json');
        writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
        console.log(`\n💾 Data saved to ${filePath}`);

        // If we have revision info, log it
        if (revisionsMap && revisionsMap.size > 0) {
            console.log(`📝 Note: ${revisionsMap.size} revised decision${revisionsMap.size !== 1 ? 's were' : ' was'} excluded to prevent double-counting`);
        }
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

/**
 * Enrich investment data with geocoded coordinates for locations
 * @param investments Array of investments to enrich
 * @returns Promise that resolves when geocoding is complete
 */
async function enrichLocationsWithCoordinates(investments: Investment[]): Promise<void> {
    console.log('\n🌍 Geocoding location data...');

    let totalLocations = 0;
    let geocodedLocations = 0;

    for (const investment of investments) {
        if (!investment.locations || !Array.isArray(investment.locations)) {
            continue;
        }

        for (const location of investment.locations) {
            if (!location.textLocation || (location.lat && location.lon)) {
                continue; // Skip if no text location or already has coordinates
            }

            totalLocations++;

            // Add a small delay between geocoding requests to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 200));

            console.log(`Geocoding: "${location.textLocation.substring(0, 50)}${location.textLocation.length > 50 ? '...' : ''}"`);

            try {
                const coordinates = await geocodeLocation(location.textLocation);

                if (coordinates) {
                    location.lat = coordinates.lat;
                    location.lon = coordinates.lng; // Note: geocodeLocation returns lng but our schema uses lon
                    geocodedLocations++;
                    console.log(`✅ Successfully geocoded: ${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`);
                } else {
                    console.log(`❌ Failed to geocode location`);
                }
            } catch (error) {
                console.error(`Error geocoding location: ${error}`);
            }
        }
    }

    console.log(`\n🗺️ Geocoding summary: ${geocodedLocations}/${totalLocations} locations geocoded successfully (${Math.round((geocodedLocations / totalLocations || 0) * 100)}%)`);
}

/**
 * Main function to run the data collection process
 */
const main = async () => {
    // Check for Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
        console.error('Error: ANTHROPIC_API_KEY environment variable is not set');
        console.error('Please set ANTHROPIC_API_KEY in your .env file or pass it as a command line argument with --apiKey');
        process.exit(1);
        return;
    }

    // Parse command line arguments
    const params = parseArgs();
    console.log('Parameters:', params);

    // Query the Diavgeia API for all decisions
    const decisions = await queryDiavgeiaAPI(params);
    if (decisions.length === 0) {
        console.error('No results found in the Diavgeia API.');
        process.exit(1);
        return;
    }

    // Check decisions for revisions and enrich them with revision information
    console.log('\n🔍 Checking for revised decisions...');
    const revisionsMap = new Map<string, string>(); // Maps original ADA to revising ADA
    let revisionsFound = 0;

    for (const decision of decisions) {
        const revisionInfo = await checkIfRevision(decision);
        if (revisionInfo.isRevision && revisionInfo.revisesADA) {
            console.log(`⚠️ Decision ${decision.ada} is a revision of ${revisionInfo.revisesADA}`);
            revisionsMap.set(revisionInfo.revisesADA, decision.ada);
            // Add revision info to the decision object for later use
            decision.revisesADA = revisionInfo.revisesADA;
            revisionsFound++;
        }
    }

    console.log(`\n📊 Found ${revisionsFound} revision${revisionsFound !== 1 ? 's' : ''} out of ${decisions.length} decisions`);

    // Filter decisions to get only the relevant ones
    // Note: Claude has been instructed to prefer newer versions of decisions
    // when there are multiple versions of the same decision
    console.log('\n🤖 Asking Claude to filter relevant decisions (excluding older versions)...');
    const relevantDecisions = await filterRelevantDecisions(decisions);
    if (relevantDecisions.length === 0) {
        console.error('No relevant decisions found in the Diavgeia API.');
        process.exit(1);
        return;
    }

    // Filter out decisions that have been revised by newer ones
    // We do this AFTER filtering relevant decisions to ensure we only filter out
    // decisions that are both relevant and have been revised
    const filteredDecisions = relevantDecisions.filter(decision => {
        if (revisionsMap.has(decision.ada)) {
            const replacedBy = revisionsMap.get(decision.ada);
            // Check if the replacing decision is also in our relevant set
            const replacingDecisionIsRelevant = relevantDecisions.some(d => d.ada === replacedBy);
            console.log(`🚫 Disregarding decision ${decision.ada} because it has been replaced by ${replacedBy}${replacingDecisionIsRelevant ? ' (which is also relevant)' : ' (note: replacing decision is not in the relevant set)'}`);
            return false;
        }
        return true;
    });

    // Double-check no revised decisions remain
    const remainingRevised = filteredDecisions.filter(decision =>
        Array.from(revisionsMap.keys()).includes(decision.ada)
    );

    if (remainingRevised.length > 0) {
        console.error(`⛔ ERROR: ${remainingRevised.length} revised decisions still remain in the filtered set. This should not happen.`);
        remainingRevised.forEach(decision => {
            console.error(`  - Decision ${decision.ada} should have been filtered out but wasn't.`);
        });
        // We'll continue processing but this is a serious error that should be investigated
    } else {
        console.log('✅ Verification complete: No revised decisions remain in the filtered set.');
    }

    console.log(`\n📝 After filtering revisions: ${filteredDecisions.length}/${relevantDecisions.length} decisions will be processed`);

    // Process relevant decisions with retries and display progress
    console.log(`\n🚀 Starting to process ${filteredDecisions.length} relevant decisions...`);
    const batchSize = 3; // Process in small batches to minimize rate limit issues

    let processedCount = 0;
    let successCount = 0;

    const displayProgress = (completed: number, total: number) => {
        const percentage = Math.round((completed / total) * 100);
        const successRate = completed > 0 ? Math.round((successCount / completed) * 100) : 0;
        console.log(`Progress: ${completed}/${total} (${percentage}%) | Success: ${successCount}/${completed} (${successRate}%)`);
    };

    const investments = await processBatch(
        filteredDecisions,
        batchSize,
        async (decision) => {
            const result = await extractInvestmentData(decision);

            // If we have a revision, add that information to the investment data
            if (result && decision.revisesADA) {
                if (!result.reference) {
                    result.reference = { fek: '', diavgeiaADA: decision.ada, revisesADA: decision.revisesADA };
                } else {
                    result.reference.revisesADA = decision.revisesADA;
                }
            }

            if (result) successCount++;
            return result;
        },
        displayProgress
    );

    // Filter out nulls
    const validInvestments = investments.filter(Boolean) as Investment[];
    console.log(`Successfully extracted data from ${validInvestments.length}/${filteredDecisions.length} relevant decisions`);

    // Enrich locations with geocoding data if GOOGLE_API_KEY is available
    if (process.env.GOOGLE_API_KEY) {
        await enrichLocationsWithCoordinates(validInvestments);
    } else {
        console.log('\n⚠️ No GOOGLE_API_KEY found in environment variables - skipping geocoding');
    }

    // Run data health checks
    console.log('\n📋 Running data health checks...');
    validInvestments.forEach((investment, index) => {
        const warnings = checkInvestmentHealth(investment);
        if (warnings.length > 0) {
            console.log(`\n⚠️ Investment ${index + 1}: ${investment.name}`);
            warnings.forEach(warning => {
                console.log(`  • ${warning.message}`);
            });
        }
    });

    // Count warnings by type
    const warningCounts = countWarningsByType(validInvestments);
    console.log('\n📊 Warning Summary:');
    console.log(`  • Missing location coordinates: ${warningCounts[WarningType.MISSING_LOCATION_COORDS]}`);
    console.log(`  • Funding sources sum mismatch: ${warningCounts[WarningType.FUNDING_SOURCES_SUM_MISMATCH]}`);
    console.log(`  • Amount breakdown sum mismatch: ${warningCounts[WarningType.AMOUNT_BREAKDOWN_SUM_MISMATCH]}`);
    console.log(`  • Total amount zero: ${warningCounts[WarningType.TOTAL_AMOUNT_ZERO]}`);
    console.log(`  • Missing Diavgeia ADA: ${warningCounts[WarningType.MISSING_DIAVGEIA_ADA]}`);

    // Check if we have any revised entries still in the data (this should never happen)
    const anyRevisionsPersist = validInvestments.some(inv =>
        inv.reference && revisionsMap.has(inv.reference.diavgeiaADA)
    );

    if (anyRevisionsPersist) {
        console.error('\n⛔ CRITICAL ERROR: Some revised decisions still remain in the final data!');
        validInvestments.forEach(inv => {
            if (inv.reference && revisionsMap.has(inv.reference.diavgeiaADA)) {
                console.error(`  • Decision ${inv.reference.diavgeiaADA} should have been excluded, replaced by ${revisionsMap.get(inv.reference.diavgeiaADA)}`);
            }
        });
    } else {
        console.log('\n✅ Final verification: No revised decisions are present in the final data. Double-counting prevented.');
    }

    // Save the data
    saveData(validInvestments, revisionsMap);

    // Calculate total investment amount
    const totalAmount = validInvestments.reduce((sum, investment) => sum + (investment.totalAmount || 0), 0);

    // Display summary with emoji
    console.log('\n===================================');
    console.log(`🚀 SUMMARY OF STRATEGIC INVESTMENTS 🚀`);
    console.log(`📊 Total investments found: ${validInvestments.length}`);
    console.log(`💰 Total amount: €${totalAmount.toLocaleString('el-GR')}`);
    if (revisionsMap.size > 0) {
        console.log(`🧹 Excluded ${revisionsMap.size} revised decision${revisionsMap.size !== 1 ? 's' : ''} to prevent double-counting`);
    }
    console.log('===================================\n');
};

// Run the main function
main().catch(error => {
    console.error('Error in main process:', error);
    process.exit(1);
}); 