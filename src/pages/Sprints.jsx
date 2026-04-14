import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Play, Pause, RotateCcw, Flag, Rabbit, Clock3, Target } from 'lucide-react';
import { saveSprintSession } from '../api/analyticsApi';

const STORAGE_KEY = 'nexora-sprints';
const ACTIVE_SPRINT_STORAGE_KEY = 'nexora-active-sprint';
const SPRINTS_UPDATED_EVENT = 'nexora-sprints-updated';
const DEFAULT_DURATION = 25;
const DEFAULT_THRESHOLD_SECONDS = 120;
const RABBIT_HOLE_PENALTY = 10;
const getLocalDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const getTodayDate = () => getLocalDateKey();

const readStoredSprints = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const persistSprints = (sprints) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sprints));
    window.dispatchEvent(new Event(SPRINTS_UPDATED_EVENT));
  } catch {
    // Ignore storage failures in frontend-only mode.
  }
};

const persistActiveSprint = (sprint) => {
  try {
    if (sprint) {
      localStorage.setItem(ACTIVE_SPRINT_STORAGE_KEY, JSON.stringify(sprint));
    } else {
      localStorage.removeItem(ACTIVE_SPRINT_STORAGE_KEY);
    }
    window.dispatchEvent(new Event(SPRINTS_UPDATED_EVENT));
  } catch {
    // Ignore storage failures in frontend-only mode.
  }
};

