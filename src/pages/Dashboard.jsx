import React, { useEffect, useRef, useState } from 'react';
import { Flame, Orbit, ShieldCheck, TimerReset } from 'lucide-react';

const metrics = [
  {
    title: 'Reciliance Score',
    value: '82',
    detail: '+6% from last week',
    icon: ShieldCheck,
  },
  {
    title: 'Rabbit Holes',
    value: '14',
    detail: '3 fewer this week',
    icon: Orbit,
  },
  {
    title: 'Average Escape Time',
    value: '7.4',
    detail: 'Recovered in 12 min avg',
    icon: TimerReset,
  },
  {
    title: 'Streaks',
    value: '9 days',
    detail: 'Best streak this month',
    icon: Flame,
  },
];

const resilienceBreakdown = [
  {
    task: 'Healthy Sleep Routine',
    time: '2:00 AM - 7:00 AM',
    score: '+6',
    note: 'A full sleep cycle supported better focus and recovery.',
    positive: true,
  },
  {
    task: 'Late-Night Snacking',
    time: '7:15 AM - 7:35 AM',
    score: '-1',
    note: 'Late eating slightly impacted sleep quality and recovery.',
    positive: false,
  },
  {
    task: 'Morning Exercise',
    time: '8:00 AM - 8:45 AM',
    score: '+4',
    note: 'Workout boosted energy and improved consistency for the day.',
    positive: true,
  },
  {
    task: 'Social Media Scroll',
    time: '10:30 AM - 11:10 AM',
    score: '-3',
    note: 'Unplanned scrolling interrupted your mid-day focus.',
    positive: false,
  },
  {
    task: 'Study Session',
    time: '11:30 AM - 1:30 PM',
    score: '+3',
    note: 'Focused work block completed as planned.',
    positive: true,
  },
  {
    task: 'Task Switching',
    time: '2:00 PM - 2:45 PM',
    score: '-2',
    note: 'Jumping between tasks reduced progress on the main goal.',
    positive: false,
  },
  {
    task: 'Deep Work Block',
    time: '3:00 PM - 5:00 PM',
    score: '+5',
    note: 'Two uninterrupted hours on a priority task added strong momentum.',
    positive: true,
  },
  {
    task: 'Evening Walk',
    time: '5:30 PM - 6:00 PM',
    score: '+2',
    note: 'A short walk helped reset your attention and reduced stress.',
    positive: true,
  },
  {
    task: 'Watching Netflix',
    time: '7:00 PM - 10:00 PM',
    score: '-4',
    note: 'Extended passive screen time pulled the score down.',
    positive: false,
  },
  {
    task: 'Reading',
    time: '10:15 PM - 11:00 PM',
    score: '+2',
    note: 'Intentional offline time improved mental clarity.',
    positive: true,
  },
  {
    task: 'Journaling',
    time: '11:10 PM - 11:25 PM',
    score: '+1',
    note: 'Reflection helped you process the day and stay aligned.',
    positive: true,
  },
];

const rabbitHoleBreakdown = [
  {
    incident: 'Late-Night Scroll Spiral',
    time: '12:40 AM - 1:50 AM',
    duration: '70 min',
    impact: '-5 focus',
    entries: ['Instagram reels', 'YouTube shorts', 'Random browsing'],
    note: 'Consecutive non-productive entries were merged into one rabbit hole incident.',
  },
  {
    incident: 'Mid-Morning Drift',
    time: '10:30 AM - 11:10 AM',
    duration: '40 min',
    impact: '-3 focus',
    entries: ['Social media scroll', 'Meme pages', 'Chat hopping'],
    note: 'Short distractions stacked together, so they appear as one incident.',
  },
  {
    incident: 'Post-Lunch Avoidance Loop',
    time: '2:00 PM - 2:45 PM',
    duration: '45 min',
    impact: '-2 focus',
    entries: ['Task switching', 'Notification checking', 'Inbox refresh'],
    note: 'This rabbit hole groups consecutive avoidance behaviors in the same window.',
  },
  {
    incident: 'Entertainment Sink',
    time: '7:00 PM - 10:00 PM',
    duration: '3 hr',
    impact: '-4 focus',
    entries: ['Netflix binge', 'Trailer browsing', 'Episode autoplay'],
    note: 'Extended passive consumption was merged into a single evening incident.',
  },
  {
    incident: 'Pre-Sleep Drift',
    time: '11:35 PM - 12:15 AM',
    duration: '40 min',
    impact: '-2 focus',
    entries: ['Online shopping', 'Recommendation feed', 'Random tabs'],
    note: 'Back-to-back low-value browsing formed one final rabbit hole.',
  },
];

