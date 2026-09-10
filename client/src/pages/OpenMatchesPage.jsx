import React, { useState, useEffect } from 'react';
import FootballPassportCard from '../components/FootballPassportCard';
import MatchNoticeBoard from '../components/MatchNoticeBoard';
import { isMatchExpired } from '../utils/dateUtils';

export default function OpenMatchesPage({ socket, currentUser }) {
  const [matches, setMatches] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState('All');

  // Modal for Host a Match
  const [isHostModalOpen, setIsHostModalOpen] = useState(false);
  const [hostFormData, setHostFormData] = useState({
    venueId: '',
    date: new Date().toISOString().split('T')[0],
    timeSlot: '07:00 PM - 08:00 PM',
    format: '5v5',
    totalSpots: 10,
    pricePerSpot: 150,
    notes: ''
  });

  // Modal for Match Details & Notice Board
  const [selectedMatch, setSelectedMatch] = useState(null);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/matches?format=${selectedFormat}`);
      const data = await res.json();
      if (res.ok) {
        setMatches(data.matches || []);
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVenuesList = async () => {
    try {
      const res = await fetch('/api/venues');
      const data = await res.json();
      if (res.ok) {
        setVenues(data.venues || []);
        if (data.venues.length > 0) {
          setHostFormData(prev => ({ ...prev, venueId: data.venues[0]._id }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMatches();
    fetchVenuesList();
  }, [selectedFormat]);

  const handleHostMatchSubmit = async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('token');
    if (!token) return alert('Please login to host a match.');

    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(hostFormData)
      });
      const data = await res.json();
      if (res.ok) {
        alert('⚽ Match hosted successfully! Open spots are live.');
        setIsHostModalOpen(false);
        fetchMatches();
      } else {
        alert(data.message || 'Error hosting match.');
      }
    } catch (err) {
      alert('Error hosting match.');
    }
  };

  const handleRequestJoin = async (matchId) => {
    const token = sessionStorage.getItem('token');
    if (!token) return alert('Please login to join matches.');

    try {
      const res = await fetch(`/api/matches/${matchId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      alert(data.message);
      fetchMatches();
    } catch (err) {
      alert('Error requesting to join match.');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">⚡ Host a Match & Open Games</h1>
          <p className="page-subtitle">
            Need extra players for your turf game? Host a slot or join open games hosted by nearby footballers.
          </p>
        </div>

        <button
          className="auth-btn"
          style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
          onClick={() => {
            if (!currentUser) return alert('Please login to host a match.');
            setIsHostModalOpen(true);
          }}
        >
          + Host a New Match
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
        {['All', '5v5', '7v7', '11-a-side'].map(fmt => (
          <button
            key={fmt}
            className={`date-tab ${selectedFormat === fmt ? 'active' : ''}`}
            onClick={() => setSelectedFormat(fmt)}
          >
            {fmt}
          </button>
        ))}
      </div>

      {/* Matches Grid */}
      {(() => {
        const openMatchesToDisplay = matches.filter(m => {
          if (isMatchExpired(m.date, m.timeSlot)) return false;
          if (!currentUser) return true;
          const hostId = m.hostId?._id || m.hostId;
          return hostId !== currentUser._id;
        });

        if (loading) {
          return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Loading open matches...
            </div>
          );
        }

        if (openMatchesToDisplay.length === 0) {
          return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
              No open games available to join right now. {currentUser && matches.length > 0 ? '(Your hosted games are managed in My Profile & Hub under "My Bookings & Games"!)' : 'Be the first player to host a match!'}
            </div>
          );
        }

        return (
          <div className="grid-layout">
            {openMatchesToDisplay.map(m => {
            const isHost = currentUser && (m.hostId?._id === currentUser._id || m.hostId === currentUser._id);
            const isAccepted = currentUser && m.acceptedPlayers?.some(p => (p._id === currentUser._id || p === currentUser._id));
            const isPending = currentUser && m.pendingRequests?.some(p => (p._id === currentUser._id || p === currentUser._id));
            const registeredCount = m.acceptedPlayers?.length || 1;
            const isFull = registeredCount >= m.totalSpots;

            return (
              <div key={m._id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <span style={{ background: 'rgba(0, 255, 135, 0.15)', color: 'var(--pitch-green)', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '800' }}>
                    {m.format}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: !isFull ? 'var(--electric-cyan)' : 'var(--fire-orange)', fontWeight: '700' }}>
                    {!isFull ? `🟢 ${registeredCount}/${m.totalSpots} Registered` : `🔴 ${m.totalSpots}/${m.totalSpots} Match Full`}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>{m.venueId?.name || 'Turf Pitch'}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.75rem 0' }}>
                  📍 {m.venueId?.location || 'Bangalore'}
                </p>

                <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <div>📅 <b>Date:</b> {m.date}</div>
                  <div style={{ marginTop: '0.2rem' }}>⏰ <b>Time:</b> {m.timeSlot}</div>
                  <div style={{ marginTop: '0.2rem', color: 'var(--pitch-green)', fontWeight: '700' }}>
                    💰 ₹{m.pricePerSpot} / spot
                  </div>
                </div>

                {/* Host Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fff' }}>Host: {m.hostId?.name} ({m.hostId?.position || 'MF'})</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📍 {m.hostId?.location || 'Bangalore'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="nav-btn"
                    style={{ flex: 1, border: '1px solid var(--border-color)', fontSize: '0.8rem' }}
                    onClick={() => setSelectedMatch(m)}
                  >
                    View Details & Board
                  </button>

                  {!isHost && !isAccepted && (
                    <button
                      className="auth-btn"
                      style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem' }}
                      disabled={isPending || isFull}
                      onClick={() => handleRequestJoin(m._id)}
                    >
                      {isPending ? 'Request Sent' : isFull ? 'Match Full' : 'Request Join'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        );
      })()}

      {/* Host a Match Modal */}
      {isHostModalOpen && (
        <div className="modal-overlay" onClick={() => setIsHostModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff' }}>⚽ Host an Open Match</h3>
              <button onClick={() => setIsHostModalOpen(false)} style={{ background: 'none', color: 'var(--text-muted)', fontSize: '1.4rem' }}>✕</button>
            </div>

            <form onSubmit={handleHostMatchSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Select Turf Venue</label>
                <select
                  value={hostFormData.venueId}
                  onChange={(e) => setHostFormData({ ...hostFormData, venueId: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                  required
                >
                  {venues.map(v => (
                    <option key={v._id} value={v._id}>{v.name} ({v.location})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Date</label>
                  <input
                    type="date"
                    value={hostFormData.date}
                    onChange={(e) => setHostFormData({ ...hostFormData, date: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Time Slot</label>
                  <input
                    type="text"
                    value={hostFormData.timeSlot}
                    onChange={(e) => setHostFormData({ ...hostFormData, timeSlot: e.target.value })}
                    placeholder="07:00 PM - 08:00 PM"
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Format</label>
                  <select
                    value={hostFormData.format}
                    onChange={(e) => {
                      const fmt = e.target.value;
                      let defaultSpots = 10;
                      if (fmt === '7v7') defaultSpots = 14;
                      if (fmt === '11-a-side') defaultSpots = 22;
                      setHostFormData({ ...hostFormData, format: fmt, totalSpots: defaultSpots });
                    }}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                  >
                    <option value="5v5">5v5</option>
                    <option value="7v7">7v7</option>
                    <option value="11-a-side">11-a-side</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Total Spots</label>
                  <input
                    type="number"
                    value={hostFormData.totalSpots}
                    onChange={(e) => setHostFormData({ ...hostFormData, totalSpots: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Price / Spot ₹</label>
                  <input
                    type="number"
                    value={hostFormData.pricePerSpot}
                    onChange={(e) => setHostFormData({ ...hostFormData, pricePerSpot: e.target.value })}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Match Notes</label>
                <textarea
                  value={hostFormData.notes}
                  onChange={(e) => setHostFormData({ ...hostFormData, notes: e.target.value })}
                  placeholder="e.g. Competitive game, bring bibs if available..."
                  rows={3}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                />
              </div>

              <button type="submit" className="auth-btn" style={{ width: '100%', padding: '0.85rem' }}>
                Publish Hosted Match
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Match Details & Notice Board Modal */}
      {selectedMatch && (
        <div className="modal-overlay" onClick={() => setSelectedMatch(null)}>
          <div className="modal-content" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#fff' }}>
                ⚽ {selectedMatch.venueId?.name} ({selectedMatch.format})
              </h3>
              <button onClick={() => setSelectedMatch(null)} style={{ background: 'none', color: 'var(--text-muted)', fontSize: '1.4rem' }}>✕</button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              📅 {selectedMatch.date} • ⏰ {selectedMatch.timeSlot} • 💰 ₹{selectedMatch.pricePerSpot}/spot
            </p>

            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
              <h5 style={{ fontSize: '0.9rem', color: 'var(--pitch-green)', marginBottom: '0.5rem' }}>Accepted Squad Players ({selectedMatch.acceptedPlayers?.length}/{selectedMatch.totalSpots}):</h5>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {selectedMatch.acceptedPlayers?.map(p => (
                  <span key={p._id} style={{ background: 'rgba(0, 255, 135, 0.15)', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>
                    ⚽ {p.name} ({p.position || 'MF'})
                  </span>
                ))}
              </div>
            </div>

            {/* Option B: Match Notice Board Component */}
            <MatchNoticeBoard
              matchId={selectedMatch._id}
              socket={socket}
              currentUser={currentUser}
              isAcceptedPlayer={currentUser && selectedMatch.acceptedPlayers?.some(p => p._id === currentUser._id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
