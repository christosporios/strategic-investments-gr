# Στρατηγικές Επενδύσεις
⭐  **[Δείτε την εφαρμογή](christosporios.github.io/strategic-investments-gr)** ⭐ 

Αναλυτική οπτικοποίηση των στρατηγικών επενδύσεων στην Ελλάδα. Παρουσιάζει δεδομένα από:
1. Αποφάσεις έγκρισης χορήγησης κινήτρων που έχουν αναρτηθεί στην [Διαύγεια](https://diavgeia.gov.gr)
2. Επενδυτικά έργα από την ιστοσελίδα του [Υπουργείου Ανάπτυξης](https://ependyseis.mindev.gov.gr/)

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

Για την συλλογή δεδομένων, χρειάζεστε Anthropic API key:

```bash
# Set up your API key in .env file
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# Run data collection (both sources)
npm run collect
```

### Επιλογές συλλογής δεδομένων

Μπορείτε να περάσετε διάφορες παραμέτρους για να προσαρμόσετε την συλλογή δεδομένων:

```bash
# Συλλογή για συγκεκριμένο ημερομηνιακό εύρος (για Διαύγεια μόνο)
npm run collect -- --startDate=2023-01-01 --endDate=2023-12-31

# Συλλογή μόνο από Διαύγεια (παραλείποντας Υπουργείο)
npm run collect -- --skip-ministry

# Συλλογή μόνο από Υπουργείο (παραλείποντας Διαύγεια)
npm run collect -- --skip-diavgeia

# Αγνόηση υπαρχόντων δεδομένων (πλήρης επανασυλλογή)
npm run collect -- --ignore-existing
```

## Features

- 🗺️ Διαδραστικός χάρτης με την γεωγραφική κατανομή των επενδύσεων
- 📊 Πίνακας με αναλυτικά στοιχεία και δυνατότητα αναζήτησης
- 📋 Εξαγωγή δεδομένων σε CSV
- 📱 Πλήρως responsive σχεδιασμός
- 🔄 Συλλογή δεδομένων από πολλαπλές πηγές (Διαύγεια και Υπουργείο Ανάπτυξης)

## License

[MIT License](LICENSE)
