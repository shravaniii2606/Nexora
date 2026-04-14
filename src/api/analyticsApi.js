const STORAGE_KEY = 'dailyAnalyticsHistory';
const SPRINT_STORAGE_KEY = 'nexora-sprints';
const ACTIVE_SPRINT_STORAGE_KEY = 'nexora-active-sprint';
const SPRINT_SESSION_CACHE_KEY = 'nexora-sprint-sessions-cache';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ANALYTICS_USER_ID =
  import.meta.env.VITE_ANALYTICS_USER_ID || 'mockapi-default-user';

const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const sortByDate = (items) =>
  [...items].sort((a, b) => new Date(a.entry_date || a.date) - new Date(b.entry_date || b.date));

const readSprintRabbitHoleTotal = () => {
  if (typeof window === 'undefined') {
    return 0;
  }

  try {
    const savedSprints = JSON.parse(window.localStorage.getItem(SPRINT_STORAGE_KEY) || '[]');
    const activeSprint = JSON.parse(window.localStorage.getItem(ACTIVE_SPRINT_STORAGE_KEY) || 'null');
    const allSprints = [...(Array.isArray(savedSprints) ? savedSprints : []), ...(activeSprint ? [activeSprint] : [])];

    return allSprints.reduce((sum, sprint) => sum + Number(sprint?.rabbitHoles ?? 0), 0);
  } catch {
    return 0;
  }
};

const mergeSprintRabbitHolesIntoHistory = (records) => {
  const sprintRabbitHoleTotal = readSprintRabbitHoleTotal();
  const normalizedRecords = Array.isArray(records) ? sortByDate(records) : [];

  if (sprintRabbitHoleTotal === 0) {
    return normalizedRecords;
  }

  if (normalizedRecords.length === 0) {
    return [
      {
        date: new Date().toISOString().slice(0, 10),
        resilienceScore: 0,
        rabbitHole: sprintRabbitHoleTotal,
        streaks: 0,
        averageEscapeTime: 0,
        source: 'sprints',
        rawPayload: [],
      },
    ];
  }

  const merged = [...normalizedRecords];
  const latestIndex = merged.length - 1;
  merged[latestIndex] = {
    ...merged[latestIndex],
    rabbitHole: Number(merged[latestIndex].rabbitHole ?? merged[latestIndex].rabbit_hole ?? 0) + sprintRabbitHoleTotal,
  };

  return merged;
};

const readLocalAnalytics = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sortByDate(parsed) : [];
  } catch {
    return [];
  }
};

const writeLocalAnalytics = (records) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sortByDate(records)));
};

const readLocalSprintSessions = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SPRINT_SESSION_CACHE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? [...parsed].sort((a, b) => new Date(a.completedAt || a.completed_at) - new Date(b.completedAt || b.completed_at))
      : [];
  } catch {
    return [];
  }
};

const writeLocalSprintSessions = (records) => {
  if (typeof window === 'undefined') {
    return;
  }

  const sorted = [...records].sort(
    (a, b) => new Date(a.completedAt || a.completed_at) - new Date(b.completedAt || b.completed_at)
  );
  window.localStorage.setItem(SPRINT_SESSION_CACHE_KEY, JSON.stringify(sorted));
};

export const getDailyAnalyticsHistory = async () => {
  const localRecords = readLocalAnalytics();

  if (!hasSupabaseConfig) {
    return mergeSprintRabbitHolesIntoHistory(localRecords);
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/daily_analytics?select=entry_date,resilience_score,rabbit_hole,streaks,average_escape_time,source,raw_payload&user_id=eq.${encodeURIComponent(
        ANALYTICS_USER_ID
      )}&order=entry_date.asc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const normalized = Array.isArray(data)
      ? data.map((item) => ({
          date: item.entry_date,
          resilienceScore: Number(item.resilience_score ?? 0),
          rabbitHole: Number(item.rabbit_hole ?? 0),
          streaks: Number(item.streaks ?? 0),
          averageEscapeTime: Number(item.average_escape_time ?? 0),
          source: item.source || 'supabase',
          rawPayload: item.raw_payload ?? null,
        }))
      : [];

    if (normalized.length > 0) {
      writeLocalAnalytics(normalized);
      return mergeSprintRabbitHolesIntoHistory(normalized);
    }

    return mergeSprintRabbitHolesIntoHistory(localRecords);
  } catch {
    return mergeSprintRabbitHolesIntoHistory(localRecords);
  }
};

