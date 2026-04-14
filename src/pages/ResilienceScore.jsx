import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDailyAnalyticsHistory } from '../api/analyticsApi';

const SAMPLE_HISTORY = [
  { date: '2026-03-10', resilienceScore: 62 },
  { date: '2026-03-14', resilienceScore: 65 },
  { date: '2026-03-18', resilienceScore: 61 },
  { date: '2026-03-22', resilienceScore: 69 },
  { date: '2026-03-26', resilienceScore: 73 },
  { date: '2026-03-30', resilienceScore: 76 },
  { date: '2026-04-03', resilienceScore: 74 },
  { date: '2026-04-07', resilienceScore: 79 },
  { date: '2026-04-11', resilienceScore: 82 },
  { date: '2026-04-15', resilienceScore: 84 },
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const normalizeEntry = (entry, index) => {
  const fallback = SAMPLE_HISTORY[index % SAMPLE_HISTORY.length];

  return {
    date: entry.date || entry.entry_date || fallback.date,
    resilienceScore: Number(entry.resilienceScore ?? entry.resilience_score ?? fallback.resilienceScore),
  };
};

const parseDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatLabel = (dateString) =>
  parseDateKey(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

const formatFullDate = (dateString) =>
  parseDateKey(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const getAverage = (values) =>
  values.length
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
    : 0;

const getInsight = (currentScore) => {
  if (currentScore >= 80) {
    return 'Excellent resilience. Your recent focus patterns are holding up strongly.';
  }

  if (currentScore >= 65) {
    return 'Healthy resilience. You are staying fairly consistent with productive sessions.';
  }

  if (currentScore > 0) {
    return 'Resilience is still building. More steady study blocks should lift this score.';
  }

  return 'No resilience score was saved for this date yet.';
};

const getCalendarDays = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const days = Array.from({ length: leadingBlanks }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(year, month, day));
  }

  return days;
};

const getSampleMetricBundle = (dateKey) => {
  const seed = String(dateKey)
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return {
    recoverySpeed: 12 + (seed % 14),
    distractionDepth: 18 + ((seed * 3) % 35),
    productiveRecovery: 48 + ((seed * 5) % 39),
  };
};

const ResilienceScore = () => {
  const [storedHistory, setStoredHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      setLoading(true);
      const history = await getDailyAnalyticsHistory();

      if (isMounted) {
        setStoredHistory(history);
        setLoading(false);
      }
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  const rawHistory = storedHistory.length > 0 ? storedHistory : SAMPLE_HISTORY;
  const normalizedHistory = useMemo(
    () => rawHistory.map(normalizeEntry).sort((a, b) => new Date(a.date) - new Date(b.date)),
    [rawHistory]
  );
  const scoreByDate = useMemo(
    () => new Map(normalizedHistory.map((item) => [item.date, item.resilienceScore])),
    [normalizedHistory]
  );
  const scores = normalizedHistory.map((item) => item.resilienceScore);
  const latest = normalizedHistory[normalizedHistory.length - 1];
  const average = getAverage(scores);
  const highest = scores.length ? Math.max(...scores) : 0;
  const usingSampleData = storedHistory.length === 0;

  useEffect(() => {
    if (!selectedDate && latest?.date) {
      setSelectedDate(latest.date);
      setVisibleMonth(parseDateKey(latest.date));
    }
  }, [latest, selectedDate]);

  const selectedScore = scoreByDate.get(selectedDate) ?? null;
  const selectedMetrics = getSampleMetricBundle(selectedDate || latest?.date || '2026-04-15');
  const calendarDays = getCalendarDays(visibleMonth);

  return (
    <div className="analytics-page resilience-page">
      <div className="page-header">
        <div className="breadcrumb">Pages / Resilience Score</div>
        <h1 className="page-title">Resilience Score</h1>
        <p className="page-subtitle">
          Pick a date on the calendar to inspect that day&apos;s resilience score and supporting
          recovery metrics.
        </p>
      </div>

      <section className="resilience-hero-grid">
        <div className="panel resilience-hero-card">
          <span className="resilience-hero-label">Selected Day</span>
          <strong className="resilience-hero-value">{selectedScore ?? '--'}</strong>
          <p className="resilience-hero-copy">{getInsight(selectedScore ?? 0)}</p>
          <span className={`analytics-badge ${usingSampleData ? 'is-sample' : ''}`}>
            {selectedDate ? formatFullDate(selectedDate) : 'Select a date'}
          </span>
        </div>

        <div className="resilience-stats-grid">
          <div className="panel analytics-stat-card">
            <span className="analytics-stat-label">Average Score</span>
            <strong className="analytics-stat-value">{average}</strong>
            <span className="analytics-stat-note">Average across saved resilience history</span>
          </div>

          <div className="panel analytics-stat-card">
            <span className="analytics-stat-label">Best Score</span>
            <strong className="analytics-stat-value">{highest}</strong>
            <span className="analytics-stat-note">Highest resilience day recorded so far</span>
          </div>

          <div className="panel analytics-stat-card">
            <span className="analytics-stat-label">Saved Days</span>
            <strong className="analytics-stat-value">{normalizedHistory.length}</strong>
            <span className="analytics-stat-note">
              {usingSampleData ? 'Showing sample data for now' : 'Dates available in your history'}
            </span>
          </div>
        </div>
      </section>

      <section className="resilience-bottom-grid">
        <div className="panel resilience-calendar-panel">
          <div className="resilience-calendar-header">
            <div>
              <h2 className="analytics-panel-title">Calendar</h2>
              <p className="analytics-panel-copy">
                Click any date to reflect that day&apos;s resilience score above.
              </p>
            </div>

            <div className="resilience-calendar-controls">
              <button
                type="button"
                className="resilience-month-button"
                onClick={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
                  )
                }
              >
                <ChevronLeft size={16} />
              </button>
              <span className="resilience-month-label">
                {visibleMonth.toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <button
                type="button"
                className="resilience-month-button"
                onClick={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1)
                  )
                }
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="resilience-calendar-grid resilience-calendar-weekdays">
            {WEEKDAY_LABELS.map((day) => (
              <span key={day} className="resilience-weekday">
                {day}
              </span>
            ))}
          </div>

          <div className="resilience-calendar-grid">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <div key={`blank-${index}`} className="resilience-calendar-empty" />;
              }

              const dateKey = toDateKey(day);
              const score = scoreByDate.get(dateKey);
              const isSelected = selectedDate === dateKey;
              const hasData = score !== undefined;

              return (
                <button
                  key={dateKey}
                  type="button"
                  className={`resilience-calendar-day ${isSelected ? 'active' : ''} ${
                    hasData ? 'has-data' : ''
                  }`}
                  onClick={() => setSelectedDate(dateKey)}
                >
                  <span className="resilience-day-number">{day.getDate()}</span>
                  <span className="resilience-day-score">{hasData ? score : '--'}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="resilience-metrics-stack">
          <div className="panel resilience-metric-card">
            <span className="analytics-stat-label">Recovery Speed</span>
            <strong className="analytics-stat-value">{selectedMetrics.recoverySpeed} min</strong>
            <span className="analytics-stat-note">Sample recovery time after a distraction on this date</span>
          </div>

          <div className="panel resilience-metric-card">
            <span className="analytics-stat-label">Distraction Depth</span>
            <strong className="analytics-stat-value">{selectedMetrics.distractionDepth}%</strong>
            <span className="analytics-stat-note">Sample estimate of how deep distractions became</span>
          </div>

          <div className="panel resilience-metric-card">
            <span className="analytics-stat-label">Productive Recovery</span>
            <strong className="analytics-stat-value">{selectedMetrics.productiveRecovery}%</strong>
            <span className="analytics-stat-note">Sample share of recovered time turned productive again</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ResilienceScore;
