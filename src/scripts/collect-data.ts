import dotenv from 'dotenv';
dotenv.config();

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Investment, CollectDataParams } from '../types/index.js';
import { checkInvestmentHealth, countWarningsByType, WarningType } from '../utils/dataHealthCheck.js';
import {
    filterRelevantDecisions,
    extractInvestmentData,
    processBatch,
    deduplicateInvestments
} from './claude-api.js';
import { queryDiavgeiaAPI, checkIfRevision } from './diavgeia-api.js';
import { geocodeLocation } from './geocode.js';
import { collectMinistryInvestments } from './ministry-scraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const parseArgs = (): CollectDataParams => {
    const args = process.argv.slice(2);
    const params: CollectDataParams = {
        ignoreExisting: false
    };

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
        } else if (args[i] === '--ignore-existing') {
            params.ignoreExisting = true;
        } else if (args[i] === '--skip-ministry') {
            params.skipMinistry = true;
        } else if (args[i] === '--skip-diavgeia') {
            params.skipDiavgeia = true;
        }
    }

    return params;
};

/**
 * Load existing investment data from the JSON file
 * @returns Existing investments data or null if file doesn't exist
 */
function loadExistingData(): { investments: Investment[], metadata: any } | null {
    try {
        const filePath = path.resolve(__dirname, '../../data/investments.json');
        if (!existsSync(filePath)) {
            return null;
        }

        const fileContent = readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        return data;
    } catch (error) {
        console.error('Error loading existing data:', error);
        return null;
    }
}

/**
 * Save investment data to a JSON file
 * @param data Investment data to save
 * @param revisionsMap Map of original ADA to the revising ADA
 * @param ignoreExisting Whether to ignore existing data and overwrite it
 */
