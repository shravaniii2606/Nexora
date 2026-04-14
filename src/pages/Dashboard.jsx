import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Orbit, ShieldCheck, TimerReset } from 'lucide-react';
import { getDailyAnalyticsHistory } from '../api/analyticsApi';

const EMPTY_MESSAGE = 'No saved analytics yet. Use Add > Calculate to generate dashboard data.';

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
  const previous = history[history.length - 2];
  const resilienceDelta = previous ? latest.resilienceScore - previous.resilienceScore : 0;
  const rabbitDelta = previous ? latest.rabbitHole - previous.rabbitHole : 0;
  const escapeDelta = previous ? latest.averageEscapeTime - previous.averageEscapeTime : 0;
  const streakDelta = previous ? latest.streaks - previous.streaks : 0;

  return [
    {
      title: 'Resilience Score',
      value: `${latest.resilienceScore}`,
      detail: previous
        ? `${resilienceDelta > 0 ? '+' : ''}${resilienceDelta} vs previous saved day`
        : `Latest score from ${latest.date}`,
      icon: ShieldCheck,
    },
    {
      title: 'Rabbit Holes',
      value: `${latest.rabbitHole}`,
      detail: previous
        ? `${rabbitDelta > 0 ? '+' : ''}${rabbitDelta} vs previous saved day`
        : `Latest count from ${latest.date}`,
      icon: Orbit,
    },
    {
      title: 'Average Escape Time',
      value: `${latest.averageEscapeTime} min`,
      detail: previous
        ? `${escapeDelta > 0 ? '+' : ''}${escapeDelta} min vs previous saved day`
        : `Latest average from ${latest.date}`,
      icon: TimerReset,
    },
    {
      title: 'Streaks',
      value: `${latest.streaks} days`,
      detail: previous
        ? `${streakDelta > 0 ? '+' : ''}${streakDelta} days vs previous saved day`
        : `Latest streak from ${latest.date}`,
      icon: Flame,
    },
  ];
};

const buildResilienceBreakdown = (entries = []) =>
  entries.map((entry, index) => {
    const type = String(entry.type || '').toLowerCase();
    const positive = type === 'study';
    return {
      id: `${entry.id || index}-${entry.time || index}`,
      task:
        entry.activityText ||
        entry.activitytext ||
        entry.activity ||
        entry.title ||
        'Untitled activity',
      time: entry.time || 'No time recorded',
      score: positive ? '+3' : '-2',
      note: positive
        ? 'Productive study time lifted your resilience for the day.'
        : 'This non-study block likely reduced your recovery momentum.',
      positive,
    };
  });

const buildRabbitHoleBreakdown = (entries = []) =>
  entries
    .filter((entry) => String(entry.type || '').toLowerCase() !== 'study')
    .map((entry, index) => ({
      id: `${entry.id || index}-${entry.time || index}`,
      incident:
        entry.activityText ||
        entry.activitytext ||
        entry.activity ||
        entry.title ||
        'Non-study activity',
      time: entry.time || 'No time recorded',
      duration: `${parseRangeMinutes(entry.time || '') || 0} min`,
      impact: '-focus',
      entries: [String(entry.type || 'non-study')],
      note: 'Detected from the saved raw payload for the selected day.',
    }));

const buildEscapeBreakdown = (entries = []) => {
  const palette = ['#4f000b', '#7b1509', '#a72906', '#d33d03', '#ff5100'];
  const slices = entries
    .filter((entry) => String(entry.type || '').toLowerCase() !== 'study')
    .map((entry, index) => ({
      label:
        entry.activityText ||
        entry.activitytext ||
        entry.activity ||
        entry.title ||
        `Distraction ${index + 1}`,
      minutes: parseRangeMinutes(entry.time || '') || 5,
      color: palette[index % palette.length],
    }));

  return slices.length > 0
    ? slices
    : [{ label: 'No distraction data', minutes: 1, color: '#ff5100' }];
};