const escapeTimeBreakdown = [
  {
    label: 'Social Scroll',
    minutes: 18,
    color: '#4f000b',
  },
  {
    label: 'Video Drift',
    minutes: 12,
    color: '#7b1509',
  },
  {
    label: 'Notification Checking',
    minutes: 8,
    color: '#a72906',
  },
  {
    label: 'Idle Switching',
    minutes: 6,
    color: '#d33d03',
  },
  {
    label: 'Passive Browsing',
    minutes: 5,
    color: '#ff5100',
  },
];

const getStartMinutes = (timeRange) => {
  const [start] = timeRange.split(' - ');
  const [time, meridiem] = start.split(' ');
  const [hoursString, minutesString] = time.split(':');

  let hours = Number(hoursString);
  const minutes = Number(minutesString);
  const period = meridiem.toUpperCase();

  if (period === 'AM' && hours === 12) hours = 0;
  if (period === 'PM' && hours !== 12) hours += 12;

  return hours * 60 + minutes;
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

const totalEscapeTime = escapeTimeBreakdown.reduce((total, item) => total + item.minutes, 0);
const escapeEvents = 4;
const averageEscapeTime = Math.round((totalEscapeTime / escapeEvents) * 10) / 10;

const Dashboard = () => {
  const [showResilienceOverview, setShowResilienceOverview] = useState(false);
  const [showRabbitHoleOverview, setShowRabbitHoleOverview] = useState(false);
  const [showEscapeTimeOverview, setShowEscapeTimeOverview] = useState(false);
  const [activeEscapeSlice, setActiveEscapeSlice] = useState(escapeTimeBreakdown[0].label);
  const [hoveredEscapeSlice, setHoveredEscapeSlice] = useState(null);
  const resilienceSectionRef = useRef(null);
  const rabbitHoleSectionRef = useRef(null);
  const escapeTimeSectionRef = useRef(null);
  const sortedResilienceBreakdown = [...resilienceBreakdown].sort(
    (first, second) => getStartMinutes(first.time) - getStartMinutes(second.time)
  );
  const sortedRabbitHoleBreakdown = [...rabbitHoleBreakdown].sort(
    (first, second) => getStartMinutes(first.time) - getStartMinutes(second.time)
  );

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

  const handleResilienceClick = () => {
    setShowResilienceOverview(true);
    if (resilienceSectionRef.current) {
      resilienceSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleRabbitHoleClick = () => {
    setShowRabbitHoleOverview(true);
    if (rabbitHoleSectionRef.current) {
      rabbitHoleSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleEscapeTimeClick = () => {
    setShowEscapeTimeOverview(true);
    if (escapeTimeSectionRef.current) {
      escapeTimeSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const activeEscapeSegment =
    escapeTimeBreakdown.find((segment) => segment.label === activeEscapeSlice) ?? escapeTimeBreakdown[0];
  const highlightedEscapeLabel = hoveredEscapeSlice ?? activeEscapeSegment.label;
  const highlightedEscapeSegment =
    escapeTimeBreakdown.find((segment) => segment.label === highlightedEscapeLabel) ?? activeEscapeSegment;

  return (
    <div>
      <div className="page-header">
        <div className="breadcrumb">Pages / Dashboard</div>
        <h1 className="page-title">Main Dashboard</h1>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {metrics.map(({ title, value, detail, icon: Icon }) => {
          const isResilienceCard = title === 'Reciliance Score';
          const isRabbitHoleCard = title === 'Rabbit Holes';
          const isEscapeTimeCard = title === 'Average Escape Time';
          const isClickable = isResilienceCard || isRabbitHoleCard || isEscapeTimeCard;

          const handleClick = isResilienceCard
            ? handleResilienceClick
            : isRabbitHoleCard
              ? handleRabbitHoleClick
              : isEscapeTimeCard
                ? handleEscapeTimeClick
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
                {isResilienceCard && (
                  <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-nexora-accent">
                    Tap to view score breakdown
                  </p>
                )}
                {isRabbitHoleCard && (
                  <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-nexora-accent">
                    Tap to view incident breakdown
                  </p>
                )}
                {isEscapeTimeCard && (
                  <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-nexora-accent">
                    Tap to view escape time analysis
                  </p>
                )}
              </button>
            </article>
          );
        })}
      </section>

      <section
        ref={resilienceSectionRef}
        className="panel mt-6 rounded-2xl"
      >
        <div className="mb-6 flex flex-col gap-3 border-b border-nexora-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-nexora-muted">Resilience Overview</p>
            <h2 className="mt-1 text-2xl font-semibold text-nexora-text">How your resilience score is built</h2>
          </div>
          <div className="rounded-2xl border border-[rgba(255,138,0,0.18)] bg-[rgba(255,138,0,0.08)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-nexora-muted">Current Score</p>
            <p className="mt-1 text-3xl font-semibold text-nexora-accent">82</p>
          </div>
        </div>

        {showResilienceOverview ? (
          <div className="grid gap-4">
            {sortedResilienceBreakdown.map(({ task, time, score, note, positive }) => (
              <article
                key={`${task}-${time}`}
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
            <p className="max-w-md text-sm text-nexora-muted">
              Click the <span className="text-nexora-accent">Reciliance Score</span> card above to open the score
              breakdown for your tasks and habits.
            </p>
          </div>
        )}
      </section>

      <section
        ref={rabbitHoleSectionRef}
        className="panel mt-6 rounded-2xl"
      >
        <div className="mb-6 flex flex-col gap-3 border-b border-nexora-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-nexora-muted">Rabbit Hole Overview</p>
            <h2 className="mt-1 text-2xl font-semibold text-nexora-text">Merged non-productive incidents</h2>
          </div>
          <div className="rounded-2xl border border-[rgba(255,138,0,0.18)] bg-[rgba(255,138,0,0.08)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-nexora-muted">Detected Incidents</p>
            <p className="mt-1 text-3xl font-semibold text-nexora-accent">14</p>
          </div>
        </div>

        {showRabbitHoleOverview ? (
          <div className="grid gap-4">
            {sortedRabbitHoleBreakdown.map(({ incident, time, duration, impact, entries, note }) => (
              <article
                key={`${incident}-${time}`}
                className="rounded-2xl border border-nexora-border bg-[#202024] p-5"
              >
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
            <p className="max-w-md text-sm text-nexora-muted">
              Click the <span className="text-nexora-accent">Rabbit Holes</span> card above to open the merged
              incident breakdown below the resilience section.
            </p>
          </div>
        )}
      </section>

      <section
        ref={escapeTimeSectionRef}
        className="panel mt-6 rounded-2xl"
      >
        <div className="mb-6 flex flex-col gap-3 border-b border-nexora-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-nexora-muted">Escape Time Analysis</p>
            <h2 className="mt-1 text-2xl font-semibold text-nexora-text">
              Time from distraction onset to productive recovery
            </h2>
          </div>
          <div className="rounded-2xl border border-[rgba(255,138,0,0.18)] bg-[rgba(255,138,0,0.08)] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-nexora-muted">Average Escape Time</p>
            <p className="mt-1 text-3xl font-semibold text-nexora-accent">{averageEscapeTime} min</p>
          </div>
        </div>

        {showEscapeTimeOverview ? (
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

                        const path = buildDonutSlicePath(
                          center,
                          center,
                          outerRadius,
                          innerRadius,
                          startAngle,
                          endAngle
                        );

                        return (
                          <path
                            key={segment.label}
                            d={path}
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

                <p className="mt-6 text-center text-sm text-nexora-muted">
                  Hover a slice to preview it, then click to keep it selected.
                </p>
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
            <p className="max-w-md text-sm text-nexora-muted">
              Click the <span className="text-nexora-accent">Average Escape Time</span> card above to open the
              pie-chart view and calculation steps below the rabbit-hole section.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
