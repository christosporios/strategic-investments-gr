import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { ExternalLink, AlertCircle, Clock } from 'lucide-react';

interface HelpViewProps {
    metadata: {
        generatedAt?: string;
        totalInvestments?: number;
        revisionsExcluded?: Array<{
            original: string;
            replacedBy: string;
        }>;
    } | null;
}

const HelpView: React.FC<HelpViewProps> = ({ metadata }) => {
    // Format the data generation date if available
    const formattedDate = metadata?.generatedAt
        ? new Date(metadata.generatedAt).toLocaleDateString('el-GR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : null;

    return (
        <div className="space-y-6 mb-10">
            {/* Data Freshness Alert */}
            {formattedDate && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md mb-6">
                    <div className="flex items-start">
                        <div className="flex-shrink-0">
                            <Clock className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">
                                Τελευταία ενημέρωση δεδομένων
                            </h3>
                            <div className="mt-1 text-sm text-yellow-700">
                                <p>
                                    Τα δεδομένα που εμφανίζονται σε αυτή την εφαρμογή έχουν ενημερωθεί στις {formattedDate}.
                                    {metadata?.totalInvestments && (
                                        <span className="block mt-1">
                                            Συνολικός αριθμός επενδύσεων: <strong>{metadata.totalInvestments}</strong>
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Strategic Investments Card - Moved to be after data recency */}
            <Card>
                <CardHeader>
                    <CardTitle>Στρατηγικές Επενδύσεις</CardTitle>
                    <CardDescription>Πληροφορίες για το πλαίσιο και τα κίνητρα των στρατηγικών επενδύσεων</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="mb-4">
                        Οι Στρατηγικές Επενδύσεις αποτελούν σημαντικό εργαλείο οικονομικής ανάπτυξης για την Ελλάδα, προσελκύοντας επενδυτικά κεφάλαια και δημιουργώντας θέσεις εργασίας.
                        Διέπονται από τον Νόμο 4864/2021, ο οποίος καθορίζει τις κατηγορίες τους, όπως Στρατηγικές Επενδύσεις 1 και 2, Εμβληματικές Επενδύσεις, Επενδύσεις Ταχείας Αδειοδότησης και Αυτοδίκαια Εντασσόμενες Επενδύσεις.
                        Για να χαρακτηριστεί μια επένδυση ως στρατηγική, πρέπει να πληροί συγκεκριμένα κριτήρια προϋπολογισμού και δημιουργίας θέσεων εργασίας, ενώ μπορεί να αφορά
                        τομείς όπως βιομηχανία, ενέργεια, τουρισμό, τεχνολογία, υγεία, και άλλους καίριους τομείς της οικονομίας.
                    </p>
                    <p className="mb-4">
                        Τα κίνητρα που παρέχονται στις στρατηγικές επενδύσεις περιλαμβάνουν:
                    </p>
                    <ul className="list-disc pl-6 mb-4 space-y-1 text-gray-700">
                        <li><strong>Ταχεία αδειοδότηση</strong> με προθεσμία 45 ημερών για την έκδοση αδειών</li>
                        <li><strong>Ειδικά σχέδια χωροθέτησης</strong> (Ε.Σ.Χ.Α.Σ.Ε.) με ευνοϊκούς όρους δόμησης</li>
                        <li><strong>Φορολογικά κίνητρα</strong> όπως σταθεροποίηση φορολογικού συντελεστή για 12 έτη, φορολογικές απαλλαγές και επιταχυνόμενες αποσβέσεις</li>
                        <li><strong>Επιχορηγήσεις δαπανών</strong> επένδυσης, leasing και κόστους απασχόλησης</li>
                        <li><strong>Υποστηρικτικά μέτρα</strong> όπως διευκολύνσεις στη χρήση αιγιαλού και απαλλοτριώσεις</li>
                    </ul>
                    <p>
                        Περισσότερες πληροφορίες είναι διαθέσιμες στην <a href="https://www.enterprisegreece.gov.gr/ependyste-sthn-ellada/strathgikes-ependyseis" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Enterprise Greece</a> και
                        το <a href="https://mindev.gov.gr/stratigikes-ependyseis/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Υπουργείο Ανάπτυξης</a>.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Σχετικά με την εφαρμογή</CardTitle>
                    <CardDescription>Πληροφορίες για τη χρήση και το περιεχόμενο της εφαρμογής</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="mb-4">
                        Αυτή η εφαρμογή παρουσιάζει δεδομένα για τις στρατηγικές επενδύσεις που
                        έχουν εγκριθεί από την ελληνική κυβέρνηση. Το περιεχόμενο της εφαρμογής είναι οργανωμένο
                        σε διαφορετικές προβολές:
                    </p>

                    <div className="flex items-center gap-2 mb-4 bg-blue-50 p-3 rounded-md">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-blue-600">
                            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                            <path d="M9 18c-4.51 2-5-2-7-2" />
                        </svg>
                        <span className="text-blue-700 text-sm">
                            Ο κώδικας της εφαρμογής είναι διαθέσιμος στο
                            <a
                                href="https://github.com/christosporios/strategic-investments-gr"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-blue-600 hover:underline mx-1 inline-flex items-center"
                            >
                                GitHub
                                <ExternalLink className="h-3.5 w-3.5 ml-0.5" />
                            </a>
                        </span>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <h3 className="font-semibold text-lg mb-2">📍 Χάρτης</h3>
                            <p className="text-gray-500">
                                Οπτικοποίηση της γεωγραφικής κατανομής των επενδύσεων σε χάρτη της Ελλάδας
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg mb-2">📊 Πίνακας</h3>
                            <p className="text-gray-500">
                                Αναλυτικός πίνακας με όλες τις επενδύσεις και τα κύρια στοιχεία τους.
                                Με δυνατότητα αναζήτησης, επέκτασης για λεπτομέρειες, και εξαγωγής σε CSV.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg mb-2">❓ Βοήθεια</h3>
                            <p className="text-gray-500">
                                Η τρέχουσα προβολή που περιέχει πληροφορίες και οδηγίες χρήσης
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Μεθοδολογία Συλλογής Δεδομένων</CardTitle>
                    <CardDescription>Πώς συλλέγονται τα δεδομένα των επενδύσεων</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="mb-4">
                        Η διαδικασία συλλογής και επεξεργασίας των δεδομένων για τις στρατηγικές επενδύσεις περιλαμβάνει:
                    </p>

                    <div className="space-y-4">
                        <div>
                            <h3 className="font-semibold text-lg mb-2">1. Αναζήτηση στη Διαύγεια</h3>
                            <p className="text-gray-500">
                                Πραγματοποιείται αναζήτηση στο Πρόγραμμα Διαύγεια για τις αποφάσεις του Υπουργείου Ανάπτυξης:
                            </p>
                            <ul className="list-disc pl-6 mt-2 space-y-1 text-gray-500 text-sm">
                                <li>Αποφάσεις από τον συγκεκριμένο φορέα (organizationUid:100081597 - Υπουργείο Ανάπτυξης)</li>
                                <li>Αποφάσεις από τη συγκεκριμένη μονάδα (unitUid:100007316 - Μονάδα Στρατηγικών Επενδύσεων)</li>
                                <li>Δυνατότητα περιορισμού χρονικού διαστήματος αναζήτησης (προεπιλογή τελευταία 10 έτη)</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg mb-2">2. Συλλογή από το Υπουργείο Ανάπτυξης</h3>
                            <p className="text-gray-500">
                                Παράλληλα, συλλέγονται πληροφορίες από την ιστοσελίδα του Υπουργείου Ανάπτυξης:
                            </p>
                            <ul className="list-disc pl-6 mt-2 space-y-1 text-gray-500 text-sm">
                                <li>Έργα από τις περιφερειακές σελίδες στρατηγικών επενδύσεων</li>
                                <li>Καταχωρημένα επενδυτικά έργα που ενδέχεται να μην έχουν ακόμη αναρτηθεί στη Διαύγεια</li>
                                <li>Πρόσθετα στοιχεία που μπορεί να μην περιλαμβάνονται στις αποφάσεις της Διαύγειας</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg mb-2">3. Φιλτράρισμα & Επεξεργασία</h3>
                            <p className="text-gray-500">
                                Τα δεδομένα υποβάλλονται σε επεξεργασία για να εντοπιστούν οι σχετικές πληροφορίες:
                            </p>
                            <ul className="list-disc pl-6 mt-2 space-y-1 text-gray-500 text-sm">
                                <li>Αναγνώριση και ομαδοποίηση αναθεωρήσεων και διορθώσεων αποφάσεων</li>
                                <li>Φιλτράρισμα για εντοπισμό αποφάσεων έγκρισης χορήγησης κινήτρων</li>
                                <li>Εντοπισμός και αποφυγή διπλοτύπων μεταξύ των δύο πηγών δεδομένων</li>
                                <li>Διατήρηση μόνο των πιο πρόσφατων εκδόσεων των αποφάσεων</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg mb-2">4. Εξαγωγή Δεδομένων</h3>
                            <p className="text-gray-500">
                                Από κάθε πηγή εξάγεται με αυτοματοποιημένο τρόπο δομημένη πληροφορία:
                            </p>
                            <ul className="list-disc pl-6 mt-2 space-y-1 text-gray-500 text-sm">
                                <li>Όνομα επένδυσης, δικαιούχος και ημερομηνία έγκρισης</li>
                                <li>Συνολικό ποσό επένδυσης και ανάλυση προϋπολογισμού</li>
                                <li>Τοποθεσίες υλοποίησης της επένδυσης</li>
                                <li>Πηγές χρηματοδότησης και εγκεκριμένα κίνητρα</li>
                                <li>Στοιχεία αναφοράς (ΑΔΑ Διαύγειας, ΦΕΚ, URL Υπουργείου)</li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg mb-2">5. Εμπλουτισμός Δεδομένων</h3>
                            <p className="text-gray-500">
                                Τα εξαγόμενα δεδομένα εμπλουτίζονται με γεωχωρικές πληροφορίες:
                            </p>
                            <ul className="list-disc pl-6 mt-2 space-y-1 text-gray-500 text-sm">
                                <li>Γεωκωδικοποίηση τοποθεσιών με συντεταγμένες για την απεικόνιση στον χάρτη</li>
                                <li>Έλεγχος ποιότητας και ορθότητας των εξαγόμενων δεδομένων</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Σχετικά με το έργο</CardTitle>
                    <CardDescription>Οι δημιουργοί και η ομάδα πίσω από την εφαρμογή</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="mb-4">
                        Αυτή η εφαρμογή αναπτύχθηκε από την
                        <a
                            href="https://schemalabs.gr"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-medium mx-1 inline-flex items-center"
                        >
                            Schema Labs
                            <ExternalLink className="h-3.5 w-3.5 ml-1" />
                        </a>.
                    </p>

                    <div className="my-4 bg-blue-50 border border-blue-200 rounded-md p-4">
                        <h3 className="font-semibold text-blue-800 mb-2">Πηγές δεδομένων</h3>
                        <p className="text-blue-700 text-sm mb-2">
                            Τα δεδομένα που παρουσιάζονται στην εφαρμογή προέρχονται από δύο κύριες πηγές:
                        </p>
                        <ul className="list-disc pl-6 space-y-1 text-blue-700 text-sm">
                            <li>
                                <a
                                    href="https://diavgeia.gov.gr/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-medium inline-flex items-center"
                                >
                                    Πρόγραμμα Διαύγεια
                                    <ExternalLink className="h-3.5 w-3.5 ml-1" />
                                </a>
                                : Αποφάσεις έγκρισης χορήγησης κινήτρων από τη Μονάδα Στρατηγικών Επενδύσεων
                            </li>
                            <li>
                                <a
                                    href="https://ependyseis.mindev.gov.gr/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-medium inline-flex items-center"
                                >
                                    Υπουργείο Ανάπτυξης
                                    <ExternalLink className="h-3.5 w-3.5 ml-1" />
                                </a>
                                : Επενδυτικά έργα που παρουσιάζονται στην επίσημη ιστοσελίδα του Υπουργείου
                            </li>
                        </ul>
                    </div>

                    <p className="text-sm text-gray-500 mt-4">
                        Το έργο αυτό είναι ανοιχτού κώδικα. Ο πηγαίος κώδικας είναι διαθέσιμος στο
                        <a
                            href="https://github.com/christosporios/strategic-investments-gr"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-medium mx-1 inline-flex items-center"
                        >
                            GitHub
                            <ExternalLink className="h-3.5 w-3.5 ml-1" />
                        </a>
                        όπου μπορείτε να συνεισφέρετε ή να δημιουργήσετε ένα fork.
                    </p>

                </CardContent>
            </Card>
        </div>
    );
};

export default HelpView; 