const Dashboard = () => {
  const [history, setHistory] = useState([]);
  const [showResilienceOverview, setShowResilienceOverview] = useState(false);
  const [showRabbitHoleOverview, setShowRabbitHoleOverview] = useState(false);
  const [showEscapeTimeOverview, setShowEscapeTimeOverview] = useState(false);
  const [activeEscapeSlice, setActiveEscapeSlice] = useState('');
  const [hoveredEscapeSlice, setHoveredEscapeSlice] = useState(null);
  const resilienceSectionRef = useRef(null);
  const rabbitHoleSectionRef = useRef(null);
  const escapeTimeSectionRef = useRef(null);

  useEffect(() => {
    const loadHistory = async () => {
      const savedHistory = await getDailyAnalyticsHistory();
      setHistory(normalizeHistory(savedHistory));
    };

    loadHistory();
  }, []);

  const latestDay = history[history.length - 1] || null;
  const metrics = useMemo(() => buildMetrics(history), [history]);
  const resilienceBreakdown = useMemo(
    () => buildResilienceBreakdown(latestDay?.rawPayload || []),
    [latestDay]
  );
  const rabbitHoleBreakdown = useMemo(
    () => buildRabbitHoleBreakdown(latestDay?.rawPayload || []),
    [latestDay]
  );
  const escapeTimeBreakdown = useMemo(
    () => buildEscapeBreakdown(latestDay?.rawPayload || []),
    [latestDay]
  );
  const totalEscapeTime = escapeTimeBreakdown.reduce((total, item) => total + item.minutes, 0);
  const averageEscapeTime = latestDay?.averageEscapeTime ?? average(
    escapeTimeBreakdown.map((item) => item.minutes)
  );

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
            ? `Showing live dashboard data from ${latestDay.date}.`
            : 'Dashboard will populate from saved user analytics as soon as you calculate a day.'}
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {metrics.map(({ title, value, detail, icon: Icon }) => {
          const isResilienceCard = title === 'Resilience Score';
          const isRabbitHoleCard = title === 'Rabbit Holes';
          const isEscapeTimeCard = title === 'Average Escape Time';
          const isClickable = isResilienceCard || isRabbitHoleCard || isEscapeTimeCard;

          const handleClick = isResilienceCard
            ? () => setShowResilienceOverview(true)
            : isRabbitHoleCard
              ? () => setShowRabbitHoleOverview(true)
              : isEscapeTimeCard
                ? () => setShowEscapeTimeOverview(true)
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
            <h2 className="mt-1 text-2xl font-semibold text-nexora-text">Latest saved day activity impact</h2>
          </div>
          <div className="rounded-2xl border border-[rgba(255,138,0,0.18)] bg-[rgba(255,138,0,0.08)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-nexora-muted">Current Score</p>
            <p className="mt-1 text-3xl font-semibold text-nexora-accent">
              {latestDay ? latestDay.resilienceScore : '--'}
            </p>
          </div>
        </div>

        {showResilienceOverview && resilienceBreakdown.length > 0 ? (
          <div className="grid gap-4">
            {resilienceBreakdown.map(({ id, task, time, score, note, positive }) => (
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
            ))}
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
            <h2 className="mt-1 text-2xl font-semibold text-nexora-text">Latest non-study incidents</h2>
          </div>
          <div className="rounded-2xl border border-[rgba(255,138,0,0.18)] bg-[rgba(255,138,0,0.08)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-nexora-muted">Detected Incidents</p>
            <p className="mt-1 text-3xl font-semibold text-nexora-accent">
              {latestDay ? latestDay.rabbitHole : '--'}
            </p>
          </div>
        </div>

        {showRabbitHoleOverview && rabbitHoleBreakdown.length > 0 ? (
          <div className="grid gap-4">
            {rabbitHoleBreakdown.map(({ id, incident, time, duration, impact, entries, note }) => (
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
            ))}
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
            <p className="text-sm font-medium text-nexora-muted">Escape Time Analysis</p>
            <h2 className="mt-1 text-2xl font-semibold text-nexora-text">
              Recovery windows from the latest saved raw entries
            </h2>
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
                    <span className="text-xs uppercase tracking-[0.18em] text-nexora-muted">Selected</span>
                    <span className="mt-2 text-xl font-semibold text-nexora-text">{highlightedEscapeSegment.label}</span>
                    <span className="mt-1 text-sm text-nexora-muted">{highlightedEscapeSegment.minutes} min</span>
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
    </div>
  );
};

export default Dashboard;
