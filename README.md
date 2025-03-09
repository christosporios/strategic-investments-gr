# Στρατηγικές Επενδύσεις

Αναλυτική οπτικοποίηση των στρατηγικών επενδύσεων στην Ελλάδα. Παρουσιάζει δεδομένα από αποφάσεις έγκρισης χορήγησης κινήτρων που έχουν αναρτηθεί στην [Διαύγεια](https://diavgeia.gov.gr).

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm start

# Build for production
npm run build
```

## Data Collection

Για την συλλογή δεδομένων από την Διαύγεια, χρειάζεστε Anthropic API key:

```bash
# Set up your API key in .env file
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# Run data collection
npm run collect
```

Εναλλακτικά, μπορείτε να περάσετε ημερομηνιακό εύρος:

```bash
npm run collect -- --startDate=2023-01-01 --endDate=2023-12-31
```

## Features

- 🗺️ Διαδραστικός χάρτης με την γεωγραφική κατανομή των επενδύσεων
- 📊 Πίνακας με αναλυτικά στοιχεία και δυνατότητα αναζήτησης
- 📋 Εξαγωγή δεδομένων σε CSV
- 📱 Πλήρως responsive σχεδιασμός

## License

[MIT License](LICENSE) © 2023-2024 Schema Labs