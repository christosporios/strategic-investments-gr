import React, { useState, useRef, useEffect } from 'react';
import { IncentiveType } from '../../types/constants';
import { Incentive } from '../../types';

interface IncentiveTagProps {
    incentive: Incentive;
    size?: 'small' | 'medium';
}

const IncentiveTag: React.FC<IncentiveTagProps> = ({ incentive, size = 'medium' }) => {
    const [expanded, setExpanded] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const tagRef = useRef<HTMLSpanElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Get color based on incentive type
    const getTagColor = (type?: IncentiveType): string => {
        if (!type) return '#6c757d'; // Default gray

        switch (type) {
            case IncentiveType.FAST_TRACK_LICENSING:
                return '#4BB543'; // Green
            case IncentiveType.SPECIAL_ZONING:
                return '#FF8C00'; // Orange
            case IncentiveType.TAX_RATE_FREEZE:
            case IncentiveType.TAX_EXEMPTION:
            case IncentiveType.ACCELERATED_DEPRECIATION:
                return '#007BFF'; // Blue
            case IncentiveType.INVESTMENT_GRANT:
            case IncentiveType.LEASING_SUBSIDY:
            case IncentiveType.EMPLOYMENT_COST_SUBSIDY:
                return '#9C27B0'; // Purple
            case IncentiveType.AUDITOR_MONITORING:
            case IncentiveType.SHORELINE_USE:
            case IncentiveType.EXPROPRIATION_SUPPORT:
                return '#FF5722'; // Deep Orange
            default:
                return '#6c757d'; // Gray
        }
    };

    // Get a shortened name for small tags
    const getShortenedName = (name: string): string => {
        // If already short, return as is
        if (name.length <= 20) return name;

        // Try to find a natural breaking point
        const breakPoints = [' και ', ' με ', ' για ', ' του ', ' της ', ' στην ', ' στο ', ' στη '];
        for (const point of breakPoints) {
            const index = name.indexOf(point);
            if (index > 10 && index < 30) {
                return name.substring(0, index) + '...';
            }
        }

        // If no natural break, cut it off
        return name.substring(0, 20) + '...';
    };

    // Handle toggle expanded state on click
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent event from bubbling to parent elements
        setExpanded(!expanded);
        setShowTooltip(false); // Hide tooltip when expanding
    };

    // Close expanded view when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tagRef.current && !tagRef.current.contains(event.target as Node)) {
                setExpanded(false);
            }
        };

        if (expanded) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [expanded]);

    const backgroundColor = getTagColor(incentive.incentiveType);
    const fontSize = size === 'small' ? '10px' : '12px';
    const padding = size === 'small' ? '2px 6px' : '3px 8px';
    const margin = size === 'small' ? '2px' : '3px';
    const displayText = expanded ? incentive.name :
        (size === 'small' ? getShortenedName(incentive.name) : incentive.name);

    // Should we show the expand functionality?
    const isShortened = size === 'small' && incentive.name.length > 20;

    return (
        <span
            ref={tagRef}
            style={{
                backgroundColor,
                color: 'white',
                padding,
                borderRadius: '12px',
                fontSize,
                fontWeight: 'normal',
                display: 'inline-block',
                margin,
                maxWidth: expanded ? '300px' : (size === 'small' ? '150px' : '100%'),
                overflow: 'hidden',
                textOverflow: expanded ? 'clip' : 'ellipsis',
                whiteSpace: expanded ? 'normal' : 'nowrap',
                cursor: isShortened ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                position: 'relative',
                zIndex: expanded ? 10 : 'auto',
                boxShadow: expanded ? '0 2px 10px rgba(0,0,0,0.1)' : 'none'
            }}
            onClick={isShortened ? handleClick : undefined}
            onMouseEnter={() => isShortened && !expanded && setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            title={isShortened ? '' : incentive.name}
        >
            {displayText}

            {/* Custom Tooltip (only shown when hovering over shortened incentives) */}
            {showTooltip && !expanded && isShortened && (
                <div
                    ref={tooltipRef}
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        marginBottom: '6px',
                        whiteSpace: 'normal',
                        maxWidth: '200px',
                        zIndex: 20,
                        pointerEvents: 'none'
                    }}
                >
                    {incentive.name}
                    <div
                        style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0,
                            height: 0,
                            borderLeft: '6px solid transparent',
                            borderRight: '6px solid transparent',
                            borderTop: '6px solid rgba(0,0,0,0.8)'
                        }}
                    />
                </div>
            )}
        </span>
    );
};

export default IncentiveTag; 