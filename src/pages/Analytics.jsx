import React, { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getDailyAnalyticsHistory } from '../api/analyticsApi';

const TIMEFRAME_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

const METRIC_OPTIONS = [
  { id: 'resilienceScore', label: 'Resilience Score', color: '#ff8a00', unit: '' },
  { id: 'rabbitHole', label: 'Rabbit Hole', color: '#f97316', unit: '' },
  { id: 'streaks', label: 'Streaks', color: '#22c55e', unit: ' days' },
  { id: 'averageEscapeTime', label: 'Average Escape Time', color: '#38bdf8', unit: ' min' },
];

const SAMPLE_ENTRIES = [
  { date: '2026-01-05', resilienceScore: 52, rabbitHole: 4, averageEscapeTime: 29 },
  { date: '2026-01-12', resilienceScore: 57, rabbitHole: 3, averageEscapeTime: 26 },
  { date: '2026-01-19', resilienceScore: 55, rabbitHole: 5, averageEscapeTime: 32 },
  { date: '2026-01-26', resilienceScore: 60, rabbitHole: 3, averageEscapeTime: 25 },
  { date: '2026-02-02', resilienceScore: 62, rabbitHole: 3, averageEscapeTime: 24 },
  { date: '2026-02-09', resilienceScore: 59, rabbitHole: 4, averageEscapeTime: 28 },
  { date: '2026-02-16', resilienceScore: 65, rabbitHole: 2, averageEscapeTime: 22 },
  { date: '2026-02-23', resilienceScore: 67, rabbitHole: 2, averageEscapeTime: 21 },
  { date: '2026-03-02', resilienceScore: 64, rabbitHole: 3, averageEscapeTime: 23 },
  { date: '2026-03-09', resilienceScore: 70, rabbitHole: 2, averageEscapeTime: 19 },
  { date: '2026-03-16', resilienceScore: 74, rabbitHole: 2, averageEscapeTime: 18 },
  { date: '2026-03-23', resilienceScore: 71, rabbitHole: 3, averageEscapeTime: 20 },
  { date: '2026-03-30', resilienceScore: 76, rabbitHole: 2, averageEscapeTime: 17 },
  { date: '2026-04-06', resilienceScore: 79, rabbitHole: 1, averageEscapeTime: 15 },
  { date: '2026-04-13', resilienceScore: 83, rabbitHole: 1, averageEscapeTime: 13 },
];

const normalizeEntry = (entry, index) => {
  const fallbackDate = SAMPLE_ENTRIES[index % SAMPLE_ENTRIES.length].date;
  const safeDate = entry.date || entry.createdAt || entry.day || fallbackDate;

  return {
    date: safeDate,
    resilienceScore: Number(entry.resilienceScore ?? entry.score ?? 0),
    rabbitHole: Number(entry.rabbitHole ?? entry.rabbitHoleCount ?? 0),
    averageEscapeTime: Number(entry.averageEscapeTime ?? entry.escapeTime ?? 0),
  };
};

const getWeekStart = (date) => {
  const value = new Date(date);
  const day = value.getDay();
  const diff = value.getDate() - day + (day === 0 ? -6 : 1);
  value.setDate(diff);
  value.setHours(0, 0, 0, 0);
  return value;
};

