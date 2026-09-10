import React from 'react';

export default function FootballPassportCard({ player, onConnect, isConnected, isPending }) {
  if (!player) return null;

  const {
    name = 'Player',
    position = 'MF',
    experienceLevel = 'intermediate',
    preferredFoot = 'Right',
    skills = { pace: 75, passing: 75, shooting: 75, defending: 75, stamina: 75 },
    bio = '',
    location = 'Bangalore',
    stats = { matchesPlayed: 10, tournamentsWon: 1, motmCount: 2, gearBoughtSold: 3 }
  } = player;

  // Calculate Overall Rating (OVR)
  const ovr = Math.round(
    (skills.pace + skills.passing + skills.shooting + skills.defending + skills.stamina) / 5
  );

  return (
    <div className="passport-card">
      <div className="card-top" style={{ justifyContent: 'center', marginBottom: '0.75rem' }}>
        <div className="rating-badge" style={{ alignItems: 'center' }}>
          <span className="ovr-number">{ovr}</span>
          <span className="position-tag" style={{ fontSize: '1.1rem', marginTop: '2px' }}>{position}</span>
        </div>
      </div>

      <h3 className="player-name">{name}</h3>
      <p className="player-meta">
        📍 {location} • {experienceLevel.toUpperCase()} • {preferredFoot} Foot
      </p>

      {/* Radar Skill Stats Grid */}
      <div className="skills-grid">
        <div className="skill-stat">
          <span className="skill-name">⚡ PAC</span>
          <span className="skill-val">{skills.pace}</span>
        </div>
        <div className="skill-stat">
          <span className="skill-name">🎯 PAS</span>
          <span className="skill-val">{skills.passing}</span>
        </div>
        <div className="skill-stat">
          <span className="skill-name">⚽ SHO</span>
          <span className="skill-val">{skills.shooting}</span>
        </div>
        <div className="skill-stat">
          <span className="skill-name">🛡️ DEF</span>
          <span className="skill-val">{skills.defending}</span>
        </div>
        <div className="skill-stat" style={{ gridColumn: 'span 2' }}>
          <span className="skill-name">🫁 STAMINA</span>
          <span className="skill-val">{skills.stamina}</span>
        </div>
      </div>

      {/* Self-reported Profile Stats */}
      <div className="stat-pills">
        <div className="stat-pill">
          <div className="stat-num">{stats.matchesPlayed}</div>
          <div className="stat-lbl">Matches</div>
        </div>
        <div className="stat-pill">
          <div className="stat-num">{stats.tournamentsWon}</div>
          <div className="stat-lbl">Trophy</div>
        </div>
        <div className="stat-pill">
          <div className="stat-num">{stats.motmCount}</div>
          <div className="stat-lbl">MOTM</div>
        </div>
        <div className="stat-pill">
          <div className="stat-num">{stats.gearBoughtSold}</div>
          <div className="stat-lbl">Gear</div>
        </div>
      </div>

      {bio && (
        <p style={{ fontSize: '0.8rem', color: '#8c9bae', marginTop: '0.85rem', fontStyle: 'italic', textAlign: 'center' }}>
          "{bio}"
        </p>
      )}

      {onConnect && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          {isConnected ? (
            <button className="nav-btn" style={{ width: '100%', background: 'rgba(0,255,135,0.15)', color: '#00ff87', cursor: 'default' }}>
              ✓ Connected
            </button>
          ) : isPending ? (
            <button className="nav-btn" style={{ width: '100%', opacity: 0.6, cursor: 'default' }}>
              ⏳ Request Pending
            </button>
          ) : (
            <button
              className="auth-btn"
              style={{ width: '100%', fontSize: '0.85rem', padding: '0.55rem' }}
              onClick={() => onConnect(player._id)}
            >
              + Connect Player
            </button>
          )}
        </div>
      )}
    </div>
  );
}
