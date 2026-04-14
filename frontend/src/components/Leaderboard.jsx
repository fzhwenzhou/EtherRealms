import React, { useState, useEffect, useCallback } from 'react';

function Leaderboard({ contracts }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    if (!contracts) return;
    setLoading(true);
    try {
      const [ids, names, levels, xps, owners] = await contracts.gameManager.leaderboard();
      const data = ids.map((id, i) => ({
        id: Number(id),
        name: names[i],
        level: Number(levels[i]),
        xp: Number(xps[i]),
        owner: owners[i],
      })).filter(d => d.id > 0);
      setLeaders(data);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    }
    setLoading(false);
  }, [contracts]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const getRankClass = (i) => {
    if (i === 0) return 'rank-1';
    if (i === 1) return 'rank-2';
    if (i === 2) return 'rank-3';
    return '';
  };

  return (
    <div className="card">
      <h2>&#127942; Leaderboard</h2>
      {loading ? (
        <div className="loading"><span className="spinner" /> Loading...</div>
      ) : leaders.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No players yet.</p>
      ) : (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Level</th>
              <th>XP</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {leaders.map((p, i) => (
              <tr key={p.id} className={getRankClass(i)}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td>{p.level}</td>
                <td>{p.xp}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {typeof p.owner === 'string' && p.owner.length > 10 ? `${p.owner.slice(0, 6)}...${p.owner.slice(-4)}` : p.owner}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button className="btn btn-sm btn-primary" onClick={loadLeaderboard} style={{ marginTop: 12 }}>
        Refresh
      </button>
    </div>
  );
}

export default Leaderboard;
