export interface Location {
    description: string;
    textLocation?: string;
    lat?: number;
    lon?: number;
}

export interface AmountBreakdown {
    amount: number;
    description: string;
}

export interface FundingSource {
    source: string;
    perc?: number;
    amount?: number;
}

export interface Incentive {
    name: string;
}

export interface Reference {
    fek: string;
    diavgeiaADA: string;
}

export interface Investment {
    dateApproved: string;
    beneficiary: string;
    name: string;
    totalAmount: number;
    reference: Reference;
    amountBreakdown: AmountBreakdown[];
    locations: Location[];
    fundingSource: FundingSource[];
    incentivesApproved: Incentive[];
}

export interface CollectDataParams {
    startDate?: string;
    endDate?: string;
} 