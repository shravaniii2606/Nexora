import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Play, Pause, RotateCcw, Flag, Rabbit, Clock3, Target } from 'lucide-react';

const STORAGE_KEY = 'nexora-sprints';
const DEFAULT_DURATION = 25;
const DEFAULT_THRESHOLD_SECONDS = 120;
const RABBIT_HOLE_PENALTY = 10;

const createDefaultForm = () => ({
  title: '',
  focusTask: '',
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

const Sprints = () => {
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [form, setForm] = useState(createDefaultForm);
  const [savedSprints, setSavedSprints] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DURATION * 60);
  const [isRunning, setIsRunning] = useState(false);
  const hiddenAtRef = useRef(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSavedSprints(JSON.parse(stored));
      }
    } catch {
      setSavedSprints([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSprints));
    } catch {
      // Ignore storage failures in frontend-only mode.
    }
  }, [savedSprints]);

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
    const handleVisibilityChange = () => {
      if (!activeSprint || !isRunning) return;

      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }

      if (!hiddenAtRef.current) return;

      const hiddenForSeconds = Math.floor((Date.now() - hiddenAtRef.current) / 1000);
      hiddenAtRef.current = null;

      if (hiddenForSeconds >= DEFAULT_THRESHOLD_SECONDS) {
        registerRabbitHole(`Focus left for ${Math.floor(hiddenForSeconds / 60)}m ${hiddenForSeconds % 60}s`);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeSprint, isRunning]);

  const registerRabbitHole = (reason = 'Focus shifted away from the sprint task') => {
    setActiveSprint((current) => {
      if (!current) return current;
      const updatedRabbitHoles = current.rabbitHoles + 1;
      return {
        ...current,
        rabbitHoles: updatedRabbitHoles,
        focusScore: calculateScore(updatedRabbitHoles),
        events: [
          ...current.events,
          {
            id: `${Date.now()}-${updatedRabbitHoles}`,
            reason,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ],
      };
    });
  };

  const startSprint = () => {
    const durationMinutes = Number(form.durationMinutes) || DEFAULT_DURATION;
    const tools = form.tools.length > 0 ? form.tools : ['VS Code'];

    hiddenAtRef.current = null;
    setActiveSprint({
      id: `${Date.now()}`,
      title: form.title.trim() || `Sprint ${savedSprints.length + 1}`,
      focusTask: form.focusTask.trim() || 'Deep work session',
      durationMinutes,
      tools,
      rabbitHoles: 0,
      focusScore: 100,
      startedAt: new Date().toISOString(),
      events: [],
    });
    setTimeLeft(durationMinutes * 60);
    setIsRunning(true);
    setShowCreateCard(false);
    setForm(createDefaultForm());
  };

  const finishSprint = () => {
    setIsRunning(false);
    hiddenAtRef.current = null;

    setActiveSprint((current) => {
      if (!current) return null;
      const completedSprint = {
        ...current,
        completedAt: new Date().toISOString(),
        score: calculateScore(current.rabbitHoles),
      };
      setSavedSprints((previous) => [completedSprint, ...previous]);
      return null;
    });
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
        rabbitHolesPerSprint: 0,
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
      rabbitHolesPerSprint: (totalRabbitHoles / savedSprints.length).toFixed(1),
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
                <span>{activeSprint ? activeSprint.rabbitHoles : 0} rabbit holes</span>
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
          <p>Rabbit Holes Per Sprint</p>
          <h2>{summary.rabbitHolesPerSprint}</h2>
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
                <article key={sprint.id} className="sprint-history-card">
                  <div className="sprint-history-top">
                    <div>
                      <h3>{sprint.title}</h3>
                      <p>{sprint.focusTask}</p>
                    </div>
                    <div className="sprint-history-score">{sprint.score}</div>
                  </div>
                  <div className="sprint-history-meta">
                    <span>{sprint.durationMinutes} min</span>
                    <span>{sprint.rabbitHoles} rabbit holes</span>
                    <span>{new Date(sprint.completedAt).toLocaleString()}</span>
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
              When the page becomes hidden for more than 2 minutes, a rabbit hole is counted here.
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
