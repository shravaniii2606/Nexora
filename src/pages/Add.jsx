import React, { useState } from 'react';

const Add = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resilienceScore, setResilienceScore] = useState(null);
  const [scoreDetails, setScoreDetails] = useState(null);
  const [escapeInfo, setEscapeInfo] = useState(null);
  const [showScoreSteps, setShowScoreSteps] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'score'
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);

  const parseStartMinutes = (timeRange = '') => {
    const raw = timeRange.split('-')[0]?.trim() || '';
    const match = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridian = match[3]?.toLowerCase();
    if (meridian === 'pm' && hours !== 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const computeResilience = (data) => {
    const normalized = data
      .map((entry) => {
        const type = String(entry.type || '').toLowerCase();
        const startMinutes = parseStartMinutes(entry.time || '');
        return { ...entry, type, startMinutes };
      })
      .filter((entry) => entry.startMinutes !== null)
      .sort((a, b) => a.startMinutes - b.startMinutes);

    const firstNonStudy = normalized.find((entry) => entry.type !== 'study');
    if (!firstNonStudy) return { score: null, details: 'No non-study activity found.' };

    const firstStudyAfter = normalized.find(
      (entry) => entry.type === 'study' && entry.startMinutes >= firstNonStudy.startMinutes
    );
    if (!firstStudyAfter) return { score: null, details: 'No study session after incident.' };

    const escapeMinutes = firstStudyAfter.startMinutes - firstNonStudy.startMinutes;
    let penalty = 0;
    let level = 'no penalty';
    if (escapeMinutes >= 10 && escapeMinutes < 20) {
      penalty = 10;
      level = 'mild';
    } else if (escapeMinutes >= 20 && escapeMinutes < 40) {
      penalty = 25;
      level = 'moderate';
    } else if (escapeMinutes >= 40) {
      penalty = 45;
      level = 'severe';
    }

    const score = Math.max(0, 100 - penalty);
    return {
      score,
      escapeMinutes,
      level,
      penalty,
      incidentStart: firstNonStudy.time,
      studyStart: firstStudyAfter.time,
      details: `Escape time ${escapeMinutes} min | ${level} penalty (${penalty})`
    };
  };

  const fetchEntriesForDate = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        'https://69dda753410caa3d47b9b943.mockapi.io/api/v1/entries'
      );
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const data = await response.json();
      const filtered = selectedDate
        ? data.filter((entry) => entry.date === selectedDate)
        : data;
      setEntries(filtered);
      return filtered;
    } catch (err) {
      setError(err?.message || 'Failed to load entries.');
      setEntries([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleFetchData = async () => {
    setView('list');
    setResilienceScore(null);
    setScoreDetails(null);
    setEscapeInfo(null);
    setShowScoreSteps(false);
    await fetchEntriesForDate();
  };

  const handleCalculate = async () => {
    setView('score');
    setResilienceScore(null);
    setScoreDetails(null);
    setEscapeInfo(null);
    const data = await fetchEntriesForDate();
    const {
      score,
      details,
      escapeMinutes,
      level,
      penalty,
      incidentStart,
      studyStart
    } = computeResilience(data);
    setResilienceScore(score);
    setScoreDetails(details);
    setEscapeInfo({ minutes: escapeMinutes, level, penalty, incidentStart, studyStart });
    setShowScoreSteps(false);
  };

  return (
    <div>
      <div className="page-header">
        <div className="breadcrumb">Pages / Add</div>
        <h1 className="page-title">Add Entry</h1>
      </div>
      <div
        className="panel"
        style={{
          padding: '24px',
          background:
            'linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '14px',
            alignItems: 'flex-end',
            marginBottom: '18px',
            flexWrap: 'wrap'
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              Select date
            </span>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(event) => setSelectedDate(event.target.value)}
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(18,18,20,0.6)',
                color: 'var(--text-primary)',
                fontSize: '15px',
                minWidth: '220px',
                height: '48px'
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleFetchData}
            disabled={loading}
            style={{
              padding: '0 20px',
              borderRadius: '12px',
              border: 'none',
              background:
                'linear-gradient(135deg, #ffb347 0%, #ff7a18 45%, #ff4d00 100%)',
              color: '#111',
              fontWeight: 700,
              letterSpacing: '0.3px',
              boxShadow: '0 10px 20px rgba(255, 122, 24, 0.35)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              height: '48px'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {loading ? 'Loading...' : 'Fetch Data'}
          </button>
        </div>

        {error && (
          <p style={{ color: 'var(--danger, #d9534f)', marginTop: '12px' }}>
            {error}
          </p>
        )}

        {view === 'score' && (
          <div style={{ marginTop: '20px' }}>
            <div
              style={{
                display: 'grid',
                gap: '12px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  cursor: 'pointer'
                }}
                onClick={() => setShowScoreSteps((prev) => !prev)}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Resilience Score
                </div>
                <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }}>
                  {resilienceScore !== null ? resilienceScore : '-'}
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {scoreDetails}
                </div>
              </div>
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)'
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Escape Time
                </div>
                <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '4px' }}>
                  {escapeInfo?.minutes !== undefined ? `${escapeInfo.minutes} min` : '-'}
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {escapeInfo ? escapeInfo.level : 'No data'}
                </div>
              </div>
            </div>
            {showScoreSteps && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.02)'
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  How the score was calculated
                </div>
                <div style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                  1. Incident start = first non-study start time: {escapeInfo?.incidentStart || '-'}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  2. Study start = first study time after incident: {escapeInfo?.studyStart || '-'}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  3. Escape time = {escapeInfo?.minutes !== undefined ? `${escapeInfo.minutes} min` : '-'}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  4. Penalty = {escapeInfo?.penalty ?? '-'}
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  5. Score = 100 - penalty = {resilienceScore !== null ? resilienceScore : '-'}
                </div>
              </div>
            )}
          </div>
        )}
        {view === 'list' && entries.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'grid', gap: '10px' }}>
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: '12px',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    background: 'var(--surface)'
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {entry.activityText ||
                      entry.activitytext ||
                      entry.activity ||
                      entry.title ||
                      'Untitled'}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {entry.date || 'No date'}
                    {entry.time ? ` | ${entry.time}` : ''}
                    {entry.type ? ` | ${entry.type}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
          <button
            type="button"
            onClick={handleCalculate}
            disabled={loading}
            style={{
              padding: '12px 24px',
              borderRadius: '999px',
              border: 'none',
              background:
                'linear-gradient(135deg, #ffb347 0%, #ff7a18 45%, #ff4d00 100%)',
              color: '#111',
              fontWeight: 700,
              letterSpacing: '0.4px',
              boxShadow: '0 12px 22px rgba(255, 122, 24, 0.35)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease'
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {loading ? 'Loading...' : 'Calculate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Add;

