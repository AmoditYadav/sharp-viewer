import React from 'react';

/**
 * Metrics Panel Component
 * Displays volume calculations and growth percentage
 */
export default function MetricsPanel({ day1Volume, day2Volume, growthPercent }) {
    const hasData = day1Volume !== null || day2Volume !== null;

    if (!hasData) {
        return null;
    }

    const formatVolume = (vol) => {
        if (vol === null || vol === undefined) return '—';
        return vol.toLocaleString(undefined, { maximumFractionDigits: 0 });
    };

    const growthClass = growthPercent > 0 ? 'positive' : growthPercent < 0 ? 'negative' : '';

    return (
        <div className="metrics-panel">
            <div className="metric-row">
                <span className="metric-label">Day 1 Volume</span>
                <span className="metric-value">{formatVolume(day1Volume)}</span>
            </div>
            <div className="metric-row">
                <span className="metric-label">Day 2 Volume</span>
                <span className="metric-value">{formatVolume(day2Volume)}</span>
            </div>
            {growthPercent !== null && (
                <div className="metric-row">
                    <span className="metric-label">Growth</span>
                    <span className={`metric-value ${growthClass}`}>
                        {growthPercent > 0 ? '+' : ''}{growthPercent?.toFixed(2)}%
                    </span>
                </div>
            )}
        </div>
    );
}
