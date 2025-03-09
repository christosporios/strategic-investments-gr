import React from 'react';
import { Category, CategoryColors, DEFAULT_CATEGORY_COLOR } from '../../types/constants.js';
import { Investment } from '../../types';

interface CategoryFilterProps {
    selectedCategories: Category[];
    onCategoryToggle: (category: Category) => void;
    onUncategorizedToggle: () => void;
    showUncategorized: boolean;
    investments: Investment[];
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
    selectedCategories,
    onCategoryToggle,
    onUncategorizedToggle,
    showUncategorized,
    investments
}) => {
    // Helper function to get human-readable category name
    const getCategoryLabel = (category: Category): string => {
        switch (category) {
            case Category.PRODUCTION_MANUFACTURING:
                return 'Παραγωγή';
            case Category.TECHNOLOGY_INNOVATION:
                return 'Τεχνολογία';
            case Category.TOURISM_CULTURE:
                return 'Τουρισμός';
            case Category.SERVICES_EDUCATION:
                return 'Υπηρεσίες';
            case Category.HEALTHCARE_WELFARE:
                return 'Υγεία';
            default:
                return category;
        }
    };

    // Check if a category is selected
    const isCategorySelected = (category: Category): boolean => {
        return selectedCategories.includes(category);
    };

    // Count investments per category
    const getCategoryCount = (category: Category): number => {
        return investments.filter(inv => inv.category === category).length;
    };

    // Count uncategorized investments
    const getUncategorizedCount = (): number => {
        return investments.filter(inv => !inv.category).length;
    };

    const categoryFilterStyle = {
        margin: '5px 0',
    };

    const filterTitleStyle = {
        marginBottom: '6px',
        fontSize: '14px',
        fontWeight: 500,
        color: '#333'
    } as React.CSSProperties;

    const categoryBadgesStyle = {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '4px'
    };

    return (
        <div style={categoryFilterStyle} className="category-filter">
            <h4 style={filterTitleStyle} className="filter-title">Κατηγορίες Επενδύσεων</h4>
            <div style={categoryBadgesStyle} className="category-badges">
                {Object.values(Category).map(category => {
                    const isSelected = isCategorySelected(category);
                    const count = getCategoryCount(category);

                    const badgeStyle = {
                        backgroundColor: isSelected ? CategoryColors[category] : `${CategoryColors[category]}22`, // More transparency when not selected
                        color: isSelected ? 'white' : '#333',
                        opacity: isSelected ? 1 : 0.7,
                        cursor: 'pointer',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        margin: '2px',
                        display: 'inline-block',
                        fontSize: '11px',
                        fontWeight: isSelected ? 'bold' : 'normal',
                        transition: 'all 0.2s ease-in-out',
                        border: `1px solid ${isSelected ? CategoryColors[category] : 'transparent'}`,
                        whiteSpace: 'nowrap' as const
                    };

                    return count > 0 ? (
                        <span
                            key={category}
                            style={badgeStyle}
                            onClick={() => onCategoryToggle(category)}
                            className="category-badge"
                        >
                            {getCategoryLabel(category)} ({count})
                        </span>
                    ) : null;
                })}

                {/* Uncategorized tag */}
                {getUncategorizedCount() > 0 && (
                    <span
                        style={{
                            backgroundColor: showUncategorized ? DEFAULT_CATEGORY_COLOR : `${DEFAULT_CATEGORY_COLOR}22`,
                            color: showUncategorized ? 'white' : '#333',
                            opacity: showUncategorized ? 1 : 0.7,
                            cursor: 'pointer',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            margin: '2px',
                            display: 'inline-block',
                            fontSize: '11px',
                            fontWeight: showUncategorized ? 'bold' : 'normal',
                            transition: 'all 0.2s ease-in-out',
                            border: `1px solid ${showUncategorized ? DEFAULT_CATEGORY_COLOR : 'transparent'}`,
                            whiteSpace: 'nowrap' as const
                        }}
                        onClick={onUncategorizedToggle}
                        className="category-badge"
                    >
                        Χωρίς κατηγορία ({getUncategorizedCount()})
                    </span>
                )}
            </div>
        </div>
    );
};

export default CategoryFilter; 