function saveData(data: Investment[], revisionsMap?: Map<string, string>, ignoreExisting?: boolean) {
    try {
        // Create data directory if it doesn't exist
        const dataDir = path.resolve(__dirname, '../../data');
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }

        // All of the deduplication logic has now been moved to the main function
        // Here we simply save the provided data as-is
        // Add metadata to the saved data
        const dataToSave = {
            metadata: {
                generatedAt: new Date().toISOString(),
                totalInvestments: data.length,
                revisionsExcluded: revisionsMap ?
                    Array.from(revisionsMap.entries()).map(([original, revision]) => ({
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
        console.log(`📊 Total investments saved: ${data.length}`);
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

    // Load existing data if we're not ignoring it
    let existingADAs: Set<string> = new Set();
    if (!params.ignoreExisting) {
        const existingData = loadExistingData();
        if (existingData) {
            existingADAs = new Set(
                existingData.investments
                    .filter(inv => inv.reference?.diavgeiaADA)
                    .map(inv => inv.reference!.diavgeiaADA)
            );
            console.log(`📚 Found ${existingADAs.size} existing investment entries to avoid reprocessing`);
        }
    } else {
        console.log('🔄 Ignoring existing entries as --ignore-existing flag is set');
    }

    // Initialize arrays to store investments from different sources
    let diavgeiaInvestments: Investment[] = [];
    let ministryInvestments: Investment[] = [];

    // Define a common progress display function
    const displayProgress = (completed: number, total: number) => {
        const percentage = Math.round((completed / total) * 100);
        const successRate = completed > 0 ? Math.round((completed / total) * 100) : 0;
        console.log(`Progress: ${completed}/${total} (${percentage}%) | Success: ${successRate}%`);
    };

    // Step 1: Collect data from Diavgeia API (unless skipped)
    if (!params.skipDiavgeia) {
        console.log('\n📊 COLLECTING DATA FROM DIAVGEIA API');
        console.log('===================================');

        // Query the Diavgeia API for all decisions
        const decisions = await queryDiavgeiaAPI(params);
        if (decisions.length === 0) {
            console.error('No results found in the Diavgeia API.');
            if (!params.skipMinistry) {
                console.log('Continuing with ministry website data collection only.');
            } else {
                process.exit(1);
                return;
            }
        } else {
            // Filter out decisions that we already have processed (unless ignoreExisting is true)
            let decisionsToProcess = decisions;
            if (!params.ignoreExisting && existingADAs.size > 0) {
                const beforeCount = decisionsToProcess.length;
                decisionsToProcess = decisions.filter(decision => !existingADAs.has(decision.ada));
                const skippedCount = beforeCount - decisionsToProcess.length;
                console.log(`⏩ Skipping ${skippedCount} decision(s) that already exist in investments.json`);
            }

            if (decisionsToProcess.length > 0) {
                // Check decisions for revisions and enrich them with revision information
                console.log('\n🔍 Checking for revised decisions...');
                const revisionsMap = new Map<string, string>(); // Maps original ADA to revising ADA
                let revisionsFound = 0;

                for (const decision of decisionsToProcess) {
                    const revisionInfo = await checkIfRevision(decision);
                    if (revisionInfo.isRevision && revisionInfo.revisesADA) {
                        console.log(`⚠️ Decision ${decision.ada} is a revision of ${revisionInfo.revisesADA}`);
                        revisionsMap.set(revisionInfo.revisesADA, decision.ada);
                        // Add revision info to the decision object for later use
                        decision.revisesADA = revisionInfo.revisesADA;
                        revisionsFound++;
                    }
                }

                console.log(`\n📊 Found ${revisionsFound} revision${revisionsFound !== 1 ? 's' : ''} out of ${decisionsToProcess.length} decisions`);

                // Filter decisions to get only the relevant ones
                console.log('\n🤖 Asking Claude to filter relevant decisions (excluding older versions)...');
                const relevantDecisions = await filterRelevantDecisions(decisionsToProcess);

                if (relevantDecisions.length > 0) {
                    // Filter out decisions that have been revised by newer ones
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
                    } else {
                        console.log('✅ Verification complete: No revised decisions remain in the filtered set.');
                    }

                    console.log(`\n📝 After filtering revisions: ${filteredDecisions.length}/${relevantDecisions.length} decisions will be processed`);

                    // Process relevant decisions with retries and display progress
                    console.log(`\n🚀 Starting to process ${filteredDecisions.length} relevant decisions...`);
                    const batchSize = 3; // Process in small batches to minimize rate limit issues

                    let successCount = 0;
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
                    diavgeiaInvestments = investments.filter(Boolean) as Investment[];
                    console.log(`Successfully extracted data from ${diavgeiaInvestments.length}/${filteredDecisions.length} relevant decisions`);
                } else {
                    console.log('No relevant decisions found in the Diavgeia API.');
                }
            } else {
                console.log('No new decisions to process from Diavgeia API.');
            }
        }
    } else {
        console.log('\n⏩ Skipping Diavgeia API data collection as --skip-diavgeia flag is set');
    }

    // Step 2: Collect data from Ministry website (unless skipped)
    if (!params.skipMinistry) {
        console.log('\n📊 COLLECTING DATA FROM MINISTRY WEBSITE');
        console.log('===================================');

        // Collect investment data from ministry website
        ministryInvestments = await collectMinistryInvestments(displayProgress);
        console.log(`\n📊 Collected ${ministryInvestments.length} investments from ministry website`);
    } else {
        console.log('\n⏩ Skipping Ministry website data collection as --skip-ministry flag is set');
    }

    // Step 3: Combine and deduplicate investments from both sources
    let combinedInvestments: Investment[] = [];

    if (diavgeiaInvestments.length > 0 && ministryInvestments.length > 0) {
        console.log('\n🔄 Combining and deduplicating investments from both sources...');
        console.log(`Diavgeia investments: ${diavgeiaInvestments.length}`);
        console.log(`Ministry investments: ${ministryInvestments.length}`);

        // First use Claude to deduplicate between ministry and diavgeia sources
        combinedInvestments = await deduplicateInvestments(
            diavgeiaInvestments,
            ministryInvestments,
            displayProgress
        );

        console.log(`After deduplication: ${combinedInvestments.length} unique investments`);
    } else if (diavgeiaInvestments.length > 0) {
        console.log(`Using only Diavgeia investments: ${diavgeiaInvestments.length}`);
        combinedInvestments = diavgeiaInvestments;
    } else if (ministryInvestments.length > 0) {
        console.log(`Using only Ministry investments: ${ministryInvestments.length}`);
        combinedInvestments = ministryInvestments;
    } else {
        console.error('No investments collected from either source.');
        process.exit(1);
        return;
    }

    // Validate that no deduplication errors exist
    const diavgeiaADAs = new Set<string>();
    const ministryURLs = new Set<string>();
    const duplicateIDs: string[] = [];

    combinedInvestments.forEach(inv => {
        if (inv.reference?.diavgeiaADA && diavgeiaADAs.has(inv.reference.diavgeiaADA)) {
            duplicateIDs.push(`Diavgeia ADA: ${inv.reference.diavgeiaADA}`);
        }
        if (inv.reference?.ministryUrl && ministryURLs.has(inv.reference.ministryUrl)) {
            duplicateIDs.push(`Ministry URL: ${inv.reference.ministryUrl}`);
        }

        if (inv.reference?.diavgeiaADA) {
            diavgeiaADAs.add(inv.reference.diavgeiaADA);
        }
        if (inv.reference?.ministryUrl) {
            ministryURLs.add(inv.reference.ministryUrl);
        }
    });

    if (duplicateIDs.length > 0) {
        console.warn(`⚠️ Warning: Found ${duplicateIDs.length} duplicate IDs after deduplication!`);
        console.warn(`First 5 duplicates: ${duplicateIDs.slice(0, 5).join(', ')}`);
    }

    // If we're not ignoring existing data, we need to deduplicate with the existing data too
    if (!params.ignoreExisting) {
        const existingData = loadExistingData();
        if (existingData && existingData.investments.length > 0) {
            console.log(`\n🔄 Checking for duplicates with ${existingData.investments.length} existing investments...`);

            // Create a map of existing investments by ID (ADA or ministry URL)
            const existingInvestmentsById = new Map<string, Investment>();

            // Add all existing investments to the map with their IDs
            existingData.investments.forEach(inv => {
                if (inv.reference?.diavgeiaADA) {
                    existingInvestmentsById.set(`ada:${inv.reference.diavgeiaADA}`, inv);
                }
                if (inv.reference?.ministryUrl) {
                    existingInvestmentsById.set(`url:${inv.reference.ministryUrl}`, inv);
                }
            });

            // Filter out new investments that have the same IDs as existing ones
            const newInvestmentsToAdd = combinedInvestments.filter(inv => {
                if (inv.reference?.diavgeiaADA && existingInvestmentsById.has(`ada:${inv.reference.diavgeiaADA}`)) {
                    console.log(`Skipping duplicate investment with ADA: ${inv.reference.diavgeiaADA}`);
                    return false;
                }
                if (inv.reference?.ministryUrl && existingInvestmentsById.has(`url:${inv.reference.ministryUrl}`)) {
                    console.log(`Skipping duplicate investment with Ministry URL: ${inv.reference.ministryUrl}`);
                    return false;
                }
                return true;
            });

            // Combine existing and new unique investments
            combinedInvestments = [...existingData.investments, ...newInvestmentsToAdd];
            console.log(`Added ${newInvestmentsToAdd.length} new unique investments to ${existingData.investments.length} existing investments.`);
        }
    }

    // Enrich locations with geocoding data if GOOGLE_API_KEY is available
    if (process.env.GOOGLE_API_KEY) {
        await enrichLocationsWithCoordinates(combinedInvestments);
    } else {
        console.log('\n⚠️ No GOOGLE_API_KEY found in environment variables - skipping geocoding');
    }

    // Run data health checks
    console.log('\n📋 Running data health checks...');
    combinedInvestments.forEach((investment, index) => {
        const warnings = checkInvestmentHealth(investment);
        if (warnings.length > 0) {
            console.log(`\n⚠️ Investment ${index + 1}: ${investment.name}`);
            warnings.forEach(warning => {
                console.log(`  • ${warning.message}`);
            });
        }
    });

    // Count warnings by type
    const warningCounts = countWarningsByType(combinedInvestments);
    console.log('\n📊 Warning Summary:');
    console.log(`  • Missing location coordinates: ${warningCounts[WarningType.MISSING_LOCATION_COORDS]}`);
    console.log(`  • Funding sources sum mismatch: ${warningCounts[WarningType.FUNDING_SOURCES_SUM_MISMATCH]}`);
    console.log(`  • Amount breakdown sum mismatch: ${warningCounts[WarningType.AMOUNT_BREAKDOWN_SUM_MISMATCH]}`);
    console.log(`  • Total amount zero: ${warningCounts[WarningType.TOTAL_AMOUNT_ZERO]}`);
    console.log(`  • Missing Diavgeia ADA: ${warningCounts[WarningType.MISSING_DIAVGEIA_ADA]}`);

    // Save the data - all deduplication has been done at this point
    saveData(combinedInvestments);

    // Calculate total investment amount
    const totalAmount = combinedInvestments.reduce((sum, investment) => sum + (investment.totalAmount || 0), 0);

    // Display summary with emoji
    console.log('\n===================================');
    console.log(`🚀 SUMMARY OF STRATEGIC INVESTMENTS 🚀`);

    // If we merged with existing data, show totals for both new and existing
    if (!params.ignoreExisting) {
        const existingData = loadExistingData();
        const existingCount = existingData?.investments.length || 0;
        const newUniqueCount = combinedInvestments.filter(inv =>
            !existingData?.investments.some(
                existingInv =>
                    (inv.reference?.diavgeiaADA && existingInv.reference?.diavgeiaADA === inv.reference?.diavgeiaADA) ||
                    (inv.reference?.ministryUrl && existingInv.reference?.ministryUrl === inv.reference?.ministryUrl)
            )
        ).length;

        console.log(`📊 New unique investments: ${newUniqueCount}`);
        console.log(`📊 Total investments saved: ${existingCount + newUniqueCount}`);
    } else {
        console.log(`📊 Total investments: ${combinedInvestments.length}`);
    }

    console.log(`💰 Total amount of new investments: €${totalAmount.toLocaleString('el-GR')}`);
    console.log(`📊 Source breakdown: ${diavgeiaInvestments.length} from Diavgeia, ${ministryInvestments.length} from Ministry website`);
    console.log('===================================\n');
};

// Run the main function
main().catch(error => {
    console.error('Error in main process:', error);
    process.exit(1);
}); 