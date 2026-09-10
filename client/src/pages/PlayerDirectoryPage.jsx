import React, { useState, useEffect } from 'react';
import FootballPassportCard from '../components/FootballPassportCard';

export default function PlayerDirectoryPage({ currentUser }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myConnectionStatus, setMyConnectionStatus] = useState({});

  // Filter States
  const [positionFilter, setPositionFilter] = useState('All');
  const [expFilter, setExpFilter] = useState('All');
  const [footFilter, setFootFilter] = useState('All');
  const [sortBy, setSortBy] = useState('matches');
  const [search, setSearch] = useState('');
  const [minPace, setMinPace] = useState('');

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      let url = `/api/players?position=${positionFilter}&experienceLevel=${expFilter}&preferredFoot=${footFilter}&sortBy=${sortBy}&search=${encodeURIComponent(search)}`;
      if (minPace) url += `&minPace=${minPace}`;

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setPlayers(data.players || []);
      }
    } catch (err) {
      console.error('Error loading player directory:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyConnections = async () => {
    const token = sessionStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch('/api/connections/my-connections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        const statusMap = {};
        data.acceptedFriends?.forEach(f => { statusMap[f._id] = 'accepted'; });
        data.pendingOutgoing?.forEach(c => { statusMap[c.user?._id] = 'pending'; });
        setMyConnectionStatus(statusMap);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPlayers();
    if (currentUser) {
      fetchMyConnections();
    }
  }, [positionFilter, expFilter, footFilter, sortBy, search, minPace, currentUser]);

  const handleConnect = async (targetPlayerId) => {
    const token = sessionStorage.getItem('token');
    if (!token) return alert('Please login to send connection requests.');

    try {
      const res = await fetch('/api/connections/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ recipientId: targetPlayerId })
      });
      const data = await res.json();
      if (res.ok) {
        alert('🤝 Connection request sent!');
        setMyConnectionStatus(prev => ({ ...prev, [targetPlayerId]: 'pending' }));
      } else {
        alert(data.message || 'Error sending request.');
      }
    } catch (err) {
      alert('Error sending connection request.');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">🎴 Player Directory & Profile Cards</h1>
        <p className="page-subtitle">
          Discover local footballers, evaluate digital stat cards, and build your weekend squad network.
        </p>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', background: 'var(--bg-card)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        <input
          type="text"
          placeholder="Search player name, location, bio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 220px', padding: '0.75rem 1rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: '#fff' }}
        />

        <select
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
          style={{ flex: '0 0 140px', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: '#fff' }}
        >
          <option value="All">All Positions</option>
          <option value="FW">Forward (FW)</option>
          <option value="MF">Midfielder (MF)</option>
          <option value="DF">Defender (DF)</option>
          <option value="GK">Goalkeeper (GK)</option>
        </select>

        <select
          value={expFilter}
          onChange={(e) => setExpFilter(e.target.value)}
          style={{ flex: '0 0 150px', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: '#fff' }}
        >
          <option value="All">All Experience</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
          <option value="pro">Pro</option>
        </select>

        <select
          value={footFilter}
          onChange={(e) => setFootFilter(e.target.value)}
          style={{ flex: '0 0 130px', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: '#fff' }}
        >
          <option value="All">All Feet</option>
          <option value="Right">Right</option>
          <option value="Left">Left</option>
          <option value="Ambidextrous">Ambidextrous</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ flex: '0 0 160px', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: '#fff' }}
        >
          <option value="matches">Sort: Matches Played</option>
          <option value="motm">Sort: MOTM Counts</option>
          <option value="name">Sort: Player Name</option>
        </select>

        <input
          type="number"
          placeholder="Min Pace (PAC)"
          value={minPace}
          onChange={(e) => setMinPace(e.target.value)}
          style={{ flex: '0 0 130px', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: '#fff' }}
        />
      </div>

      {/* Players Directory Flex/Grid */}
      {(() => {
        const displayedPlayers = players.filter(p => {
          if (!currentUser) return true;
          return p._id !== currentUser._id;
        });

        if (loading) {
          return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Loading Player Profile Cards...
            </div>
          );
        }

        if (displayedPlayers.length === 0) {
          return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
              No other players match your skill filters.
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'center' }}>
            {displayedPlayers.map(p => {
              const status = myConnectionStatus[p._id];

              return (
                <div key={p._id}>
                  <FootballPassportCard
                    player={p}
                    isConnected={status === 'accepted'}
                    isPending={status === 'pending'}
                    onConnect={handleConnect}
                  />
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
