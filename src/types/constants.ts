export enum IncentiveType {
    // Fast-track licensing
    FAST_TRACK_LICENSING = "FAST_TRACK_LICENSING",

    // Location/zoning incentives
    SPECIAL_ZONING = "SPECIAL_ZONING",

    // Tax incentives
    TAX_RATE_FREEZE = "TAX_RATE_FREEZE",
    TAX_EXEMPTION = "TAX_EXEMPTION",
    ACCELERATED_DEPRECIATION = "ACCELERATED_DEPRECIATION",

    // Cost support incentives
    INVESTMENT_GRANT = "INVESTMENT_GRANT",
    LEASING_SUBSIDY = "LEASING_SUBSIDY",
    EMPLOYMENT_COST_SUBSIDY = "EMPLOYMENT_COST_SUBSIDY",

    // Other support measures
    AUDITOR_MONITORING = "AUDITOR_MONITORING",
    SHORELINE_USE = "SHORELINE_USE",
    EXPROPRIATION_SUPPORT = "EXPROPRIATION_SUPPORT"
}
export enum Category {
    // Main investment categories
    PRODUCTION_MANUFACTURING = "PRODUCTION_MANUFACTURING", // Παραγωγή & Μεταποίηση
    TECHNOLOGY_INNOVATION = "TECHNOLOGY_INNOVATION", // Τεχνολογία & Καινοτομία
    TOURISM_CULTURE = "TOURISM_CULTURE", // Τουρισμός & Πολιτισμός
    SERVICES_EDUCATION = "SERVICES_EDUCATION", // Υπηρεσίες & Εκπαίδευση
    HEALTHCARE_WELFARE = "HEALTHCARE_WELFARE" // Υγεία & Κοινωνική Μέριμνα
}

// Define colors for each category
export const CategoryColors: Record<Category, string> = {
    [Category.PRODUCTION_MANUFACTURING]: "#E63946", // Red
    [Category.TECHNOLOGY_INNOVATION]: "#4361EE", // Blue
    [Category.TOURISM_CULTURE]: "#4CC9F0", // Light blue
    [Category.SERVICES_EDUCATION]: "#F72585", // Pink
    [Category.HEALTHCARE_WELFARE]: "#7209B7", // Purple
};

// Gray color for investments with undefined category
export const DEFAULT_CATEGORY_COLOR = "#6c757d"; // Gray