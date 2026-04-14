const FALLBACK_DASHBOARD_SUMMARY = `Dashboard snapshot:
- No saved user analytics are available yet.
- Ask the user to calculate a day from the Add page first, then summarize the real dashboard data.`;

const sortByDate = (items) =>
  [...items].sort((a, b) => new Date(a.date || a.entry_date) - new Date(b.date || b.entry_date));

export const buildDashboardSummary = (history = []) => {
  if (!Array.isArray(history) || history.length === 0) {
    return FALLBACK_DASHBOARD_SUMMARY;
  }

  const sorted = sortByDate(history).map((item) => ({
    date: item.date || item.entry_date,
    resilienceScore: Number(item.resilienceScore ?? item.resilience_score ?? 0),
    rabbitHole: Number(item.rabbitHole ?? item.rabbit_hole ?? 0),
    streaks: Number(item.streaks ?? 0),
    averageEscapeTime: Number(item.averageEscapeTime ?? item.average_escape_time ?? 0),
  }));

  const latest = sorted[sorted.length - 1];
  const lastSeven = sorted.slice(-7);

  const average = (values) =>
    values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0;

  const avgResilience = average(lastSeven.map((item) => item.resilienceScore));
  const avgRabbitHole = average(lastSeven.map((item) => item.rabbitHole));
  const avgEscapeTime = average(lastSeven.map((item) => item.averageEscapeTime));
  const bestDay =
    [...sorted].sort((a, b) => b.resilienceScore - a.resilienceScore)[0] ?? latest;
  const worstDay =
    [...sorted].sort((a, b) => a.resilienceScore - b.resilienceScore)[0] ?? latest;
  const resilienceChange =
    sorted.length > 1 ? latest.resilienceScore - sorted[0].resilienceScore : 0;

  return `Dashboard snapshot:
- Latest date: ${latest.date}
- Current resilience score: ${latest.resilienceScore}
- Current rabbit holes: ${latest.rabbitHole}
- Current streaks: ${latest.streaks}
- Current average escape time: ${latest.averageEscapeTime} minutes
- Last 7 entries average resilience: ${avgResilience}
- Last 7 entries average rabbit holes: ${avgRabbitHole}
- Last 7 entries average escape time: ${avgEscapeTime} minutes
- Overall resilience change across saved history: ${resilienceChange > 0 ? '+' : ''}${resilienceChange}
- Best day: ${bestDay.date} with resilience ${bestDay.resilienceScore}
- Toughest day: ${worstDay.date} with resilience ${worstDay.resilienceScore}`;
};
