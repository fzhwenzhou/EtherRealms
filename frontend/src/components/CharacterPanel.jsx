import React from 'react';

const XP_TABLE = [0, 0, 100, 250, 500, 900, 1500, 2400, 3800, 5800, 8500];

function CharacterPanel({ character, energy, charId }) {
  if (!character) return null;

  const nextLevelXp = character.level < 10 ? XP_TABLE[character.level + 1] : XP_TABLE[10];
  const currentLevelXp = XP_TABLE[character.level] || 0;
  const xpProgress = nextLevelXp > currentLevelXp 
    ? ((character.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100 
    : 100;
  const hpPercent = (character.hp / character.maxHp) * 100;
  const energyPercent = (energy / 5) * 100;

  return (
    <div className="card">
      <h2>&#9876; {character.name}</h2>
      
      <div className="stat-row">
        <span className="label">Token ID</span>
        <span className="value">#{charId}</span>
      </div>

      <div className="stat-row">
        <span className="label">Level</span>
        <span className="value" style={{ color: 'var(--accent-purple)' }}>{character.level}</span>
      </div>

      <div className="stat-row">
        <span className="label">HP</span>
        <span className="value">{character.hp} / {character.maxHp}</span>
      </div>
      <div className="hp-bar">
        <div className="fill" style={{ width: `${hpPercent}%` }} />
      </div>

      <div className="stat-row" style={{ marginTop: 8 }}>
        <span className="label">XP</span>
        <span className="value">{character.xp} / {nextLevelXp}</span>
      </div>
      <div className="xp-bar">
        <div className="fill" style={{ width: `${Math.min(xpProgress, 100)}%` }} />
      </div>

      <div className="stat-row" style={{ marginTop: 8 }}>
        <span className="label">Energy</span>
        <span className="value">{energy} / 5</span>
      </div>
      <div className="energy-bar">
        <div className="fill" style={{ width: `${energyPercent}%` }} />
      </div>

      <div className="stat-row" style={{ marginTop: 8 }}>
        <span className="label">Strength</span>
        <span className="value" style={{ color: 'var(--accent-red)' }}>{character.strength}</span>
      </div>

      <div className="stat-row">
        <span className="label">Defense</span>
        <span className="value" style={{ color: 'var(--accent-blue)' }}>{character.defense}</span>
      </div>

      <div className="stat-row">
        <span className="label">Weapon</span>
        <span className="value">{character.equippedWeapon > 0 ? `#${character.equippedWeapon}` : 'None'}</span>
      </div>

      <div className="stat-row">
        <span className="label">Armor</span>
        <span className="value">{character.equippedArmor > 0 ? `#${character.equippedArmor}` : 'None'}</span>
      </div>

      {character.guildId > 0 && (
        <div className="stat-row">
          <span className="label">Guild</span>
          <span className="value" style={{ color: 'var(--accent-orange)' }}>#{character.guildId}</span>
        </div>
      )}
    </div>
  );
}

export default CharacterPanel;