const formatLabel = (dateString, timeframe) => {
  const value = new Date(dateString);

  if (timeframe === 'monthly') {
    return value.toLocaleDateString('en-US', { month: 'short' });
  }

  if (timeframe === 'weekly') {
    return `Wk ${value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const buildStreaks = (items) => {
  let currentStreak = 0;

  return items.map((item) => {
    currentStreak = item.resilienceScore >= 60 ? currentStreak + 1 : 0;
    return { ...item, streaks: currentStreak };
  });
};

const aggregateEntries = (entries, timeframe) => {
  const groups = new Map();

  entries.forEach((entry) => {
    const date = new Date(entry.date);
    let groupKey = entry.date;
    let groupDate = new Date(date);

    if (timeframe === 'weekly') {
      groupDate = getWeekStart(date);
      groupKey = groupDate.toISOString().slice(0, 10);
    }

    if (timeframe === 'monthly') {
      groupDate = new Date(date.getFullYear(), date.getMonth(), 1);
      groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    }

    const current = groups.get(groupKey) || {
      key: groupKey,
      date: groupKey,
      label: formatLabel(groupKey, timeframe),
      resilienceTotal: 0,
      rabbitHoleTotal: 0,
      escapeTotal: 0,
      count: 0,
    };

    current.resilienceTotal += entry.resilienceScore;
    current.rabbitHoleTotal += entry.rabbitHole;
    current.escapeTotal += entry.averageEscapeTime;
    current.count += 1;

    groups.set(groupKey, current);
  });

  const aggregated = Array.from(groups.values())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((item) => ({
      date: item.date,
      label: item.label,
      resilienceScore: Math.round(item.resilienceTotal / item.count),
      rabbitHole: Math.round(item.rabbitHoleTotal / item.count),
      averageEscapeTime: Math.round(item.escapeTotal / item.count),
    }));

  return buildStreaks(aggregated);
};

const getMetricConfig = (metric) =>
  METRIC_OPTIONS.find((option) => option.id === metric) || METRIC_OPTIONS[0];

const getSummary = (chartData, metric) => {
  const values = chartData.map((item) => Number(item[metric] ?? 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  const average = values.length ? Math.round(total / values.length) : 0;
  const highest = values.length ? Math.max(...values) : 0;
  const change = values.length > 1 ? values[values.length - 1] - values[0] : 0;

  return { average, highest, change };
};

const Analytics = () => {
  const [timeframe, setTimeframe] = useState('daily');
  const [metric, setMetric] = useState('resilienceScore');
  const [storedEntries, setStoredEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadAnalytics = async () => {
      setLoading(true);
      const history = await getDailyAnalyticsHistory();
      if (isMounted) {
        setStoredEntries(history);
        setLoading(false);
      }
    };

    loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, []);

  const rawEntries = storedEntries.length > 0 ? storedEntries : SAMPLE_ENTRIES;
  const normalizedEntries = rawEntries.map(normalizeEntry);
  const chartData = aggregateEntries(normalizedEntries, timeframe);
  const metricConfig = getMetricConfig(metric);
  const summary = getSummary(chartData, metric);
  const usingSampleData = storedEntries.length === 0;

  return (
    <div className="analytics-page">
      <div className="page-header">
        <div className="breadcrumb">Pages / Analytics</div>
        <h1 className="page-title">Analytics Dashboard</h1>
        <p className="page-subtitle">
          Switch between daily, weekly, and monthly views, then compare resilience score,
          rabbit holes, streaks, and average escape time on the same page.
        </p>
      </div>

      <section className="panel analytics-filter-panel">
        <div className="analytics-filter-group">
          <span className="analytics-filter-label">Graph Range</span>
          <div className="analytics-filter-row">
            {TIMEFRAME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`analytics-chip ${timeframe === option.id ? 'active' : ''}`}
                onClick={() => setTimeframe(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="analytics-filter-group">
          <span className="analytics-filter-label">Metric</span>
          <div className="analytics-filter-row analytics-filter-row-metrics">
            {METRIC_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`analytics-chip analytics-chip-metric ${
                  metric === option.id ? 'active' : ''
                }`}
                onClick={() => setMetric(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="analytics-summary">
        <div className="panel analytics-stat-card">
          <span className="analytics-stat-label">Average</span>
          <strong className="analytics-stat-value">
            {summary.average}
            {metricConfig.unit}
          </strong>
          <span className="analytics-stat-note">{metricConfig.label} across selected range</span>
        </div>

        <div className="panel analytics-stat-card">
          <span className="analytics-stat-label">Highest Point</span>
          <strong className="analytics-stat-value">
            {summary.highest}
            {metricConfig.unit}
          </strong>
          <span className="analytics-stat-note">Peak value in this chart</span>
        </div>

        <div className="panel analytics-stat-card">
          <span className="analytics-stat-label">Net Change</span>
          <strong className="analytics-stat-value">
            {summary.change > 0 ? '+' : ''}
            {summary.change}
            {metricConfig.unit}
          </strong>
          <span className="analytics-stat-note">
            {timeframe.charAt(0).toUpperCase() + timeframe.slice(1)} trend movement
          </span>
        </div>
      </section>

      <section className="panel analytics-chart-panel">
        <div className="analytics-panel-header">
          <div>
            <h2 className="analytics-panel-title">{metricConfig.label} Graph</h2>
            <p className="analytics-panel-copy">
              The chart automatically re-groups your analytics data by the selected timeframe.
              {loading ? ' Loading saved history...' : ''}
            </p>
          </div>
          <div className={`analytics-badge ${usingSampleData ? 'is-sample' : ''}`}>
            {usingSampleData ? 'Sample Data' : 'Real Entry Data'}
          </div>
        </div>

        <div className="analytics-chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metricConfig.color} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={metricConfig.color} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#19191c',
                  border: '1px solid #2e2e32',
                  borderRadius: '12px',
                  color: '#f8fafc',
                }}
                formatter={(value) => [`${value}${metricConfig.unit}`, metricConfig.label]}
                cursor={{ stroke: 'rgba(255, 138, 0, 0.35)', strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey={metric} stroke="none" fill="url(#analyticsFill)" />
              <Line
                type="monotone"
                dataKey={metric}
                stroke={metricConfig.color}
                strokeWidth={3}
                dot={{ r: 4, fill: metricConfig.color, stroke: '#141416', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#fff', stroke: metricConfig.color, strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

export default Analytics;
