import React, { useState, useEffect, useCallback } from 'react';

const EVENT_CLASSES = ['explore', 'combat-win', 'combat-lose', 'item-drop', 'level-up', 'guild'];
const EVENT_ICONS = ['🗺️', '⚔️', '💀', '✨', '⬆️', '🏰'];

function WorldEvents({ contracts, demoMode, demoEvents }) {
  const [events, setEvents] = useState([]);

  const loadEvents = useCallback(async () => {
    if (demoMode) {
      setEvents(demoEvents || []);
      return;
    }
    if (!contracts) return;
    try {
      const recentEvents = await contracts.gameManager.getRecentWorldEvents(20);
      const formatted = recentEvents.map((e, i) => ({
        id: i,
        player: e.player,
        characterId: Number(e.characterId),
        eventType: Number(e.eventType),
        message: e.message,
        timestamp: Number(e.timestamp),
      })).reverse();
      setEvents(formatted);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  }, [contracts, demoMode, demoEvents]);

  useEffect(() => {
    loadEvents();
    if (!demoMode) {
      const interval = setInterval(loadEvents, 10000);
      return () => clearInterval(interval);
    }
  }, [loadEvents, demoMode]);

  const formatTime = (ts) => {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString();
  };

  return (
    <div className="card">
      <h2>&#127760; World Events</h2>
      <div className="events-list">
        {events.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No events yet. Start adventuring!</p>
        )}
        {events.map((e) => (
          <div key={`${e.timestamp}-${e.id}`} className={`event-item ${EVENT_CLASSES[e.eventType] || ''}`}>
            <div>{EVENT_ICONS[e.eventType] || '📜'} {e.message}</div>
            <div className="event-time">
              {formatTime(e.timestamp)} · {typeof e.player === 'string' && e.player.length > 10 ? `${e.player.slice(0, 6)}...${e.player.slice(-4)}` : e.player}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WorldEvents;
