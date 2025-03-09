import React, { useEffect, useState } from 'react';
import { Investment } from '../types';

const App: React.FC = () => {
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                const response = await fetch('./data/investments.json');
                if (!response.ok) {
                    throw new Error(`Error loading data: ${response.statusText}`);
                }
                const data: Investment[] = await response.json();
                setInvestments(data);
                setLoading(false);
            } catch (err) {
                setError((err as Error).message || 'Failed to load investment data');
                setLoading(false);
            }
        };

        loadData();
    }, []);

    if (loading) {
        return <div className="loading">Loading investment data...</div>;
    }

    if (error) {
        return <div className="error">Error: {error}</div>;
    }

    return (
        <div className="app">
            <header>
                <h1>Στρατηγικές Επενδύσεις</h1>
            </header>
            <main>
                <div className="info-panel">
                    <h2>Investment Summary</h2>
                    <p>Total number of investments: <strong>{investments.length}</strong></p>
                </div>

                {investments.length > 0 && (
                    <div className="investments-list">
                        <h2>Investments</h2>
                        <ul>
                            {investments.map((investment, index) => (
                                <li key={index}>
                                    <h3>{investment.name}</h3>
                                    <p>Beneficiary: {investment.beneficiary}</p>
                                    <p>Approved: {investment.dateApproved}</p>
                                    <p>Amount: €{investment.totalAmount.toLocaleString()}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </main>
            <footer>
                <p>Data sourced from Diavgeia</p>
            </footer>
        </div>
    );
};

export default App; 