export const saveDailyAnalyticsRecord = async (record) => {
  const localRecords = readLocalAnalytics();
  const filtered = localRecords.filter((item) => item.date !== record.date);
  const nextRecords = [...filtered, record];
  writeLocalAnalytics(nextRecords);

  if (!hasSupabaseConfig) {
    return { success: false, source: 'local', reason: 'missing_config' };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/daily_analytics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      // Upsert by the unique per-day key on the table.
      body: JSON.stringify({
        user_id: ANALYTICS_USER_ID,
        entry_date: record.date,
        resilience_score: record.resilienceScore,
        rabbit_hole: record.rabbitHole ?? 0,
        streaks: record.streaks ?? 0,
        average_escape_time: record.averageEscapeTime,
        source: record.source || 'mockapi',
        raw_payload: record.rawPayload ?? null,
      }),
    });

    if (!response.ok) {
      const retryResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/daily_analytics?on_conflict=user_id,entry_date`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify({
            user_id: ANALYTICS_USER_ID,
            entry_date: record.date,
            resilience_score: record.resilienceScore,
            rabbit_hole: record.rabbitHole ?? 0,
            streaks: record.streaks ?? 0,
            average_escape_time: record.averageEscapeTime,
            source: record.source || 'mockapi',
            raw_payload: record.rawPayload ?? null,
          }),
        }
      );

      if (!retryResponse.ok) {
        const body = await retryResponse.text();
        return {
          success: false,
          source: 'local',
          reason: `supabase_save_failed:${retryResponse.status}`,
          details: body,
        };
      }
    }

    return { success: true, source: 'supabase' };
  } catch (error) {
    return {
      success: false,
      source: 'local',
      reason: 'network_or_runtime_error',
      details: error instanceof Error ? error.message : String(error),
    };
  }
};

export const saveAddCalculationRun = async (run) => {
  if (!hasSupabaseConfig) {
    return { success: false, source: 'local', reason: 'missing_config' };
  }

  try {
    const payload = {
      user_id: ANALYTICS_USER_ID,
      entry_date: run.date,
      resilience_score: run.resilienceScore,
      rabbit_hole: run.rabbitHole ?? 0,
      average_escape_time: run.averageEscapeTime,
      source: run.source || 'mockapi',
      raw_payload: run.rawPayload ?? null,
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/add_calculation_runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        source: 'supabase',
        reason: `insert_failed:${response.status}`,
        details: body,
      };
    }

    return { success: true, source: 'supabase' };
  } catch (error) {
    return {
      success: false,
      source: 'supabase',
      reason: 'network_or_runtime_error',
      details: error instanceof Error ? error.message : String(error),
    };
  }
};

export const getSprintSessions = async () => {
  const localRecords = readLocalSprintSessions();

  if (!hasSupabaseConfig) {
    return localRecords;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/sprint_sessions?select=sprint_id,sprint_number,title,focus_task,entry_date,started_at,completed_at,duration_minutes,rabbit_holes,focus_score,resilience_score,recovery_speed,distraction_depth,productive_recovery,total_time_spent_distracted_ms,total_focus_time_after_return_ms,average_time_spent_distracted_ms,average_remaining_sprint_time_ms,source,tools,rabbit_hole_log&user_id=eq.${encodeURIComponent(
        ANALYTICS_USER_ID
      )}&order=completed_at.asc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase sprint fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const normalized = Array.isArray(data)
      ? data.map((item) => ({
          sprintId: item.sprint_id,
          sprintNumber: Number(item.sprint_number ?? 0),
          title: item.title,
          focusTask: item.focus_task || '',
          date: item.entry_date,
          startedAt: item.started_at,
          completedAt: item.completed_at,
          durationMinutes: Number(item.duration_minutes ?? 0),
          rabbitHoles: Number(item.rabbit_holes ?? 0),
          focusScore: Number(item.focus_score ?? 0),
          resilienceMetrics: {
            resilienceScore: Number(item.resilience_score ?? 0),
            recoverySpeed: Number(item.recovery_speed ?? 0),
            distractionDepth: Number(item.distraction_depth ?? 0),
            productiveRecovery: Number(item.productive_recovery ?? 0),
          },
          totals: {
            timeSpentDistractedMs: Number(item.total_time_spent_distracted_ms ?? 0),
            focusTimeAfterReturnMs: Number(item.total_focus_time_after_return_ms ?? 0),
            averageTimeSpentDistractedMs: Number(item.average_time_spent_distracted_ms ?? 0),
            averageRemainingSprintTimeMs: Number(item.average_remaining_sprint_time_ms ?? 0),
          },
          source: item.source || 'supabase',
          tools: Array.isArray(item.tools) ? item.tools : [],
          rabbitHoleLog: Array.isArray(item.rabbit_hole_log) ? item.rabbit_hole_log : [],
        }))
      : [];

    if (normalized.length > 0) {
      writeLocalSprintSessions(normalized);
      return normalized;
    }

    return localRecords;
  } catch {
    return localRecords;
  }
};

export const saveSprintSession = async (session) => {
  const localRecords = readLocalSprintSessions();
  const filtered = localRecords.filter((item) => item.sprintId !== session.sprintId);
  const nextRecords = [...filtered, session];
  writeLocalSprintSessions(nextRecords);

  if (!hasSupabaseConfig) {
    return { success: false, source: 'local', reason: 'missing_config' };
  }

  try {
    const payload = {
      user_id: ANALYTICS_USER_ID,
      sprint_id: session.sprintId,
      sprint_number: session.sprintNumber ?? null,
      title: session.title,
      focus_task: session.focusTask ?? '',
      entry_date: session.date,
      started_at: session.startedAt,
      completed_at: session.completedAt,
      duration_minutes: session.durationMinutes,
      rabbit_holes: session.rabbitHoles ?? 0,
      focus_score: session.focusScore ?? 100,
      resilience_score: session.resilienceMetrics?.resilienceScore ?? 100,
      recovery_speed: session.resilienceMetrics?.recoverySpeed ?? 100,
      distraction_depth: session.resilienceMetrics?.distractionDepth ?? 100,
      productive_recovery: session.resilienceMetrics?.productiveRecovery ?? 100,
      total_time_spent_distracted_ms: session.totals?.timeSpentDistractedMs ?? 0,
      total_focus_time_after_return_ms: session.totals?.focusTimeAfterReturnMs ?? 0,
      average_time_spent_distracted_ms: session.totals?.averageTimeSpentDistractedMs ?? 0,
      average_remaining_sprint_time_ms: session.totals?.averageRemainingSprintTimeMs ?? 0,
      source: session.source || 'sprint',
      tools: session.tools ?? [],
      rabbit_hole_log: session.rabbitHoleLog ?? [],
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/sprint_sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const retryResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/sprint_sessions?on_conflict=user_id,sprint_id`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!retryResponse.ok) {
        const body = await retryResponse.text();
        return {
          success: false,
          source: 'local',
          reason: `supabase_save_failed:${retryResponse.status}`,
          details: body,
        };
      }
    }

    return { success: true, source: 'supabase' };
  } catch (error) {
    return {
      success: false,
      source: 'local',
      reason: 'network_or_runtime_error',
      details: error instanceof Error ? error.message : String(error),
    };
  }
};
