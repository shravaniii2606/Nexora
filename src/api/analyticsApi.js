const STORAGE_KEY = 'dailyAnalyticsHistory';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ANALYTICS_USER_ID =
  import.meta.env.VITE_ANALYTICS_USER_ID || 'mockapi-default-user';

const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const sortByDate = (items) =>
  [...items].sort((a, b) => new Date(a.entry_date || a.date) - new Date(b.entry_date || b.date));

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

export const getDailyAnalyticsHistory = async () => {
  const localRecords = readLocalAnalytics();

  if (!hasSupabaseConfig) {
    return localRecords;
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
      return normalized;
    }

    return localRecords;
  } catch {
    return localRecords;
  }
};

export const saveDailyAnalyticsRecord = async (record) => {
  const localRecords = readLocalAnalytics();
  const filtered = localRecords.filter((item) => item.date !== record.date);
  const nextRecords = [...filtered, record];
  writeLocalAnalytics(nextRecords);

  if (!hasSupabaseConfig) {
    return { success: true, source: 'local' };
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
        throw new Error(`Supabase save failed: ${retryResponse.status}`);
      }
    }

    return { success: true, source: 'supabase' };
  } catch {
    return { success: true, source: 'local' };
  }
};
