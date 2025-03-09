import { writeFileSync, mkdirSync, existsSync } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Investment, CollectDataParams } from '../types/index.js';

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
        }
    }

    return params;
};

// Sample data generator function
const generateSampleData = (): Investment[] => {
    const sampleInvestment: Investment = {
        dateApproved: "2023-07-15",
        beneficiary: "Sample Company A.E.",
        name: "Development of Renewable Energy Park",
        totalAmount: 15000000,
        reference: {
            fek: "ΦΕΚ B' 123/15.07.2023",
            diavgeiaADA: "ΑΒΓΔΕΖΘΙΚΛΜ123"
        },
        amountBreakdown: [
            { amount: 10000000, description: "Construction costs" },
            { amount: 3000000, description: "Equipment purchase" },
            { amount: 2000000, description: "Technical studies and licensing" }
        ],
        locations: [
            {
                description: "Main facility",
                textLocation: "Περιοχή Ασπροπύργου, Αττική",
                lat: 38.0582,
                lon: 23.5965
            }
        ],
        fundingSource: [
            { source: "Ταμείο Ανάκαμψης και Ανθεκτικότητας", perc: 40, amount: 6000000 },
            { source: "Ίδια κεφάλαια", perc: 60, amount: 9000000 }
        ],
        incentivesApproved: [
            { name: "Φορολογικά κίνητρα άρθρου 9" },
            { name: "Επιτάχυνση αδειοδότησης" }
        ]
    };

    return [sampleInvestment];
};

// Main function
const main = () => {
    // Parse arguments
    const params = parseArgs();

    // Log parameters
    console.log('Data collection started with parameters:');
    console.log(`Start Date: ${params.startDate || 'Not specified'}`);
    console.log(`End Date: ${params.endDate || 'Not specified'}`);

    // Generate sample data
    const sampleData = generateSampleData();

    // Ensure data directory exists
    const dataDir = path.resolve(__dirname, '../../data');
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
    }

    // Save sample data to file
    const filePath = path.join(dataDir, 'investments.json');
    writeFileSync(filePath, JSON.stringify(sampleData, null, 2), 'utf8');

    console.log(`Sample data saved to ${filePath}`);
};

// Run the main function
main(); 