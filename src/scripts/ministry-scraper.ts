import axios from 'axios';
import * as cheerio from 'cheerio';
import { Investment } from '../types/index.js';
import { extractMinistryInvestmentData, deduplicateInvestments } from './claude-api.js';

// URLs for investment data
// Instead of regional pages, we should look at the main investment projects page
const PROJECT_LIST_URL = 'https://ependyseis.mindev.gov.gr/el/stratigikes/erga';

// We'll keep the regional pages too as a fallback
const REGION_URLS = [
    'https://ependyseis.mindev.gov.gr/el/stratigikes/perifereies/attiki',
    'https://ependyseis.mindev.gov.gr/el/stratigikes/perifereies/sterea-ellada',
    'https://ependyseis.mindev.gov.gr/el/stratigikes/perifereies/kentriki-makedonia',
    'https://ependyseis.mindev.gov.gr/el/stratigikes/perifereies/kriti',
    'https://ependyseis.mindev.gov.gr/el/stratigikes/perifereies/anatoliki-makedonia-kai-thraki',
    'https://ependyseis.mindev.gov.gr/el/stratigikes/perifereies/ipiros',
    'https://ependyseis.mindev.gov.gr/el/stratigikes/perifereies/ionii-nisi',
    'https://ependyseis.mindev.gov.gr/el/stratigikes/perifereies/vorio-aigaio',
    'https://ependyseis.mindev.gov.gr/el/stratigikes/perifereies/peloponnisos',
    'https://ependyseis.mindev.gov.gr/el/stratigikes/perifereies/notio-aigaio',
    'https://ependyseis.mindev.gov.gr/el/stratigikes/perifereies/thessalia',
    'https://ependyseis.mindev.gov.gr/el/stratigikes/perifereies/ditiki-ellada',
    'https://ependyseis.mindev.gov.gr/el/stratigikes/perifereies/ditiki-makedonia'
];

/**
 * Fetches the HTML content of a webpage
 * @param url URL to fetch
 * @returns HTML content as string
 */
async function fetchPage(url: string): Promise<string> {
    try {
        console.log(`Fetching page: ${url}`);

        // Set a reasonable timeout and additional headers to appear more like a browser
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://ependyseis.mindev.gov.gr/',
                'Connection': 'keep-alive',
                'Cache-Control': 'max-age=0'
            },
            timeout: 15000
        });

        console.log(`Response status: ${response.status}`);
        console.log(`Response content type: ${response.headers['content-type']}`);
        console.log(`Response size: ${response.data.length} bytes`);

        return response.data;
    } catch (error: any) {
        // More detailed error logging
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(`Error status: ${error.response.status}`);
            console.error(`Error headers: ${JSON.stringify(error.response.headers)}`);
            console.error(`Error data: ${JSON.stringify(error.response.data).substring(0, 200)}...`);
        } else if (error.request) {
            // The request was made but no response was received
            console.error(`No response received for request: ${error.request}`);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error(`Error setting up request: ${error.message}`);
        }

        console.error(`Error fetching page ${url}:`, error.message);
        return '';
    }
}

/**
 * Extracts investment project links from the main investment projects page
 * @param html HTML content of the page
 * @returns Array of investment project detail URLs
 */
function extractInvestmentLinks(html: string): string[] {
    const $ = cheerio.load(html);
    const links: string[] = [];

    // Look for links to individual investment projects
    // Based on the structure seen on the real page
    $('a').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();

        if (href) {
            // Check if the link looks like an investment project
            const isProjectLink =
                (href.includes('/stratigikes/erga/') ||
                    href.includes('/el/stratigikes/erga/'));

            if (isProjectLink) {
                const absoluteUrl = href.startsWith('http') ? href : `https://ependyseis.mindev.gov.gr${href.startsWith('/') ? '' : '/'}${href}`;
                if (!links.includes(absoluteUrl)) {
                    console.log(`Found investment project link: ${absoluteUrl}`);
                    links.push(absoluteUrl);
                }
            }
        }
    });

    console.log(`Total investment project links found: ${links.length}`);

    // Print some of the page HTML for debugging if no links found
    if (links.length === 0) {
        console.log('DEBUG: No links found. Page HTML sample:');
        console.log($('body').html()?.substring(0, 500) + '...');
    }

    return links;
}

/**
 * Extracts FEK links and references from an investment project page
 * @param html HTML content of the page
 * @returns Array of FEK URLs or references
 */
