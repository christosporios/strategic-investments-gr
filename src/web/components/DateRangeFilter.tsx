import React, { useState, useEffect } from 'react';
import { Slider } from './ui/slider';
import { Investment } from '../../types';

interface DateRangeFilterProps {
    investments: Investment[];
    onFilterChange: (startDate: string, endDate: string) => void;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ investments, onFilterChange }) => {
    const [dateRange, setDateRange] = useState<[number, number]>([0, 100]);
    const [availableDates, setAvailableDates] = useState<Date[]>([]);
    const [minDate, setMinDate] = useState<Date | null>(null);
    const [maxDate, setMaxDate] = useState<Date | null>(null);

    // Extract all dates from investments and sort them
    useEffect(() => {
        if (investments.length === 0) return;

        const dates = investments
            .map(inv => new Date(inv.dateApproved))
            .filter(date => !isNaN(date.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());

        if (dates.length > 0) {
            setAvailableDates(dates);
            setMinDate(dates[0]);
            setMaxDate(dates[dates.length - 1]);
            setDateRange([0, 100]); // Reset to full range
        }
    }, [investments]);

    // Format date to YYYY-MM-DD
    const formatDate = (date: Date): string => {
        return date.toISOString().split('T')[0];
    };

    // Handle slider change
    const handleSliderChange = (newValues: number[]) => {
        if (!minDate || !maxDate || availableDates.length === 0) return;

        setDateRange(newValues as [number, number]);

        // Calculate actual dates based on percentages
        const minTime = minDate.getTime();
        const maxTime = maxDate.getTime();
        const timeRange = maxTime - minTime;

        const startTime = minTime + (timeRange * newValues[0] / 100);
        const endTime = minTime + (timeRange * newValues[1] / 100);

        const startDate = new Date(startTime);
        const endDate = new Date(endTime);

        onFilterChange(formatDate(startDate), formatDate(endDate));
    };

    // Format dates for display
    const getDisplayDate = (percentage: number): string => {
        if (!minDate || !maxDate) return '';

        const minTime = minDate.getTime();
        const maxTime = maxDate.getTime();
        const timeRange = maxTime - minTime;
        const time = minTime + (timeRange * percentage / 100);
        const date = new Date(time);

        return date.toLocaleDateString('el-GR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    if (!minDate || !maxDate) return null;

    return (
        <div className="w-full">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>Περίοδος:</span>
                <div className="flex items-center space-x-1">
                    <span className="font-medium text-gray-700">{getDisplayDate(dateRange[0])}</span>
                    <span>-</span>
                    <span className="font-medium text-gray-700">{getDisplayDate(dateRange[1])}</span>
                </div>
            </div>

            <Slider
                defaultValue={dateRange}
                min={0}
                max={100}
                step={1}
                value={dateRange}
                onValueChange={handleSliderChange}
                className="my-1"
            />
        </div>
    );
};

export default DateRangeFilter; 