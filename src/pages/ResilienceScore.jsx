import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDailyAnalyticsHistory, getSprintSessions } from '../api/analyticsApi';

const SAMPLE_HISTORY = [
  {
    date: '2026-03-10',
    resilienceScore: 62,
    recoverySpeed: 68,
    distractionDepth: 57,
    productiveRecovery: 61,
  },
  {
    date: '2026-03-14',
    resilienceScore: 65,
    recoverySpeed: 71,
    distractionDepth: 60,
    productiveRecovery: 64,
  },
  {
    date: '2026-03-18',
    resilienceScore: 61,
    recoverySpeed: 66,
    distractionDepth: 58,
    productiveRecovery: 59,
  },
  {
    date: '2026-03-22',
    resilienceScore: 69,
    recoverySpeed: 74,
    distractionDepth: 63,
    productiveRecovery: 67,
  },
  {
    date: '2026-03-26',
    resilienceScore: 73,
    recoverySpeed: 77,
    distractionDepth: 69,
    productiveRecovery: 71,
  },
  {
    date: '2026-04-15',
    resilienceScore: 84,
    recoverySpeed: 88,
    distractionDepth: 79,
    productiveRecovery: 83,
  },
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const getInsight = (currentScore) => {
  if (currentScore >= 80) {
    return 'Excellent resilience. Your return-to-focus pattern is strong on this day.';
  }

  if (currentScore >= 65) {
    return 'Healthy resilience. Recoveries were solid even when attention drifted.';
  }

  if (currentScore > 0) {
    return 'Resilience is still building. Faster returns and longer focused recovery will lift this.';
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

const calculateSprintEventMetrics = (event, sprintDurationMs) => {
  const timeSpentDistracted = Number(event?.timeSpentDistracted ?? 0);
  const safeSprintDurationMs = Math.max(sprintDurationMs, 1);
  const remainingSprintTime = Math.max(Number(event?.remainingSprintTime ?? 0), 1);
  const focusTimeAfter = Math.max(Number(event?.focusTimeAfter ?? 0), 0);
  const timeToReturn = timeSpentDistracted / safeSprintDurationMs;

  return {
    recoverySpeed: clamp(1 - timeToReturn),
    distractionDepth: clamp(timeSpentDistracted / safeSprintDurationMs),
    productiveRecovery: clamp(focusTimeAfter / remainingSprintTime),
  };
};

const calculateSprintWiseMetrics = (sprints = []) => {
  const sprintValues = sprints
    .map((sprint) => {
      const sprintDurationMs = Number(sprint?.durationMinutes ?? 0) * 60 * 1000;
      const eventMetrics = (Array.isArray(sprint?.rabbitHoleLog) ? sprint.rabbitHoleLog : [])
        .map((event) => calculateSprintEventMetrics(event, sprintDurationMs));

      if (eventMetrics.length === 0) {
        return null;
      }

      return {
        recoverySpeed: getAverage(eventMetrics.map((item) => item.recoverySpeed * 100)),
        distractionDepth: getAverage(eventMetrics.map((item) => item.distractionDepth * 100)),
        productiveRecovery: getAverage(eventMetrics.map((item) => item.productiveRecovery * 100)),
      };
    })
    .filter(Boolean);

  if (sprintValues.length === 0) {
    return null;
  }

  return {
    recoverySpeed: getAverage(sprintValues.map((item) => item.recoverySpeed)),
    distractionDepth: getAverage(sprintValues.map((item) => item.distractionDepth)),
    productiveRecovery: getAverage(sprintValues.map((item) => item.productiveRecovery)),
    sprintCount: sprintValues.length,
  };
};

const calculateSprintSummaryMetrics = (sprint) => {
  const sprintDurationMs = Number(sprint?.durationMinutes ?? 0) * 60 * 1000;
  const eventMetrics = (Array.isArray(sprint?.rabbitHoleLog) ? sprint.rabbitHoleLog : [])
    .map((event) => calculateSprintEventMetrics(event, sprintDurationMs));

  if (eventMetrics.length === 0) {
    return {
      recoverySpeed: 100,
      distractionDepth: 0,
      productiveRecovery: 100,
      resilienceScore: 100,
    };
  }

  const recoverySpeed = getAverage(eventMetrics.map((item) => item.recoverySpeed * 100));
  const distractionDepth = getAverage(eventMetrics.map((item) => item.distractionDepth * 100));
  const productiveRecovery = getAverage(eventMetrics.map((item) => item.productiveRecovery * 100));
  const resilienceScore = Math.round(
    recoverySpeed * 0.4 + (100 - distractionDepth) * 0.3 + productiveRecovery * 0.3
  );

  return {
    recoverySpeed,
    distractionDepth,
    productiveRecovery,
    resilienceScore,
  };
};

const buildResilienceDataset = (analyticsHistory = [], sprintHistory = []) => {
  const sprintMap = new Map();

  sprintHistory.forEach((sprint) => {
    const dateKey = sprint?.date || (sprint?.completedAt ? new Date(sprint.completedAt).toISOString().slice(0, 10) : '');
    if (!dateKey) return;
    const metrics = calculateSprintSummaryMetrics(sprint);

    const current = sprintMap.get(dateKey) || {
      date: dateKey,
      resilienceScore: 0,
      recoverySpeed: 0,
      distractionDepth: 0,
      productiveRecovery: 0,
      count: 0,
    };

    current.resilienceScore += Number(metrics.resilienceScore ?? 0);
    current.recoverySpeed += Number(metrics.recoverySpeed ?? 0);
    current.distractionDepth += Number(metrics.distractionDepth ?? 0);
    current.productiveRecovery += Number(metrics.productiveRecovery ?? 0);
    current.count += 1;
    sprintMap.set(dateKey, current);
  });

  const sprintEntries = Array.from(sprintMap.values()).map((item) => ({
    date: item.date,
    resilienceScore: Math.round(item.resilienceScore / item.count),
    recoverySpeed: Math.round(item.recoverySpeed / item.count),
    distractionDepth: Math.round(item.distractionDepth / item.count),
    productiveRecovery: Math.round(item.productiveRecovery / item.count),
    source: 'sprint',
  }));

  if (sprintEntries.length > 0) {
    return sprintEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  const analyticsEntries = analyticsHistory
    .map((entry, index) => {
      const fallback = SAMPLE_HISTORY[index % SAMPLE_HISTORY.length];
      const resilienceScore = Number(entry.resilienceScore ?? entry.resilience_score ?? fallback.resilienceScore);

      return {
        date: entry.date || entry.entry_date || fallback.date,
        resilienceScore,
        recoverySpeed: fallback.recoverySpeed,
        distractionDepth: fallback.distractionDepth,
        productiveRecovery: fallback.productiveRecovery,
        source: 'analytics',
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return analyticsEntries.length > 0 ? analyticsEntries : SAMPLE_HISTORY.map((item) => ({ ...item, source: 'sample' }));
};

const ResilienceScore = () => {
  const [analyticsHistory, setAnalyticsHistory] = useState([]);
  const [savedSprints, setSavedSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());

  useEffect(() => {
    let isMounted = true;

    const loadResilienceData = async () => {
      setLoading(true);
      const [history, sprintHistory] = await Promise.all([
        getDailyAnalyticsHistory(),
        getSprintSessions(),
      ]);

      if (isMounted) {
        setAnalyticsHistory(history);
        setSavedSprints(sprintHistory);
        setLoading(false);
      }
    };

    loadResilienceData();
    window.addEventListener('storage', loadResilienceData);
    window.addEventListener('nexora-sprints-updated', loadResilienceData);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', loadResilienceData);
      window.removeEventListener('nexora-sprints-updated', loadResilienceData);
    };
  }, []);

  const resilienceHistory = useMemo(
    () => buildResilienceDataset(analyticsHistory, savedSprints),
    [analyticsHistory, savedSprints]
  );

  const byDate = useMemo(
    () => new Map(resilienceHistory.map((item) => [item.date, item])),
    [resilienceHistory]
  );

  const latest = resilienceHistory[resilienceHistory.length - 1];
  const scores = resilienceHistory.map((item) => item.resilienceScore);
  const average = getAverage(scores);
  const highest = scores.length ? Math.max(...scores) : 0;
  const usingSampleData = resilienceHistory.every((item) => item.source === 'sample');
  const usingSprintData = resilienceHistory.some((item) => item.source === 'sprint');

  useEffect(() => {
    if (!selectedDate && latest?.date) {
      setSelectedDate(latest.date);
      setVisibleMonth(parseDateKey(latest.date));
    }
  }, [latest, selectedDate]);

  const selectedEntry = byDate.get(selectedDate) || null;
  const calendarDays = getCalendarDays(visibleMonth);
  const selectedDateSprints = useMemo(
    () =>
      savedSprints.filter((sprint) => {
        if (!selectedDate) return false;
        const sprintDate =
          sprint?.date || (sprint?.completedAt ? new Date(sprint.completedAt).toISOString().slice(0, 10) : '');
        return sprintDate === selectedDate;
      }),
    [savedSprints, selectedDate]
  );
  const sprintWiseMetrics = useMemo(
    () => calculateSprintWiseMetrics(selectedDateSprints),
    [selectedDateSprints]
  );

  return (
    <div className="analytics-page resilience-page">
      <div className="page-header">
        <div className="breadcrumb">Pages / Resilience Score</div>
        <h1 className="page-title">Resilience Score</h1>
        <p className="page-subtitle">
          Built from sprint rabbit-hole recovery data using distraction time, return time, and
          focused recovery after each return.
        </p>
      </div>

      <section className="resilience-hero-grid">
        <div className="panel resilience-hero-card">
          <span className="resilience-hero-label">Selected Day</span>
          <strong className="resilience-hero-value">{selectedEntry?.resilienceScore ?? '--'}</strong>
          <p className="resilience-hero-copy">{getInsight(selectedEntry?.resilienceScore ?? 0)}</p>
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
            <span className="analytics-stat-label">Data Source</span>
            <strong className="analytics-stat-value">
              {usingSprintData ? 'Sprint' : usingSampleData ? 'Sample' : 'Analytics'}
            </strong>
            <span className="analytics-stat-note">
              {loading ? 'Loading saved history' : `${resilienceHistory.length} dates available`}
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
                Click any date to reflect that day&apos;s resilience score and recovery metrics.
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
              const entry = byDate.get(dateKey);
              const isSelected = selectedDate === dateKey;
              const hasData = Boolean(entry);

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
                  <span className="resilience-day-score">{hasData ? entry.resilienceScore : '--'}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="resilience-metrics-stack">
          <div className="panel resilience-metric-card">
            <span className="analytics-stat-label">Recovery Speed</span>
            <strong className="analytics-stat-value">
              {sprintWiseMetrics?.recoverySpeed ?? selectedEntry?.recoverySpeed ?? '--'}%
            </strong>
            <span className="analytics-stat-note">
              Formula: 1 - time to return
            </span>
          </div>

          <div className="panel resilience-metric-card">
            <span className="analytics-stat-label">Distraction Depth</span>
            <strong className="analytics-stat-value">
              {sprintWiseMetrics?.distractionDepth ?? selectedEntry?.distractionDepth ?? '--'}%
            </strong>
            <span className="analytics-stat-note">
              Formula: time spent distracted / sprint duration
            </span>
          </div>

          <div className="panel resilience-metric-card">
            <span className="analytics-stat-label">Productive Recovery</span>
            <strong className="analytics-stat-value">
              {sprintWiseMetrics?.productiveRecovery ?? selectedEntry?.productiveRecovery ?? '--'}%
            </strong>
            <span className="analytics-stat-note">
              Formula: focus time after return / remaining sprint time
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ResilienceScore;
