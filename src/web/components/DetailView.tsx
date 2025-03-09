import React, { useState } from 'react';
import { Investment, Location, FundingSource, Incentive } from '../../types';
import { Category, CategoryColors, DEFAULT_CATEGORY_COLOR } from '../../types/constants';
import IncentiveTag from './IncentiveTag';
import { createDiavgeiaURL } from './TableUtils';

interface DetailViewProps {
    investment: Investment;
}

const DetailView: React.FC<DetailViewProps> = ({ investment }) => {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main', 'incentives']));

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(section)) {
                newSet.delete(section);
            } else {
                newSet.add(section);
            }
            return newSet;
        });
    };

    const isSectionExpanded = (section: string): boolean => {
        return expandedSections.has(section);
    };

    // Get human-readable category name
    const getCategoryLabel = (category?: Category): string => {
        if (!category) return 'Χωρίς κατηγορία';

        switch (category) {
            case Category.PRODUCTION_MANUFACTURING:
                return 'Παραγωγή & Μεταποίηση';
            case Category.TECHNOLOGY_INNOVATION:
                return 'Τεχνολογία & Καινοτομία';
            case Category.TOURISM_CULTURE:
                return 'Τουρισμός & Πολιτισμός';
            case Category.SERVICES_EDUCATION:
                return 'Υπηρεσίες & Εκπαίδευση';
            case Category.HEALTHCARE_WELFARE:
                return 'Υγεία & Κοινωνική Μέριμνα';
            default:
                return String(category);
        }
    };

    // Get color for category
    const getCategoryColor = (category?: Category): string => {
        if (!category) return DEFAULT_CATEGORY_COLOR;
        return CategoryColors[category];
    };

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Main Information Section */}
            <div className="border-b border-gray-200">
                <div
                    className="p-4 bg-blue-50 cursor-pointer flex justify-between items-center"
                    onClick={() => toggleSection('main')}
                >
                    <h3 className="text-lg font-semibold text-gray-900">Βασικές Πληροφορίες</h3>
                    <span>{isSectionExpanded('main') ? '▼' : '►'}</span>
                </div>

                {isSectionExpanded('main') && (
                    <div className="p-4 space-y-3">
                        <div>
                            <h4 className="text-sm font-medium text-gray-500">Όνομα Επένδυσης</h4>
                            <p className="text-base text-gray-900">{investment.name}</p>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium text-gray-500">Δικαιούχος</h4>
                            <p className="text-base text-gray-900">{investment.beneficiary}</p>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:justify-between">
                            <div className="mb-2 sm:mb-0">
                                <h4 className="text-sm font-medium text-gray-500">Συνολικό Ποσό</h4>
                                <p className="text-base text-gray-900 font-bold">
                                    €{investment.totalAmount?.toLocaleString('el-GR') || 'Μη διαθέσιμο'}
                                </p>
                            </div>

                            <div>
                                <h4 className="text-sm font-medium text-gray-500">Ημερομηνία Έγκρισης</h4>
                                <p className="text-base text-gray-900">{investment.dateApproved || 'Μη διαθέσιμη'}</p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium text-gray-500">Κατηγορία</h4>
                            <span
                                className="inline-block mt-1 px-3 py-1 rounded-full text-sm"
                                style={{
                                    backgroundColor: getCategoryColor(investment.category),
                                    color: 'white'
                                }}
                            >
                                {getCategoryLabel(investment.category)}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Incentives Section */}
            <div className="border-b border-gray-200">
                <div
                    className="p-4 bg-blue-50 cursor-pointer flex justify-between items-center"
                    onClick={() => toggleSection('incentives')}
                >
                    <h3 className="text-lg font-semibold text-gray-900">Κίνητρα</h3>
                    <span>{isSectionExpanded('incentives') ? '▼' : '►'}</span>
                </div>

                {isSectionExpanded('incentives') && (
                    <div className="p-4">
                        {investment.incentivesApproved && investment.incentivesApproved.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {investment.incentivesApproved.map((incentive, idx) => (
                                    <IncentiveTag key={idx} incentive={incentive} />
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">Δεν υπάρχουν καταγεγραμμένα κίνητρα</p>
                        )}
                    </div>
                )}
            </div>

            {/* Locations Section */}
            <div className="border-b border-gray-200">
                <div
                    className="p-4 bg-blue-50 cursor-pointer flex justify-between items-center"
                    onClick={() => toggleSection('locations')}
                >
                    <h3 className="text-lg font-semibold text-gray-900">Τοποθεσίες</h3>
                    <span>{isSectionExpanded('locations') ? '▼' : '►'}</span>
                </div>

                {isSectionExpanded('locations') && (
                    <div className="p-4">
                        {investment.locations && investment.locations.length > 0 ? (
                            <div className="space-y-3">
                                {investment.locations.map((location, idx) => (
                                    <div key={idx} className="p-3 bg-gray-50 rounded-md">
                                        <h4 className="font-medium text-gray-900">{location.description}</h4>
                                        {location.textLocation && (
                                            <p className="text-sm text-gray-600 mt-1">{location.textLocation}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">Δεν υπάρχουν καταγεγραμμένες τοποθεσίες</p>
                        )}
                    </div>
                )}
            </div>

            {/* Amount Breakdown Section */}
            <div className="border-b border-gray-200">
                <div
                    className="p-4 bg-blue-50 cursor-pointer flex justify-between items-center"
                    onClick={() => toggleSection('amountBreakdown')}
                >
                    <h3 className="text-lg font-semibold text-gray-900">Ανάλυση Ποσού</h3>
                    <span>{isSectionExpanded('amountBreakdown') ? '▼' : '►'}</span>
                </div>

                {isSectionExpanded('amountBreakdown') && (
                    <div className="p-4">
                        {investment.amountBreakdown && investment.amountBreakdown.length > 0 ? (
                            <div className="space-y-2">
                                {investment.amountBreakdown.map((item, idx) => (
                                    <div key={idx} className="flex justify-between p-2 rounded bg-gray-50">
                                        <span className="text-sm text-gray-900">{item.description}</span>
                                        <span className="text-sm font-medium text-gray-900">€{item.amount.toLocaleString('el-GR')}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">Δεν υπάρχει διαθέσιμη ανάλυση</p>
                        )}
                    </div>
                )}
            </div>

            {/* Funding Sources Section */}
            <div className="border-b border-gray-200">
                <div
                    className="p-4 bg-blue-50 cursor-pointer flex justify-between items-center"
                    onClick={() => toggleSection('fundingSources')}
                >
                    <h3 className="text-lg font-semibold text-gray-900">Πηγές Χρηματοδότησης</h3>
                    <span>{isSectionExpanded('fundingSources') ? '▼' : '►'}</span>
                </div>

                {isSectionExpanded('fundingSources') && (
                    <div className="p-4">
                        {investment.fundingSource && investment.fundingSource.length > 0 ? (
                            <div className="space-y-2">
                                {investment.fundingSource.map((source, idx) => (
                                    <div key={idx} className="flex justify-between p-2 rounded bg-gray-50">
                                        <span className="text-sm text-gray-900">{source.source}</span>
                                        <div className="text-right">
                                            {source.perc && (
                                                <span className="text-xs text-gray-500 mr-2">{(source.perc * 100).toFixed(1)}%</span>
                                            )}
                                            {source.amount && (
                                                <span className="text-sm font-medium text-gray-900">€{source.amount.toLocaleString('el-GR')}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">Δεν υπάρχουν διαθέσιμες πηγές χρηματοδότησης</p>
                        )}
                    </div>
                )}
            </div>

            {/* References Section */}
            <div>
                <div
                    className="p-4 bg-blue-50 cursor-pointer flex justify-between items-center"
                    onClick={() => toggleSection('references')}
                >
                    <h3 className="text-lg font-semibold text-gray-900">Αναφορές</h3>
                    <span>{isSectionExpanded('references') ? '▼' : '►'}</span>
                </div>

                {isSectionExpanded('references') && (
                    <div className="p-4 space-y-3">
                        {investment.reference?.fek && (
                            <div>
                                <h4 className="text-sm font-medium text-gray-500">ΦΕΚ</h4>
                                <p className="text-base text-gray-900">{investment.reference.fek}</p>
                            </div>
                        )}

                        {investment.reference?.diavgeiaADA && (
                            <div>
                                <h4 className="text-sm font-medium text-gray-500">Διαύγεια ADA</h4>
                                <a
                                    href={createDiavgeiaURL(investment.reference.diavgeiaADA)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800"
                                >
                                    {investment.reference.diavgeiaADA}
                                </a>
                            </div>
                        )}

                        {investment.reference?.ministryUrl && !investment.reference?.diavgeiaADA && (
                            <div>
                                <h4 className="text-sm font-medium text-gray-500">Πηγή</h4>
                                <a
                                    href={investment.reference.ministryUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800"
                                >
                                    Υπουργείο Ανάπτυξης
                                </a>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DetailView; 