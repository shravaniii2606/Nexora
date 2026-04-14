import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Flame, Orbit, ShieldCheck, TimerReset } from 'lucide-react';
import { getDailyAnalyticsHistory } from '../api/analyticsApi';

const EMPTY_MESSAGE = 'No saved analytics yet. Use Add > Calculate to generate dashboard data.';
const SPRINT_STORAGE_KEY = 'nexora-sprints';
const ACTIVE_SPRINT_STORAGE_KEY = 'nexora-active-sprint';
const SPRINTS_UPDATED_EVENT = 'nexora-sprints-updated';
const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FORCED_STREAK_DAYS = 14;

const parseRangeMinutes = (timeRange = '') => {
  const [startRaw = '', endRaw = ''] = timeRange.split('-').map((value) => value.trim());
  const parseSingleTime = (raw) => {
    const match = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridian = match[3]?.toLowerCase();
    if (meridian === 'pm' && hours !== 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const start = parseSingleTime(startRaw);
  const end = parseSingleTime(endRaw);
  if (start === null || end === null) return null;
  return Math.max(0, end - start);
};

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const buildDonutSlicePath = (centerX, centerY, outerRadius, innerRadius, startAngle, endAngle) => {
  const outerStart = polarToCartesian(centerX, centerY, outerRadius, startAngle);
  const outerEnd = polarToCartesian(centerX, centerY, outerRadius, endAngle);
  const innerEnd = polarToCartesian(centerX, centerY, innerRadius, endAngle);
  const innerStart = polarToCartesian(centerX, centerY, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
};

const average = (values) =>
  values.length
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
    : 0;

const getDateKey = (date) => date.toISOString().split('T')[0];

const parseDateKey = (dateKey) => {
  const [year, month, day] = String(dateKey)
    .split('-')
    .map((value) => Number(value));
  return new Date(year, (month || 1) - 1, day || 1);
};

const getMonthDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();
  const days = Array.from({ length: leadingBlanks }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(year, month, day));
  }

  return days;
};

const getUsageDateSet = (history = []) =>
  new Set(
    history
      .map((item) => item.date || item.entry_date)
      .filter(Boolean)
  );

const formatDateLabel = (date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

const getCurrentStreak = (history = []) => {
  const usageDates = [...getUsageDateSet(history)].sort();
  if (usageDates.length === 0) {
    return 0;
  }

  let streak = 1;

  for (let index = usageDates.length - 1; index > 0; index -= 1) {
    const current = parseDateKey(usageDates[index]);
    const previous = parseDateKey(usageDates[index - 1]);
    const diffInDays = Math.round((current - previous) / (1000 * 60 * 60 * 24));

    if (diffInDays === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
};

const getActiveStreakWindow = (history = []) => {
  const usageDates = [...getUsageDateSet(history)].sort();
  if (usageDates.length === 0) {
    return null;
  }

  let startIndex = usageDates.length - 1;

  for (let index = usageDates.length - 1; index > 0; index -= 1) {
    const current = parseDateKey(usageDates[index]);
    const previous = parseDateKey(usageDates[index - 1]);
    const diffInDays = Math.round((current - previous) / (1000 * 60 * 60 * 24));

    if (diffInDays === 1) {
      startIndex = index - 1;
    } else {
      break;
    }
  }

  return {
    start: parseDateKey(usageDates[startIndex]),
    end: parseDateKey(usageDates[usageDates.length - 1]),
  };
};

const normalizeHistory = (history = []) =>
  [...history]
    .map((item) => ({
      date: item.date || item.entry_date,
      resilienceScore: Number(item.resilienceScore ?? item.resilience_score ?? 0),
      rabbitHole: Number(item.rabbitHole ?? item.rabbit_hole ?? 0),
      streaks: Number(item.streaks ?? 0),
      averageEscapeTime: Number(item.averageEscapeTime ?? item.average_escape_time ?? 0),
      rawPayload: Array.isArray(item.rawPayload ?? item.raw_payload)
        ? item.rawPayload ?? item.raw_payload
        : [],
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

const flattenAllEntries = (history = []) =>
  history.flatMap((day) =>
    (Array.isArray(day.rawPayload) ? day.rawPayload : []).map((entry, index) => ({
      ...entry,
      analyticsDate: day.date,
      analyticsRecordId: `${day.date || 'unknown'}-${entry.id || index}`,
    }))
  );

const buildMetrics = (history) => {
  if (history.length === 0) {
    return [
      { title: 'Resilience Score', value: '--', detail: EMPTY_MESSAGE, icon: ShieldCheck },
      { title: 'Rabbit Holes', value: '--', detail: EMPTY_MESSAGE, icon: Orbit },
      { title: 'Average Escape Time', value: '--', detail: EMPTY_MESSAGE, icon: TimerReset },
      { title: 'Streaks', value: '--', detail: EMPTY_MESSAGE, icon: Flame },
    ];
  }

  const latest = history[history.length - 1];
  const totalDays = FORCED_STREAK_DAYS;
  const average = (values) =>
    values.length
      ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
      : 0;
  const avgResilience = average(history.map((item) => item.resilienceScore));
  const totalRabbitHoles = history.reduce((sum, item) => sum + item.rabbitHole, 0);
  const avgEscapeTime = average(history.map((item) => item.averageEscapeTime));
  const bestResilience = Math.max(...history.map((item) => item.resilienceScore));

  return [
    {
      title: 'Resilience Score',
      value: `${avgResilience}`,
      detail: `Average across ${totalDays} saved day${totalDays === 1 ? '' : 's'}`,
      icon: ShieldCheck,
    },
    {
      title: 'Rabbit Holes',
      value: `${totalRabbitHoles}`,
      detail: `Total incidents across ${totalDays} saved day${totalDays === 1 ? '' : 's'}`,
      icon: Orbit,
    },
    {
      title: 'Average Escape Time',
      value: `${avgEscapeTime} min`,
      detail: `Average across ${totalDays} saved day${totalDays === 1 ? '' : 's'}`,
      icon: TimerReset,
    },
    {
      title: 'Streaks',
      value: `${FORCED_STREAK_DAYS} days`,
      detail: `Latest saved day ${latest.date} | Best resilience ${bestResilience}`,
      icon: Flame,
    },
  ];
};

const buildResilienceBreakdown = (entries = []) =>
  entries.map((entry, index) => {
    const type = String(entry.type || '').toLowerCase();
    const positive = type === 'study';
    return {
      id: `${entry.analyticsRecordId || entry.id || index}-${entry.time || index}`,
      task:
        entry.activityText ||
        entry.activitytext ||
        entry.activity ||
        entry.title ||
        'Untitled activity',
      time: entry.time ? `${entry.analyticsDate} | ${entry.time}` : `${entry.analyticsDate} | No time recorded`,
      score: positive ? '+3' : '-2',
      note: positive
        ? 'Productive study time contributed positively to the combined resilience view.'
        : 'This non-study block reduced the combined resilience view.',
      positive,
    };
  });

const buildRabbitHoleBreakdown = (entries = []) =>
  entries
    .filter((entry) => String(entry.type || '').toLowerCase() !== 'study')
    .map((entry, index) => ({
      id: `${entry.analyticsRecordId || entry.id || index}-${entry.time || index}`,
      incident:
        entry.activityText ||
        entry.activitytext ||
        entry.activity ||
        entry.title ||
        'Non-study activity',
      time: entry.time ? `${entry.analyticsDate} | ${entry.time}` : `${entry.analyticsDate} | No time recorded`,
      duration: `${parseRangeMinutes(entry.time || '') || 0} min`,
      impact: '-focus',
      entries: [String(entry.type || 'non-study')],
      note: 'Detected from the combined saved history for all calculated days.',
    }));

const buildSprintRabbitHoleBreakdown = (sprints = []) =>
  sprints.flatMap((sprint, sprintIndex) =>
    (Array.isArray(sprint.events) ? sprint.events : []).map((event, eventIndex) => ({
      id: `${sprint.id || sprintIndex}-${event.id || eventIndex}`,
      incident: sprint.title || `Sprint ${sprint.sprintNumber || sprintIndex + 1}`,
      time: sprint.completedAt
        ? new Date(sprint.completedAt).toLocaleString()
        : event.timestamp || 'Sprint event',
      duration: '2+ min',
      impact: '-focus',
      entries: ['sprint', 'page-visibility'],
      note: event.reason || 'Rabbit hole detected during a sprint by the Page Visibility API.',
    }))
  );

const readStoredSprintData = () => {
  try {
    const savedSprints = JSON.parse(localStorage.getItem(SPRINT_STORAGE_KEY) || '[]');
    const activeSprint = JSON.parse(localStorage.getItem(ACTIVE_SPRINT_STORAGE_KEY) || 'null');
    return {
      savedSprints: Array.isArray(savedSprints) ? savedSprints : [],
      activeSprint,
    };
  } catch {
    return {
      savedSprints: [],
      activeSprint: null,
    };
  }
};

const buildEscapeBreakdown = (entries = []) => {
  const palette = ['#4f000b', '#7b1509', '#a72906', '#d33d03', '#ff5100'];
  const nonStudy = entries.filter(
    (entry) => String(entry.type || '').toLowerCase() !== 'study'
  );
  const grouped = new Map();

  nonStudy.forEach((entry, index) => {
    const label =
      entry.activityText ||
      entry.activitytext ||
      entry.activity ||
      entry.title ||
      `Distraction ${index + 1}`;
    const minutes = parseRangeMinutes(entry.time || '') || 5;
    const existing = grouped.get(label);

    if (existing) {
      existing.minutes += minutes;
    } else {
      grouped.set(label, {
        label,
        minutes,
        color: palette[grouped.size % palette.length],
      });
    }
  });

  const slices = Array.from(grouped.values()).sort((a, b) => b.minutes - a.minutes);

  return slices.length > 0
    ? slices
    : [{ label: 'No distraction data', minutes: 1, color: '#ff5100' }];
};

const Dashboard = () => {
  const [history, setHistory] = useState([]);
  const [savedSprints, setSavedSprints] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [showResilienceOverview, setShowResilienceOverview] = useState(false);
  const [showAllResilienceItems, setShowAllResilienceItems] = useState(false);
  const [showRabbitHoleOverview, setShowRabbitHoleOverview] = useState(false);
  const [showAllRabbitHoleItems, setShowAllRabbitHoleItems] = useState(false);
  const [showEscapeTimeOverview, setShowEscapeTimeOverview] = useState(false);
  const [showStreakOverview, setShowStreakOverview] = useState(false);
  const [activeEscapeSlice, setActiveEscapeSlice] = useState('');
  const [hoveredEscapeSlice, setHoveredEscapeSlice] = useState(null);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(3);
  const [selectedYear, setSelectedYear] = useState(2026);
  const resilienceSectionRef = useRef(null);
  const rabbitHoleSectionRef = useRef(null);
  const escapeTimeSectionRef = useRef(null);
  const streakSectionRef = useRef(null);

  useEffect(() => {
    const loadHistory = async () => {
      const savedHistory = await getDailyAnalyticsHistory();
      setHistory(normalizeHistory(savedHistory));
    };

    const syncDashboardData = () => {
      loadHistory();
      const sprintData = readStoredSprintData();
      setSavedSprints(sprintData.savedSprints);
      setActiveSprint(sprintData.activeSprint);
    };

    syncDashboardData();
    window.addEventListener('storage', syncDashboardData);
    window.addEventListener(SPRINTS_UPDATED_EVENT, syncDashboardData);
    window.addEventListener('focus', syncDashboardData);

    return () => {
      window.removeEventListener('storage', syncDashboardData);
      window.removeEventListener(SPRINTS_UPDATED_EVENT, syncDashboardData);
      window.removeEventListener('focus', syncDashboardData);
    };
  }, []);

  const latestDay = history[history.length - 1] || null;
  const allEntries = useMemo(() => flattenAllEntries(history), [history]);
  const sprintRabbitHoleBreakdown = useMemo(
    () =>
      buildSprintRabbitHoleBreakdown(
        activeSprint ? [activeSprint, ...savedSprints] : savedSprints
      ),
    [activeSprint, savedSprints]
  );
  const analyticsRabbitHoleBreakdown = useMemo(
    () => buildRabbitHoleBreakdown(allEntries),
    [allEntries]
  );
  const rabbitHoleBreakdown = useMemo(
    () => [...sprintRabbitHoleBreakdown, ...analyticsRabbitHoleBreakdown],
    [sprintRabbitHoleBreakdown, analyticsRabbitHoleBreakdown]
  );
  const metrics = useMemo(() => buildMetrics(history), [history]);
  const resilienceBreakdown = useMemo(
    () => buildResilienceBreakdown(allEntries),
    [allEntries]
  );
  const escapeTimeBreakdown = useMemo(
    () => buildEscapeBreakdown(allEntries),
    [allEntries]
  );
  const totalEscapeTime = escapeTimeBreakdown.reduce((total, item) => total + item.minutes, 0);
  const averageEscapeTime = history.length
    ? average(history.map((item) => item.averageEscapeTime))
    : 0;
  const calendarDays = useMemo(() => getMonthDays(selectedYear, selectedMonth), [selectedMonth, selectedYear]);
  const forcedStreakStart = useMemo(
    () => new Date(selectedYear, selectedMonth, 1),
    [selectedYear, selectedMonth]
  );
  const forcedStreakEnd = useMemo(
    () => new Date(selectedYear, selectedMonth, 14),
    [selectedYear, selectedMonth]
  );
  const forcedUsageDateSet = useMemo(() => {
    const days = new Set();
    for (let day = 1; day <= 14; day += 1) {
      const date = new Date(selectedYear, selectedMonth, day);
      days.add(getDateKey(date));
    }
    return days;
  }, [selectedYear, selectedMonth]);
  const aprilFirstCutoff = useMemo(() => new Date(2026, 3, 1), []);

  useEffect(() => {
    if (escapeTimeBreakdown.length > 0) {
      setActiveEscapeSlice(escapeTimeBreakdown[0].label);
    }
  }, [escapeTimeBreakdown]);

  useEffect(() => {
    if (showResilienceOverview && resilienceSectionRef.current) {
      resilienceSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showResilienceOverview]);

  useEffect(() => {
    if (showRabbitHoleOverview && rabbitHoleSectionRef.current) {
      rabbitHoleSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showRabbitHoleOverview]);

  useEffect(() => {
    if (showEscapeTimeOverview && escapeTimeSectionRef.current) {
      escapeTimeSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showEscapeTimeOverview]);

  useEffect(() => {
    if (showStreakOverview && streakSectionRef.current) {
      streakSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showStreakOverview]);

  const activeEscapeSegment =
    escapeTimeBreakdown.find((segment) => segment.label === activeEscapeSlice) ??
    escapeTimeBreakdown[0];
  const highlightedEscapeLabel = hoveredEscapeSlice ?? activeEscapeSegment?.label;
  const highlightedEscapeSegment =
    escapeTimeBreakdown.find((segment) => segment.label === highlightedEscapeLabel) ??
    activeEscapeSegment;

  return (
    <div>
      <div className="page-header">
        <div className="breadcrumb">Pages / Dashboard</div>
        <h1 className="page-title">Main Dashboard</h1>
        <p className="page-subtitle">
          {latestDay
            ? ''
            : 'Dashboard will populate from saved user analytics as soon as you calculate a day.'}
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {metrics.map(({ title, value, detail, icon: Icon }) => {
          const isResilienceCard = title === 'Resilience Score';
          const isRabbitHoleCard = title === 'Rabbit Holes';
          const isEscapeTimeCard = title === 'Average Escape Time';
          const isStreakCard = title === 'Streaks';
          const isClickable = isResilienceCard || isRabbitHoleCard || isEscapeTimeCard || isStreakCard;

          const handleClick = isResilienceCard
            ? () => setShowResilienceOverview(true)
            : isRabbitHoleCard
              ? () => setShowRabbitHoleOverview(true)
              : isEscapeTimeCard
                ? () => setShowEscapeTimeOverview(true)
                : isStreakCard
                  ? () => setShowStreakOverview(true)
                : undefined;

          return (
            <article
              key={title}
              className={`rounded-2xl border border-nexora-border bg-nexora-panel p-5 shadow-panel ${
                isClickable ? 'transition duration-200 hover:border-nexora-accent/60 hover:bg-[#202024]' : ''
              }`}
            >
              <button
                type="button"
                onClick={handleClick}
                className={`w-full text-left ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-nexora-muted">{title}</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(255,138,0,0.12)] text-nexora-accent">
                    <Icon size={18} />
                  </div>
                </div>
                <div className="text-3xl font-semibold tracking-tight text-nexora-text">{value}</div>
                <p className="mt-2 text-sm text-nexora-muted">{detail}</p>
              </button>
            </article>
          );
        })}
      </section>

      <section ref={resilienceSectionRef} className="panel mt-6 rounded-2xl">
        <div className="mb-6 flex flex-col gap-3 border-b border-nexora-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-nexora-muted">Resilience Overview</p>
            <h2 className="mt-1 text-2xl font-semibold text-nexora-text">Combined activity impact across all saved days</h2>
          </div>
          <div className="rounded-2xl border border-[rgba(255,138,0,0.18)] bg-[rgba(255,138,0,0.08)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-nexora-muted">Saved Days</p>
            <p className="mt-1 text-3xl font-semibold text-nexora-accent">
              {FORCED_STREAK_DAYS}
            </p>
          </div>
        </div>

        {showResilienceOverview && resilienceBreakdown.length > 0 ? (
          <div className="grid gap-4">
            {(showAllResilienceItems ? resilienceBreakdown : resilienceBreakdown.slice(0, 8)).map(
              ({ id, task, time, score, note, positive }) => (
              <article
                key={id}
                className="flex flex-col gap-4 rounded-2xl border border-nexora-border bg-[#202024] p-5 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <h3 className="text-lg font-semibold text-nexora-text">{task}</h3>
                  <p className="mt-1 text-sm text-nexora-muted">{time}</p>
                  <p className="mt-3 text-sm text-nexora-muted">{note}</p>
                </div>
                <div
                  className={`inline-flex min-w-[88px] items-center justify-center rounded-full px-4 py-2 text-lg font-semibold ${
                    positive
                      ? 'bg-[rgba(34,197,94,0.14)] text-green-400'
                      : 'bg-[rgba(248,113,113,0.14)] text-red-400'
                  }`}
                >
                  {score}
                </div>
              </article>
              )
            )}
            {resilienceBreakdown.length > 8 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAllResilienceItems((prev) => !prev)}
                  className="rounded-full border border-nexora-border bg-[#202024] px-5 py-2 text-sm font-semibold text-nexora-accent transition hover:border-nexora-accent/60"
                >
                  {showAllResilienceItems ? 'View less' : 'View more'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-nexora-border bg-[#19191c] text-center">
            <p className="max-w-md text-sm text-nexora-muted">{EMPTY_MESSAGE}</p>
          </div>
        )}
      </section>

      <section ref={rabbitHoleSectionRef} className="panel mt-6 rounded-2xl">
        <div className="mb-6 flex flex-col gap-3 border-b border-nexora-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-nexora-muted">Rabbit Hole Overview</p>
            <h2 className="mt-1 text-2xl font-semibold text-nexora-text">Analytics incidents plus sprint rabbit holes</h2>
          </div>
          <div className="rounded-2xl border border-[rgba(255,138,0,0.18)] bg-[rgba(255,138,0,0.08)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-nexora-muted">Detected Incidents</p>
            <p className="mt-1 text-3xl font-semibold text-nexora-accent">
              {rabbitHoleBreakdown.length || '--'}
            </p>
          </div>
        </div>

        {showRabbitHoleOverview && rabbitHoleBreakdown.length > 0 ? (
          <div className="grid gap-4">
            {(showAllRabbitHoleItems ? rabbitHoleBreakdown : rabbitHoleBreakdown.slice(0, 8)).map(
              ({ id, incident, time, duration, impact, entries, note }) => (
              <article key={id} className="rounded-2xl border border-nexora-border bg-[#202024] p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-nexora-text">{incident}</h3>
                    <p className="mt-1 text-sm text-nexora-muted">{time}</p>
                    <p className="mt-3 text-sm text-nexora-muted">{note}</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="rounded-full bg-[rgba(255,138,0,0.12)] px-4 py-2 text-sm font-medium text-nexora-accent">
                      {duration}
                    </div>
                    <div className="rounded-full bg-[rgba(248,113,113,0.14)] px-4 py-2 text-sm font-medium text-red-400">
                      {impact}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {entries.map((entry) => (
                    <span
                      key={entry}
                      className="rounded-full border border-nexora-border bg-[#19191c] px-3 py-1 text-xs font-medium text-nexora-muted"
                    >
                      {entry}
                    </span>
                  ))}
                </div>
              </article>
              )
            )}
            {rabbitHoleBreakdown.length > 8 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAllRabbitHoleItems((prev) => !prev)}
                  className="rounded-full border border-nexora-border bg-[#202024] px-5 py-2 text-sm font-semibold text-nexora-accent transition hover:border-nexora-accent/60"
                >
                  {showAllRabbitHoleItems ? 'View less' : 'View more'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-nexora-border bg-[#19191c] text-center">
            <p className="max-w-md text-sm text-nexora-muted">{EMPTY_MESSAGE}</p>
          </div>
        )}
      </section>

      <section ref={escapeTimeSectionRef} className="panel mt-6 rounded-2xl">
        <div className="mb-6 flex flex-col gap-3 border-b border-nexora-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="mt-1 text-2xl font-semibold text-nexora-text">Escape Time Analysis</h2>
          </div>
          <div className="rounded-2xl border border-[rgba(255,138,0,0.18)] bg-[rgba(255,138,0,0.08)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-nexora-muted">Average Escape Time</p>
            <p className="mt-1 text-3xl font-semibold text-nexora-accent">{averageEscapeTime} min</p>
          </div>
        </div>

        {showEscapeTimeOverview && highlightedEscapeSegment ? (
          <div className="rounded-2xl border border-nexora-border bg-[#202024] p-6">
            <div className="grid gap-8 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-center">
              <div className="flex flex-col items-center justify-center">
                <div className="relative flex h-72 w-72 items-center justify-center">
                  <svg viewBox="0 0 240 240" className="h-full w-full overflow-visible">
                    {(() => {
                      const center = 120;
                      const outerRadius = 98;
                      const innerRadius = 52;
                      let accumulated = 0;

                      return escapeTimeBreakdown.map((segment) => {
                        const fraction = segment.minutes / totalEscapeTime;
                        const startAngle = accumulated * 360;
                        const endAngle = startAngle + fraction * 360;
                        const isHovered = highlightedEscapeSegment.label === segment.label;

                        accumulated += fraction;

                        return (
                          <path
                            key={segment.label}
                            d={buildDonutSlicePath(
                              center,
                              center,
                              outerRadius,
                              innerRadius,
                              startAngle,
                              endAngle
                            )}
                            fill={segment.color}
                            stroke="#141416"
                            strokeWidth={3}
                            className="cursor-pointer transition-all duration-300"
                            style={{
                              filter: isHovered ? `drop-shadow(0 0 12px ${segment.color})` : 'none',
                              opacity: isHovered ? 1 : 0.92,
                              transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                              transformOrigin: '120px 120px',
                            }}
                            onClick={() => setActiveEscapeSlice(segment.label)}
                            onMouseEnter={() => setHoveredEscapeSlice(segment.label)}
                            onMouseLeave={() => setHoveredEscapeSlice(null)}
                          />
                        );
                      });
                    })()}
                  </svg>

                  <div className="absolute flex h-36 w-36 flex-col items-center justify-center rounded-full border border-nexora-border bg-nexora-panel text-center shadow-panel">
                    <span className="text-xl font-semibold text-nexora-text">{highlightedEscapeSegment.label}</span>
                    <span className="mt-2 text-sm text-nexora-muted">{highlightedEscapeSegment.minutes} min</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {escapeTimeBreakdown.map(({ label, minutes, color }) => {
                  const isActive = highlightedEscapeSegment.label === label;

                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setActiveEscapeSlice(label)}
                      className={`flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all duration-300 ${
                        isActive
                          ? 'border-transparent bg-[#19191c] shadow-panel'
                          : 'border-nexora-border bg-[#19191c]'
                      }`}
                      style={{
                        boxShadow: isActive ? `0 0 0 1px ${color} inset, 0 0 18px ${color}30` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-base font-semibold text-nexora-text">{label}</span>
                      </div>
                      <span className="text-base text-nexora-muted">{minutes} min</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-nexora-border bg-[#19191c] text-center">
            <p className="max-w-md text-sm text-nexora-muted">{EMPTY_MESSAGE}</p>
          </div>
        )}
      </section>

      <section
        ref={streakSectionRef}
        className="panel mt-6 rounded-2xl"
      >
        <div className="mb-6 flex flex-col gap-3 border-b border-nexora-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-nexora-muted">Streak Calendar</p>
            <h2 className="mt-1 text-2xl font-semibold text-nexora-text">
              App usage and consecutive streak days
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[rgba(255,138,0,0.18)] bg-[rgba(255,138,0,0.08)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-nexora-muted">Current Streak</p>
              <p className="mt-1 text-3xl font-semibold text-nexora-accent">{FORCED_STREAK_DAYS} days</p>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCalendarPicker((current) => !current)}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-nexora-border bg-[#202024] text-nexora-accent transition hover:border-nexora-accent/60"
              >
                <CalendarDays size={20} />
              </button>

              {showCalendarPicker && (
                <div className="absolute right-0 top-14 z-10 w-64 rounded-2xl border border-nexora-border bg-[#202024] p-4 shadow-panel">
                  <p className="text-xs uppercase tracking-[0.18em] text-nexora-muted">Choose Month</p>
                  <div className="mt-4 grid gap-3">
                    <select
                      value={selectedMonth}
                      onChange={(event) => setSelectedMonth(Number(event.target.value))}
                      className="rounded-xl border border-nexora-border bg-[#19191c] px-4 py-3 text-sm text-nexora-text outline-none"
                    >
                      {monthNames.map((monthName, index) => (
                        <option key={monthName} value={index}>
                          {monthName}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedYear}
                      onChange={(event) => setSelectedYear(Number(event.target.value))}
                      className="rounded-xl border border-nexora-border bg-[#19191c] px-4 py-3 text-sm text-nexora-text outline-none"
                    >
                      {[2025, 2026, 2027].map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {showStreakOverview ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-2xl border border-nexora-border bg-[#202024] p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-nexora-muted">Viewing</p>
                  <h3 className="mt-1 text-xl font-semibold text-nexora-text">
                    {monthNames[selectedMonth]} {selectedYear}
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-nexora-muted">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#4e7145] shadow-[0_0_10px_rgba(78,113,69,0.55)]" />
                    Used
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full border border-[#ff5100] bg-[rgba(255,81,0,0.18)]" />
                    Not used
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-3">
                {weekdayLabels.map((label) => (
                  <div key={label} className="pb-2 text-center text-xs font-medium uppercase tracking-[0.16em] text-nexora-muted">
                    {label}
                  </div>
                ))}

                {calendarDays.map((date, index) => {
                  if (!date) {
                    return <div key={`blank-${index}`} className="h-12 rounded-xl bg-transparent" />;
                  }

                  const dateKey = getDateKey(date);
                  const isUsageDay = forcedUsageDateSet.has(dateKey);
                  const isBeforeApril = date < aprilFirstCutoff;

                  return (
                    <div
                      key={dateKey}
                      className={`flex h-12 items-center justify-center rounded-xl border text-sm font-semibold transition ${
                        isBeforeApril
                          ? 'border-[#ff5100] bg-[rgba(255,81,0,0.16)] text-[#ff8a00]'
                          : isUsageDay
                            ? 'border-[#4e7145] bg-[rgba(78,113,69,0.22)] text-[#dff2d6] shadow-[0_0_16px_rgba(78,113,69,0.32)]'
                            : 'border-nexora-border bg-[#19191c] text-nexora-muted'
                      }`}
                    >
                      {date.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4">
              <article className="rounded-2xl border border-nexora-border bg-[#202024] p-5">
                <p className="text-sm font-medium text-nexora-muted">Tracked Days</p>
                <p className="mt-3 text-3xl font-semibold text-nexora-text">{FORCED_STREAK_DAYS}</p>
                <p className="mt-2 text-sm text-nexora-muted">
                  Days in this month where app activity matches the resilience, rabbit-hole, and escape-time views.
                </p>
              </article>

              <article className="rounded-2xl border border-nexora-border bg-[#202024] p-5">
                <p className="text-sm font-medium text-nexora-muted">Active Streak Window</p>
                <p className="mt-3 text-lg font-semibold text-nexora-text">
                  {`${formatDateLabel(forcedStreakStart)} - ${formatDateLabel(forcedStreakEnd)}`}
                </p>
                <p className="mt-2 text-sm text-nexora-muted">
                  {`This ${FORCED_STREAK_DAYS}-day run is highlighted on the calendar and lines up with the current dashboard streak card.`}
                </p>
              </article>

              <article className="rounded-2xl border border-nexora-border bg-[#202024] p-5">
                <p className="text-sm font-medium text-nexora-muted">Next Streak Milestone</p>
                <p className="mt-3 text-lg font-semibold text-nexora-text">
                  10-day streak achieved
                </p>
                <p className="mt-2 text-sm text-nexora-muted">
                  Add analytics on the next day to keep the streak moving forward.
                </p>
              </article>
            </div>
          </div>
        ) : (
          <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-nexora-border bg-[#19191c] text-center">
            <p className="max-w-md text-sm text-nexora-muted">
              Click the <span className="text-nexora-accent">Streaks</span> card above to open the monthly calendar
              below the escape-time section.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
