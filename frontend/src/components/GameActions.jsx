import React from 'react';
import { ethers } from 'ethers';

const MONSTERS = [
  { name: 'Slime', hp: 30, atk: 5, def: 2, xp: 20, gold: 10, emoji: '🟢' },
  { name: 'Goblin', hp: 60, atk: 12, def: 5, xp: 50, gold: 25, emoji: '👺' },
  { name: 'Dark Knight', hp: 120, atk: 25, def: 15, xp: 120, gold: 60, emoji: '⚔️' },
];

function GameActions({ contracts, charId, energy, loading, onAction, showNotification, demoMode }) {
  const handleExplore = () => {
    if (demoMode) { onAction(() => {}); return; }
    onAction(async () => {
      const tx = await contracts.gameManager.explore(charId);
      showNotification('Exploring the wilderness...');
      await tx.wait();
      showNotification('Exploration complete! Check your rewards.');
    });
  };

  const handleFight = (monsterType) => {
    if (demoMode) { onAction(() => {}); return; }
    onAction(async () => {
      const tx = await contracts.gameManager.fightMonster(charId, monsterType);
      showNotification(`Fighting ${MONSTERS[monsterType].name}...`);
      const receipt = await tx.wait();

      const combatEvent = receipt.logs.find(log => {
        try {
          const parsed = contracts.gameManager.interface.parseLog(log);
          return parsed && parsed.name === 'CombatEvent';
        } catch { return false; }
      });

      if (combatEvent) {
        const parsed = contracts.gameManager.interface.parseLog(combatEvent);
        if (parsed.args.victory) {
          showNotification(`Victory! Gained ${parsed.args.xpGained} XP and ${ethers.formatEther(parsed.args.goldGained)} Gold!`);
        } else {
          showNotification('Defeated! Your hero barely survived.', 'error');
        }
      }
    });
  };

  const handleRest = () => {
    if (demoMode) { onAction(() => {}); return; }
    onAction(async () => {
      const tx = await contracts.gameManager.rest(charId);
      showNotification('Resting at the inn...');
      await tx.wait();
      showNotification('Fully healed!');
    });
  };

  return (
    <div>
      <div className="card">
        <h2>&#127757; Explore</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Venture into the wilderness to gain XP, gold, and possibly find items.
          Costs 1 energy point.
        </p>
        <button
          className="btn btn-success"
          onClick={handleExplore}
          disabled={loading || energy <= 0}
          style={{ width: '100%' }}
        >
          {loading ? <><span className="spinner" /> Processing...</> : `Explore (Energy: ${energy}/5)`}
        </button>
      </div>

      <div className="card">
        <h2>&#9876; Combat</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Choose a monster to fight. Stronger monsters give better rewards but are more dangerous!
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MONSTERS.map((m, i) => (
            <div
              key={i}
              className="monster-card"
              onClick={() => !loading && energy > 0 && handleFight(i)}
              style={{ opacity: loading || energy <= 0 ? 0.5 : 1 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="name">{m.emoji} {m.name}</div>
                  <div className="stats">
                    HP: {m.hp} | ATK: {m.atk} | DEF: {m.def}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12 }}>
                  <div style={{ color: 'var(--accent-purple)' }}>+{m.xp} XP</div>
                  <div style={{ color: 'var(--gold)' }}>+{m.gold} Gold</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>&#128716; Rest</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Rest at the inn to fully restore HP. Costs 10 ERGOLD.
        </p>
        <button
          className="btn btn-warning"
          onClick={handleRest}
          disabled={loading}
          style={{ width: '100%' }}
        >
          Rest (10 Gold)
        </button>
      </div>
    </div>
  );
}

export default GameActions;