const readStoredActiveSprint = () => {
  try {
    const stored = localStorage.getItem(ACTIVE_SPRINT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const createDefaultForm = () => ({
  title: '',
  focusTask: '',
  date: getTodayDate(),
  durationMinutes: DEFAULT_DURATION,
  toolInput: '',
  tools: ['VS Code', 'Google Classroom'],
});

const formatTime = (seconds) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const remainingSeconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
};

const calculateScore = (rabbitHoles) => Math.max(0, 100 - rabbitHoles * RABBIT_HOLE_PENALTY);

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const calculateResilienceMetrics = (event, sprintDurationMs) => {
  const safeSprintDurationMs = Math.max(sprintDurationMs, 1);
  const safeRemainingSprintTime = Math.max(event.remainingSprintTime || 0, 1);
  const timeToReturn = Number(event.timeSpentDistracted || 0) / safeSprintDurationMs;
  const recoverySpeed = clamp(1 - timeToReturn);
  const distractionDepth = clamp(Number(event.timeSpentDistracted || 0) / safeSprintDurationMs);
  const productiveRecovery = clamp((event.focusTimeAfter || 0) / safeRemainingSprintTime);
  const score =
    recoverySpeed * 0.4 +
    (1 - distractionDepth) * 0.3 +
    productiveRecovery * 0.3;

  return {
    recoverySpeed,
    distractionDepth,
    productiveRecovery,
    resilienceScore: Math.round(clamp(score) * 100),
  };
};

const finalizeRabbitHoleLog = (rabbitHoleLog = [], focusReturnTime, finalTimestamp, sprintDurationMs) => {
  if (!focusReturnTime || rabbitHoleLog.length === 0) {
    return rabbitHoleLog;
  }

  const nextLog = [...rabbitHoleLog];
  const lastIndex = nextLog.length - 1;
  const lastEvent = nextLog[lastIndex];

  if (!lastEvent || lastEvent.focusTimeAfter !== null) {
    return rabbitHoleLog;
  }

  const focusTimeAfter = Math.max(0, finalTimestamp - focusReturnTime);
  const enrichedEvent = {
    ...lastEvent,
    focusTimeAfter,
  };

  nextLog[lastIndex] = {
    ...enrichedEvent,
    metrics: calculateResilienceMetrics(enrichedEvent, sprintDurationMs),
  };

  return nextLog;
};

const getScoreStatus = (rabbitHoles) => {
  if (rabbitHoles === 0) {
    return { label: 'Focused', color: '#22c55e' };
  }

  if (rabbitHoles <= 2) {
    return { label: 'Mild Diversion', color: '#f59e0b' };
  }

  return { label: 'Distracted', color: '#ef4444' };
};

const Sprints = () => {
  const initialActiveSprint = readStoredActiveSprint();
  const initialRabbitHoles = Number(initialActiveSprint?.rabbitHoles) || 0;
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [form, setForm] = useState(createDefaultForm);
  const [savedSprints, setSavedSprints] = useState(() => readStoredSprints());
  const [activeSprint, setActiveSprint] = useState(initialActiveSprint);
  const [rabbitHoles, setRabbitHoles] = useState(initialRabbitHoles);
  const [isDistracted, setIsDistracted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(
    () => Number(initialActiveSprint?.timeLeftSeconds) || DEFAULT_DURATION * 60
  );
  const [isRunning, setIsRunning] = useState(() => Boolean(initialActiveSprint?.isRunning));
  const [visibilityDebug, setVisibilityDebug] = useState(
    () =>
      initialActiveSprint?.visibilityDebug || {
        hiddenAt: null,
        returnedAt: null,
        hiddenForSeconds: 0,
        status: initialActiveSprint ? 'Restored saved sprint' : 'Waiting for a running sprint',
      }
  );
  const hiddenAtRef = useRef(null);
  const diversionStart = useRef(null);
  const focusReturnTime = useRef(null);

  useEffect(() => {
    setRabbitHoles(Number(activeSprint?.rabbitHoles) || 0);
  }, [activeSprint?.rabbitHoles]);

  useEffect(() => {
    persistSprints(savedSprints);
  }, [savedSprints]);

  useEffect(() => {
    persistActiveSprint(activeSprint);
  }, [activeSprint]);

  useEffect(() => {
    if (!activeSprint) return;

    persistActiveSprint({
      ...activeSprint,
      timeLeftSeconds: timeLeft,
      isRunning,
      visibilityDebug,
    });
  }, [activeSprint, timeLeft, isRunning, visibilityDebug]);

  useEffect(() => {
    if (!isRunning || !activeSprint) return undefined;

    const intervalId = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          finishSprint();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isRunning, activeSprint]);

  useEffect(() => {
    const startDistraction = (reasonLabel = 'Tab hidden. Timing diversion...') => {
      if (!activeSprint || !isRunning || hiddenAtRef.current) return;

      const hiddenAt = Date.now();
      hiddenAtRef.current = hiddenAt;
      diversionStart.current = hiddenAt;
      setIsDistracted(true);
      setActiveSprint((current) => {
        if (!current) return current;
        const sprintDurationMs = current.durationMinutes * 60 * 1000;
        const nextRabbitHoleLog = finalizeRabbitHoleLog(
          current.rabbitHoleLog || [],
          focusReturnTime.current,
          hiddenAt,
          sprintDurationMs
        );

        if (nextRabbitHoleLog === (current.rabbitHoleLog || [])) {
          return current;
        }

        return {
          ...current,
          rabbitHoleLog: nextRabbitHoleLog,
        };
      });
      setVisibilityDebug({
        hiddenAt: new Date(hiddenAt).toLocaleTimeString(),
        returnedAt: null,
        hiddenForSeconds: 0,
        status: reasonLabel,
      });
    };

    const endDistraction = () => {
      if (!activeSprint || !isRunning || !hiddenAtRef.current) return;

      const returnedAt = Date.now();
      const hiddenForSeconds = Math.floor((returnedAt - hiddenAtRef.current) / 1000);
      const hiddenAtLabel = new Date(hiddenAtRef.current).toLocaleTimeString();
      setIsDistracted(false);
      focusReturnTime.current = returnedAt;
      hiddenAtRef.current = null;

      setVisibilityDebug({
        hiddenAt: hiddenAtLabel,
        returnedAt: new Date(returnedAt).toLocaleTimeString(),
        hiddenForSeconds,
        status:
          hiddenForSeconds >= DEFAULT_THRESHOLD_SECONDS
            ? 'Rabbit hole counted'
            : 'Returned before threshold',
      });

      if (hiddenForSeconds >= DEFAULT_THRESHOLD_SECONDS) {
        registerRabbitHole(
          `Focus left for ${Math.floor(hiddenForSeconds / 60)}m ${hiddenForSeconds % 60}s`,
          returnedAt
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        startDistraction('Tab hidden. Timing diversion...');
      } else if (document.visibilityState === 'visible') {
        endDistraction();
      }
    };

    const handleWindowBlur = () => {
      startDistraction('Window lost focus. Timing diversion...');
    };

    const handleWindowFocus = () => {
      endDistraction();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [activeSprint, isRunning]);

  const registerRabbitHole = (reason = 'Focus shifted away from the sprint task', returnTimestamp = Date.now()) => {
    setActiveSprint((current) => {
      if (!current) return current;
      const updatedRabbitHoles = current.rabbitHoles + 1;
      const distractionStart = diversionStart.current || returnTimestamp;
      const timeSpentDistracted = Math.max(0, returnTimestamp - distractionStart);
      const remainingSprintTime = Math.max(0, timeLeft * 1000);
      const rabbitHoleEvent = {
        id: `${Date.now()}-${updatedRabbitHoles}`,
        distractionStart,
        distractionEnd: returnTimestamp,
        timeSpentDistracted,
        remainingSprintTime,
        focusTimeAfter: null,
      };
      const next = {
        ...current,
        rabbitHoles: updatedRabbitHoles,
        focusScore: calculateScore(updatedRabbitHoles),
        timeLeftSeconds: timeLeft,
        isRunning,
        visibilityDebug,
        rabbitHoleLog: [...(current.rabbitHoleLog || []), rabbitHoleEvent],
        events: [
          ...current.events,
          {
            id: rabbitHoleEvent.id,
            reason,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ],
      };
      diversionStart.current = null;
      setRabbitHoles(updatedRabbitHoles);
      persistActiveSprint(next);
      return next;
    });
  };

  const startSprint = () => {
    const durationMinutes = Number(form.durationMinutes) || DEFAULT_DURATION;
    const tools = form.tools.length > 0 ? form.tools : ['VS Code'];
    const sprintId = `${Date.now()}`;

    hiddenAtRef.current = null;
    diversionStart.current = null;
    focusReturnTime.current = null;
    setRabbitHoles(0);
    setIsDistracted(false);
    setVisibilityDebug({
      hiddenAt: null,
      returnedAt: null,
      hiddenForSeconds: 0,
      status: 'Sprint running. Keep this tab visible to avoid rabbit holes.',
    });
    const nextActiveSprint = {
      id: sprintId,
      sprintId,
      sprintNumber: savedSprints.length + 1,
      title: form.title.trim() || `Sprint ${savedSprints.length + 1}`,
      focusTask: form.focusTask.trim() || 'Deep work session',
      sprintDate: form.date || getTodayDate(),
      durationMinutes,
      tools,
      rabbitHoles: 0,
      rabbitHoleLog: [],
      focusScore: 100,
      startedAt: new Date().toISOString(),
      events: [],
      timeLeftSeconds: durationMinutes * 60,
      isRunning: true,
      visibilityDebug: {
        hiddenAt: null,
        returnedAt: null,
        hiddenForSeconds: 0,
        status: 'Sprint running. Keep this tab visible to avoid rabbit holes.',
      },
    };
    persistActiveSprint(nextActiveSprint);
    setActiveSprint(nextActiveSprint);
    setTimeLeft(durationMinutes * 60);
    setIsRunning(true);
    setShowCreateCard(false);
    setForm(createDefaultForm());
  };

  const finishSprint = () => {
    setIsRunning(false);
    hiddenAtRef.current = null;
    diversionStart.current = null;
    setVisibilityDebug((current) => ({
      ...current,
      status: 'Sprint finished',
    }));

    setActiveSprint((current) => {
      if (!current) return null;
      const sprintDurationMs = current.durationMinutes * 60 * 1000;
      const finalizedRabbitHoleLog = finalizeRabbitHoleLog(
        current.rabbitHoleLog || [],
        focusReturnTime.current,
        Date.now(),
        sprintDurationMs
      );
      const averagedMetrics = finalizedRabbitHoleLog.length
        ? finalizedRabbitHoleLog.reduce(
            (totals, event) => ({
              recoverySpeed: totals.recoverySpeed + (event.metrics?.recoverySpeed || 0),
              distractionDepth: totals.distractionDepth + (event.metrics?.distractionDepth || 0),
              productiveRecovery: totals.productiveRecovery + (event.metrics?.productiveRecovery || 0),
              resilienceScore: totals.resilienceScore + (event.metrics?.resilienceScore || 0),
            }),
            { recoverySpeed: 0, distractionDepth: 0, productiveRecovery: 0, resilienceScore: 0 }
          )
        : null;
      const score = calculateScore(current.rabbitHoles);
      const scoreStatus = getScoreStatus(current.rabbitHoles);
      const completedAt = new Date().toISOString();
      const sprintDate = current.sprintDate || getLocalDateKey(current.startedAt || completedAt);
      const totalTimeSpentDistractedMs = finalizedRabbitHoleLog.reduce(
        (sum, event) => sum + Number(event.timeSpentDistracted || 0),
        0
      );
      const totalFocusTimeAfterReturnMs = finalizedRabbitHoleLog.reduce(
        (sum, event) => sum + Number(event.focusTimeAfter || 0),
        0
      );
      const averageTimeSpentDistractedMs = finalizedRabbitHoleLog.length
        ? Math.round(totalTimeSpentDistractedMs / finalizedRabbitHoleLog.length)
        : 0;
      const averageRemainingSprintTimeMs = finalizedRabbitHoleLog.length
        ? Math.round(
            finalizedRabbitHoleLog.reduce((sum, event) => sum + Number(event.remainingSprintTime || 0), 0) /
              finalizedRabbitHoleLog.length
          )
        : 0;
      const completedSprint = {
        ...current,
        sprintId: current.sprintId || current.id,
        completedAt,
        score,
        scoreStatus,
        rabbitHoleLog: finalizedRabbitHoleLog,
        resilienceMetrics: averagedMetrics
          ? {
              recoverySpeed: Math.round((averagedMetrics.recoverySpeed / finalizedRabbitHoleLog.length) * 100),
              distractionDepth: Math.round((averagedMetrics.distractionDepth / finalizedRabbitHoleLog.length) * 100),
              productiveRecovery: Math.round((averagedMetrics.productiveRecovery / finalizedRabbitHoleLog.length) * 100),
              resilienceScore: Math.round(averagedMetrics.resilienceScore / finalizedRabbitHoleLog.length),
            }
          : {
              recoverySpeed: 100,
              distractionDepth: 0,
              productiveRecovery: 100,
              resilienceScore: 100,
            },
        totals: {
          timeSpentDistractedMs: totalTimeSpentDistractedMs,
          focusTimeAfterReturnMs: totalFocusTimeAfterReturnMs,
          averageTimeSpentDistractedMs,
          averageRemainingSprintTimeMs,
        },
        timeLeftSeconds: 0,
        isRunning: false,
      };
      void saveSprintSession({
        ...completedSprint,
        date: sprintDate,
      });
      setSavedSprints((previous) => {
        const next = [completedSprint, ...previous];
        persistSprints(next);
        return next;
      });
      return null;
    });
    focusReturnTime.current = null;
    setRabbitHoles(0);
    persistActiveSprint(null);
    setTimeLeft(DEFAULT_DURATION * 60);
  };

  const resetBuilder = () => {
    setForm(createDefaultForm());
    setShowCreateCard(false);
  };

  const addTool = () => {
    const value = form.toolInput.trim();
    if (!value || form.tools.includes(value)) return;

    setForm((current) => ({
      ...current,
      tools: [...current.tools, value],
      toolInput: '',
    }));
  };

  const removeTool = (toolToRemove) => {
    setForm((current) => ({
      ...current,
      tools: current.tools.filter((tool) => tool !== toolToRemove),
    }));
  };

  const summary = useMemo(() => {
    if (savedSprints.length === 0) {
      return {
        totalSprints: 0,
        totalRabbitHoles: 0,
        overallFocusScore: 0,
        peakDistractionSprint: null,
      };
    }

    const totalRabbitHoles = savedSprints.reduce((sum, sprint) => sum + sprint.rabbitHoles, 0);
    const totalScore = savedSprints.reduce((sum, sprint) => sum + sprint.score, 0);
    const peakDistractionSprint = savedSprints.reduce(
      (peak, sprint) => (!peak || sprint.rabbitHoles > peak.rabbitHoles ? sprint : peak),
      null
    );

    return {
      totalSprints: savedSprints.length,
      totalRabbitHoles,
      overallFocusScore: Math.round(totalScore / savedSprints.length),
      peakDistractionSprint,
    };
  }, [savedSprints]);

  return (
    <div className="sprints-page">
      <div className="page-header">
        <div className="breadcrumb">Pages / Sprints</div>
        <h1 className="page-title">Sprint Focus Lab</h1>
        <p className="sprints-subtitle">
          Run 25-minute focus sprints, count rabbit holes at sprint level, and review your session summary.
        </p>
      </div>

      <section className="sprints-top-grid compact">
        <article className="panel sprint-hero-card">
          <div className="sprint-hero-header">
            <div>
              <p className="sprint-eyebrow">Sprint Timer</p>
              <h2>Rabbit Hole sprint tracking</h2>
            </div>
            <div className="sprint-badge">Threshold: 2 min focus loss</div>
          </div>

          <div className="sprint-timer-shell">
            <div className="sprint-timer-ring">
              <span>{formatTime(timeLeft)}</span>
              <small>{activeSprint ? activeSprint.title : 'No active sprint'}</small>
            </div>
            <div className="sprint-live-meta">
              <div className="sprint-stat-chip">
                <Rabbit size={16} />
                <span>{activeSprint ? rabbitHoles : 0} rabbit holes</span>
              </div>
              <div className="sprint-stat-chip">
                <Clock3 size={16} />
                <span>{isDistracted ? 'User is away from the sprint tab' : visibilityDebug.status}</span>
              </div>
            </div>
          </div>

          <div className="sprint-actions">
            {!activeSprint ? (
              <button type="button" className="sprint-primary-btn" onClick={() => setShowCreateCard(true)}>
                <Plus size={18} />
                <span>Add Sprint</span>
              </button>
            ) : (
              <>
                <button type="button" className="sprint-primary-btn" onClick={() => setIsRunning((current) => !current)}>
                  {isRunning ? <Pause size={18} /> : <Play size={18} />}
                  <span>{isRunning ? 'Pause Timer' : 'Resume Timer'}</span>
                </button>
                <button type="button" className="sprint-secondary-btn" onClick={finishSprint}>
                  <Flag size={18} />
                  <span>End Sprint</span>
                </button>
              </>
            )}
          </div>

          {activeSprint && (
            <div className="active-sprint-panel">
              <div>
                <p className="sprint-eyebrow">Current Focus Task</p>
                <h3>{activeSprint.focusTask}</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.55rem' }}>
                  Hidden at: {visibilityDebug.hiddenAt || '--'} | Returned at: {visibilityDebug.returnedAt || '--'} |
                  Away: {visibilityDebug.hiddenForSeconds}s
                </p>
              </div>
              <div className="active-tools">
                {activeSprint.tools.map((tool) => (
                  <span key={tool} className="tool-pill">{tool}</span>
                ))}
              </div>
            </div>
          )}
        </article>

      </section>

      {showCreateCard && !activeSprint && (
        <section className="panel sprint-builder-panel">
          <div className="sprint-section-header">
            <div>
              <p className="sprint-eyebrow">New Sprint</p>
              <h2>Configure your next focus sprint</h2>
            </div>
            <button type="button" className="sprint-ghost-btn" onClick={resetBuilder}>
              <RotateCcw size={16} />
              <span>Reset</span>
            </button>
          </div>

          <div className="sprint-form-grid">
            <label className="sprint-field">
              <span>Sprint name</span>
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Rabbit Hole Session 01"
              />
            </label>

            <label className="sprint-field">
              <span>Focus task</span>
              <input
                value={form.focusTask}
                onChange={(event) => setForm((current) => ({ ...current, focusTask: event.target.value }))}
                placeholder="Finish DSA practice set"
              />
            </label>

            <label className="sprint-field">
              <span>Timer duration</span>
              <input
                type="number"
                min="1"
                value={form.durationMinutes}
                onChange={(event) => setForm((current) => ({ ...current, durationMinutes: event.target.value }))}
              />
            </label>

            <label className="sprint-field">
              <span>Sprint date</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              />
            </label>

            <div className="sprint-field">
              <span>Rabbit hole rule</span>
              <div className="sprint-rule-card">
                Leaving the intended focus task for more than 2 minutes counts as one rabbit hole inside the sprint.
              </div>
            </div>
          </div>

          <div className="tools-builder">
            <div className="sprint-section-header">
              <div>
                <p className="sprint-eyebrow">Support Apps</p>
                <h3>Allowed tools for this sprint</h3>
              </div>
            </div>

            <div className="tools-input-row">
              <input
                value={form.toolInput}
                onChange={(event) => setForm((current) => ({ ...current, toolInput: event.target.value }))}
                placeholder="Add VS Code, Google Classroom, Docs..."
              />
              <button type="button" className="sprint-secondary-btn" onClick={addTool}>
                <Plus size={16} />
                <span>Add</span>
              </button>
            </div>

            <div className="tools-list">
              {form.tools.map((tool) => (
                <button key={tool} type="button" className="tool-pill removable" onClick={() => removeTool(tool)}>
                  {tool}
                  <span>x</span>
                </button>
              ))}
            </div>
          </div>

          <div className="builder-footer">
            <button type="button" className="sprint-primary-btn" onClick={startSprint}>
              <Play size={18} />
              <span>Start Sprint</span>
            </button>
          </div>
        </section>
      )}

      <section className="sprints-summary-grid">
        <article className="panel summary-card">
          <div className="summary-icon-wrap">
            <Clock3 size={18} />
          </div>
          <p>Total Sprints Completed</p>
          <h2>{summary.totalSprints}</h2>
        </article>

        <article className="panel summary-card">
          <div className="summary-icon-wrap">
            <Rabbit size={18} />
          </div>
          <p>Total Rabbit Holes</p>
          <h2>{summary.totalRabbitHoles}</h2>
        </article>

        <article className="panel summary-card">
          <div className="summary-icon-wrap">
            <Target size={18} />
          </div>
          <p>Overall Focus Score</p>
          <h2>{summary.overallFocusScore}</h2>
        </article>

        <article className="panel summary-card">
          <div className="summary-icon-wrap">
            <Flag size={18} />
          </div>
          <p>Peak Distraction Sprint</p>
          <h2>{summary.peakDistractionSprint ? summary.peakDistractionSprint.title : '--'}</h2>
          <small>
            {summary.peakDistractionSprint
              ? `${summary.peakDistractionSprint.rabbitHoles} rabbit holes`
              : 'Complete a sprint to see this'}
          </small>
        </article>
      </section>

      <section className="sprints-bottom-grid single-column">
        {savedSprints.length > 0 && (
          <article className="panel sprint-log-panel">
            <div className="sprint-section-header">
              <div>
                <p className="sprint-eyebrow">Session Summary</p>
                <h2>Completed sprint history</h2>
              </div>
            </div>

            <div className="sprint-history-list">
              {savedSprints.map((sprint) => (
                <article key={sprint.id || sprint.sprintId} className="sprint-history-card">
                  <div className="sprint-history-top">
                    <div>
                      <h3>{sprint.title}</h3>
                      <p>
                        Sprint {sprint.sprintNumber || '--'} | {sprint.focusTask}
                      </p>
                    </div>
                    <div className="sprint-history-score">{sprint.score}</div>
                  </div>
                  <div className="sprint-history-meta">
                    <span>{sprint.durationMinutes} min</span>
                    <span>{sprint.rabbitHoles} rabbit holes</span>
                    <span style={{ color: sprint.scoreStatus?.color || 'inherit' }}>
                      {sprint.scoreStatus?.label || 'Focused'}
                    </span>
                    <span>{new Date(sprint.completedAt).toLocaleDateString()}</span>
                  </div>
                </article>
              ))}
            </div>
          </article>
        )}

        <article className="panel sprint-log-panel">
          <div className="sprint-section-header">
            <div>
              <p className="sprint-eyebrow">Live Detection</p>
              <h2>Rabbit hole events in this sprint</h2>
            </div>
          </div>

          {!activeSprint || activeSprint.events.length === 0 ? (
            <div className="empty-sprint-state">
              When the page becomes hidden for more than 2 minutes, the Page Visibility API records a rabbit hole here.
            </div>
          ) : (
            <div className="event-list">
              {activeSprint.events.map((event) => (
                <div key={event.id} className="event-item">
                  <div className="event-dot" />
                  <div>
                    <strong>{event.reason}</strong>
                    <p>{event.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
};

export default Sprints;