function extractFekLinks(html: string): string[] {
    const $ = cheerio.load(html);
    const fekLinks: string[] = [];

    // Look for FEK references in the "Σχετικά έγγραφα" section or elsewhere
    $('a').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();

        // Check if the link or text contains FEK/ΦΕΚ references
        const isFekLink = href && (
            href.includes('fek') ||
            href.includes('FEK') ||
            href.includes('ΦΕΚ') ||
            href.endsWith('.pdf')
        );

        const isFekText = text && (
            text.includes('ΦΕΚ') ||
            text.match(/Φ\.?Ε\.?Κ\.?/i)
        );

        // If it's likely a FEK document, add it
        if ((isFekLink || isFekText) && href) {
            const absoluteUrl = href.startsWith('http') ? href : `https://ependyseis.mindev.gov.gr${href.startsWith('/') ? '' : '/'}${href}`;
            console.log(`Found FEK link: ${absoluteUrl} (${text})`);
            fekLinks.push(absoluteUrl);
        }
    });

    // If no links found but we find FEK text references, add them too
    if (fekLinks.length === 0) {
        // Look for text that contains FEK references
        const fekPattern = /ΦΕΚ\s+(\d+\s*[ΑΒΓΔ']+\s*\/\s*\d+\.\d+\.\d+)/gi;
        const bodyText = $('body').text();
        const matches = bodyText.match(fekPattern);

        if (matches) {
            matches.forEach(match => {
                console.log(`Found FEK text reference: ${match}`);
                fekLinks.push(match);
            });
        }
    }

    return fekLinks;
}

/**
 * Extracts basic investment data from an investment project page
 * @param html HTML content of the page
 * @param url URL of the page (for reference)
 * @returns Partial investment data object
 */
function extractBasicInvestmentData(html: string, url: string): Partial<Investment> {
    const $ = cheerio.load(html);

    // Extract based on the observed structure of the investment project pages
    const name = $('h1, h2, #page-title, .page-title').first().text().trim();
    let beneficiary = '';
    let totalAmount = 0;
    let region = '';
    let sector = '';

    // Extract structured data from the page
    $('strong, b, dt, th, .field-label').each((_, element) => {
        const label = $(element).text().trim();
        const value = $(element).next().text().trim() ||
            $(element).parent().next().text().trim() ||
            $(element).siblings('td, dd, .field-item').text().trim();

        if (label.includes('Φορέας') || label.includes('Επιχείρηση')) {
            beneficiary = value;
        } else if (label.includes('Προϋπολογισμός') || label.includes('κόστος') || label.includes('Budget')) {
            // Extract amount from text like "240.802.000 €" or "€ 240.802.000"
            const amountMatch = value.match(/(\d+[\d\.,]*)\s*€|€\s*(\d+[\d\.,]*)/);
            if (amountMatch) {
                const amountStr = (amountMatch[1] || amountMatch[2]).replace(/\./g, '').replace(',', '.');
                totalAmount = parseFloat(amountStr);
            }
        } else if (label.includes('Περιφέρεια') || label.includes('Region')) {
            region = value;
        } else if (label.includes('Τομέας') || label.includes('Sector')) {
            sector = value;
        }
    });

    // If we still don't have the amount, try another approach
    if (totalAmount === 0) {
        const amountPattern = /(\d+[\d\.,]*)\s*€|€\s*(\d+[\d\.,]*)/g;
        const bodyText = $('body').text();
        const matches = [...bodyText.matchAll(amountPattern)];

        if (matches.length > 0) {
            // Find the largest amount mentioned, which is likely the total budget
            let maxAmount = 0;
            matches.forEach(match => {
                const amountStr = (match[1] || match[2]).replace(/\./g, '').replace(',', '.');
                const amount = parseFloat(amountStr);
                if (amount > maxAmount) {
                    maxAmount = amount;
                }
            });

            if (maxAmount > 0) {
                totalAmount = maxAmount;
            }
        }
    }

    // Extract description
    const description = $('.field-name-body, .field-content, .description, p').text().trim();

    // Build a basic investment object
    return {
        name: name || 'Unknown',
        beneficiary: beneficiary || 'Unknown',
        totalAmount,
        reference: {
            fek: '', // Will be populated later
            diavgeiaADA: '', // No ADA for these entries
            ministryUrl: url // Add source URL
        },
        dateApproved: '', // Will be extracted by Claude
        amountBreakdown: [],
        locations: [{
            description: sector || 'Unknown',
            textLocation: region || 'Unknown'
        }],
        fundingSource: [],
        incentivesApproved: []
    };
}

/**
 * Processes a single investment by scraping its page and extracting data
 * @param url URL of the investment page
 * @param onProgress Progress callback
 * @returns Investment data or null if processing failed
 */
async function processInvestmentPage(
    url: string,
    onProgress: (completed: number, total: number) => void
): Promise<Investment | null> {
    try {
        // Fetch the investment detail page
        const html = await fetchPage(url);
        if (!html) return null;

        // Extract basic data using cheerio
        const basicData = extractBasicInvestmentData(html, url);

        // Extract FEK links
        const fekLinks = extractFekLinks(html);
        if (fekLinks.length > 0) {
            // Just store the first FEK link/reference for now
            basicData.reference!.fek = fekLinks[0];
        }

        console.log(`Extracted basic data for: ${basicData.name}`);
        console.log(`Budget: ${basicData.totalAmount}`);
        console.log(`Beneficiary: ${basicData.beneficiary}`);
        console.log(`FEK Reference: ${basicData.reference?.fek}`);

        // Use Claude to extract more detailed information
        const investmentData = await extractMinistryInvestmentData(html, url, basicData);

        // Fix the funding source percentages - Claude often returns whole percentages (70)
        // but our data model expects decimal values (0.7)
        if (investmentData && investmentData.fundingSource) {
            investmentData.fundingSource = investmentData.fundingSource.map(source => {
                if (source.perc !== undefined && source.perc > 0) {
                    // If percentage is over 1, it's likely in whole percent format (e.g. 70 instead of 0.7)
                    if (source.perc > 1) {
                        source.perc = source.perc / 100;
                    }

                    // Ensure it's between 0 and 1
                    if (source.perc > 1) {
                        console.warn(`Normalizing percentage value ${source.perc} to ${source.perc / 100}`);
                        source.perc = source.perc / 100;
                    }
                }
                return source;
            });

            // Verify the sum is close to 1 (100%)
            const sum = investmentData.fundingSource.reduce((acc, source) => acc + (source.perc || 0), 0);
            if (sum > 1.1) {
                console.warn(`Total funding percentage sum ${sum * 100}% is still above 100% after normalization for ${investmentData.name}`);
            }
        }

        return investmentData;
    } catch (error) {
        console.error(`Error processing investment page ${url}:`, error);
        return null;
    }
}

/**
 * Collects investment data from all sources
 * @param displayProgress Progress callback function
 * @returns Array of investment data
 */
export async function collectMinistryInvestments(
    displayProgress: (completed: number, total: number) => void
): Promise<Investment[]> {
    const allInvestments: Investment[] = [];
    let investmentUrls: string[] = [];

    console.log('\n🌐 Collecting investment data from Ministry website...');

    // Step 1: First try to collect investment URLs from the main projects page
    console.log(`Checking main investment projects page: ${PROJECT_LIST_URL}`);
    const mainProjectsHtml = await fetchPage(PROJECT_LIST_URL);

    if (mainProjectsHtml) {
        const projectLinks = extractInvestmentLinks(mainProjectsHtml);
        console.log(`Found ${projectLinks.length} investment projects on main page`);
        investmentUrls = [...projectLinks];
    }

    // Step 2: If we didn't find many, also try the regional pages as fallback
    if (investmentUrls.length < 5) {
        console.log('Not enough projects found on main page, checking regional pages...');

        for (const regionUrl of REGION_URLS) {
            const html = await fetchPage(regionUrl);
            if (!html) continue;

            const links = extractInvestmentLinks(html);
            console.log(`Found ${links.length} investments on ${regionUrl}`);

            // Add only new links that aren't already in our list
            const newLinks = links.filter(link => !investmentUrls.includes(link));
            investmentUrls = [...investmentUrls, ...newLinks];
        }
    }

    console.log(`\n📝 Found a total of ${investmentUrls.length} investment pages to process`);

    // Step 3: Process each investment page
    let processed = 0;
    const batchSize = 3; // Process in small batches

    for (let i = 0; i < investmentUrls.length; i += batchSize) {
        const batch = investmentUrls.slice(i, i + batchSize);

        // Process this batch in parallel
        const batchResults = await Promise.all(
            batch.map(async (url) => {
                const result = await processInvestmentPage(url, displayProgress);
                processed++;
                displayProgress(processed, investmentUrls.length);
                return result;
            })
        );

        // Add valid results to the collection
        allInvestments.push(...batchResults.filter(Boolean) as Investment[]);

        // Small delay between batches
        if (i + batchSize < investmentUrls.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    console.log(`\n✅ Successfully processed ${allInvestments.length}/${investmentUrls.length} ministry investments`);
    return allInvestments;
} 