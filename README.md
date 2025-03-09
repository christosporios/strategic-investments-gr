# Στρατηγικές Επενδύσεις

Χρησιμοποιεί το API του [Προγράμματος Δι@υγεια](https://diavgeia.gov.gr) για την εύρεση στρατηγικών επενδύσεων, και συγκεκριμένα πράξεις χορήγησης κινήτρων, και την εξαγωγή δεδομένων.

## Project Overview

This project consists of two main components:

1. **Data Collection Script**: A TypeScript script that collects investment data from the Diavgeia API
2. **Visualization App**: A React application that displays the collected investment data

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/strategic-investments.git
cd strategic-investments

# Install dependencies
npm install
```

## Data Collection

The data collection script can be run with or without date parameters:

```bash
# Run without date parameters (collects all available data)
npm run collect

# Run with specific date range
npm run collect:period --startDate=2022-01-01 --endDate=2022-12-31
```

The collected data will be saved to `data/investments.json`.

## Visualization App

To run the visualization app in development mode:

```bash
npm start
```

This will start a development server and open the app in your default browser.

## Building and Deployment

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Deploy to GitHub Pages

1. Update the `homepage` field in `package.json` with your GitHub username:

```json
"homepage": "https://your-username.github.io/strategic-investments"
```

2. Deploy to GitHub Pages:

```bash
npm run deploy
```

## Data Structure

The investment data follows this structure:

```typescript
interface Investment {
  dateApproved: string;          // Date when investment was approved
  beneficiary: string;           // Name of the beneficiary company
  name: string;                  // Title of the investment project
  totalAmount: number;           // Total amount in euros
  reference: {
    fek: string;                 // Reference to the Government Gazette publication
    diavgeiaADA: string;         // Unique Diavgeia document identifier
  };
  amountBreakdown: {
    amount: number;              // Amount in euros
    description: string;         // Description of this part of the investment
  }[];
  locations: {
    description: string;         // What this location is about
    textLocation?: string;       // Verbal description of location
    lat?: number;                // Latitude (if available)
    lon?: number;                // Longitude (if available)
  }[];
  fundingSource: {
    source: string;              // Name of the funding source
    perc?: number;               // Percentage of total funding (if available)
    amount?: number;             // Amount in euros (if available)
  }[];
  incentivesApproved: {
    name: string;                // Name of the incentive granted
  }[];
}
```

## Development

The project uses:
- TypeScript for type safety
- React for the visualization UI
- Webpack for bundling
- ES Modules throughout

### Project Structure

```
strategic-investments/
├── data/                   # Data storage
│   └── investments.json    # Collected investment data
├── src/
│   ├── scripts/            # Data collection scripts
│   │   └── collect-data.ts # Main data collection script
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts        # Main type definitions
│   └── web/                # Visualization app
│       ├── App.tsx         # Main React component
│       ├── index.html      # HTML template
│       ├── index.tsx       # React entry point
│       └── styles.css      # CSS styles
├── .gitignore              # Git ignore file
├── package.json            # NPM package configuration
├── tsconfig.json           # TypeScript configuration for data collection
├── tsconfig.web.json       # TypeScript configuration for web app
└── webpack.config.mjs      # Webpack configuration
```