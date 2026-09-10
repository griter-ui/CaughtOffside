import React, { useState, useEffect } from 'react';
import FootballPassportCard from '../components/FootballPassportCard';
import MyBookingsPage from './MyBookingsPage';
import OwnerDashboardPage from './OwnerDashboardPage';

export default function ProfilePage({ socket, currentUser, onUpdateUser }) {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'bookings' | 'teammates' | 'turfs'
  const [profileSubTab, setProfileSubTab] = useState('card'); // 'card' | 'edit'

  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    position: currentUser?.position || 'MF',
    experienceLevel: currentUser?.experienceLevel || 'intermediate',
    preferredFoot: currentUser?.preferredFoot || 'Right',
    location: currentUser?.location || 'Indiranagar, Bangalore',
    availability: currentUser?.availability || 'Weekends',
    bio: currentUser?.bio || '',
    skills: currentUser?.skills || { pace: 75, passing: 78, shooting: 72, defending: 65, stamina: 80 },
    stats: currentUser?.stats || { matchesPlayed: 12, tournamentsWon: 2, motmCount: 3, gearBoughtSold: 4 }
  });

  const [connectionsData, setConnectionsData] = useState({
    acceptedFriends: [],
    pendingIncoming: [],
    pendingOutgoing: []
  });
  const [loadingConns, setLoadingConns] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name || '',
        position: currentUser.position || 'MF',
        experienceLevel: currentUser.experienceLevel || 'intermediate',
        preferredFoot: currentUser.preferredFoot || 'Right',
        location: currentUser.location || 'Indiranagar, Bangalore',
        availability: currentUser.availability || 'Weekends',
        bio: currentUser.bio || '',
        skills: currentUser.skills || { pace: 75, passing: 78, shooting: 72, defending: 65, stamina: 80 },
        stats: currentUser.stats || { matchesPlayed: 12, tournamentsWon: 2, motmCount: 3, gearBoughtSold: 4 }
      });
      fetchConnections();
    }
  }, [currentUser]);

  const fetchConnections = async () => {
    const token = sessionStorage.getItem('token');
    if (!token) return;

    setLoadingConns(true);
    try {
      const res = await fetch('/api/connections/my-connections', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setConnectionsData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingConns(false);
    }
  };

  const handleRespondConnection = async (connectionId, action) => {
    const token = sessionStorage.getItem('token');
    try {
      const res = await fetch('/api/connections/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ connectionId, action })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Connection ${action}ed!`);
        fetchConnections();
      }
    } catch (err) {
      alert('Error responding to request.');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('token');
    setSaving(true);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        alert('Player Profile updated successfully!');
        onUpdateUser(data.user);
        setProfileSubTab('card');
      } else {
        alert(data.message || 'Error updating profile.');
      }
    } catch (err) {
      alert('Error updating profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <h2> Sign In Required</h2>
        <p style={{ color: 'var(--text-muted)', margin: '1rem 0' }}>
          Please sign in to access your Player Profile & Personal Hub.
        </p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title"> My Profile & Personal Hub</h1>
        <p className="page-subtitle">
          Manage your player card, view turf slot receipts, manage hosted open games, connect with teammates, and list your turf grounds.
        </p>
      </div>

      {/* Main Hub Sub-Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button
          className={`date-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
           Player Profile & Stats
        </button>

        <button
          className={`date-tab ${activeTab === 'bookings' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
           My Bookings & Games
        </button>

        <button
          className={`date-tab ${activeTab === 'teammates' ? 'active' : ''}`}
          onClick={() => setActiveTab('teammates')}
        >
           My Teammates ({connectionsData.acceptedFriends.length})
          {connectionsData.pendingIncoming.length > 0 && (
            <span style={{ marginLeft: '6px', background: 'var(--fire-orange)', color: '#fff', padding: '0.15rem 0.45rem', borderRadius: '10px', fontSize: '0.75rem' }}>
              {connectionsData.pendingIncoming.length}
            </span>
          )}
        </button>

        <button
          className={`date-tab ${activeTab === 'turfs' ? 'active' : ''}`}
          onClick={() => setActiveTab('turfs')}
        >
           Manage My Turfs
        </button>
      </div>

      {/* TAB 1: Profile & Stats */}
      {activeTab === 'profile' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
            <button
              className={`date-tab ${profileSubTab === 'card' ? 'active' : ''}`}
              onClick={() => setProfileSubTab('card')}
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
               Profile Card Preview
            </button>
            <button
              className={`date-tab ${profileSubTab === 'edit' ? 'active' : ''}`}
              onClick={() => setProfileSubTab('edit')}
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
               Edit Details & Skill Attributes
            </button>
          </div>

          {profileSubTab === 'card' && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <FootballPassportCard player={currentUser} />
            </div>
          )}

          {profileSubTab === 'edit' && (
            <div style={{ maxWidth: '640px', margin: '0 auto', background: 'var(--bg-card)', padding: '2rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-color)' }}>
              <form onSubmit={handleSaveProfile}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#fff', marginBottom: '1.25rem' }}>
                  Player Details & Position Info
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Position</label>
                    <select
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                    >
                      <option value="FW">Forward (FW)</option>
                      <option value="MF">Midfielder (MF)</option>
                      <option value="DF">Defender (DF)</option>
                      <option value="GK">Goalkeeper (GK)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Experience Level</label>
                    <select
                      value={formData.experienceLevel}
                      onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="pro">Pro</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Preferred Foot</label>
                    <select
                      value={formData.preferredFoot}
                      onChange={(e) => setFormData({ ...formData, preferredFoot: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                    >
                      <option value="Right">Right</option>
                      <option value="Left">Left</option>
                      <option value="Ambidextrous">Ambidextrous</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Location Area</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                    />
                  </div>
                </div>

                <h4 style={{ fontSize: '1rem', color: 'var(--pitch-green)', marginBottom: '1rem' }}>
                   Self-Rated Skill Ratings (1-99)
                </h4>

                {['pace', 'passing', 'shooting', 'defending', 'stamina'].map(sk => (
                  <div key={sk} style={{ marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      <span style={{ textTransform: 'uppercase', fontWeight: '700' }}>{sk}</span>
                      <span style={{ color: '#fff', fontWeight: '600' }}>{formData.skills[sk]}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="99"
                      value={formData.skills[sk]}
                      onChange={(e) => setFormData({
                        ...formData,
                        skills: { ...formData.skills, [sk]: Number(e.target.value) }
                      })}
                      style={{ width: '100%', accentColor: 'var(--pitch-green)' }}
                    />
                  </div>
                ))}

                <h4 style={{ fontSize: '1rem', color: 'var(--electric-cyan)', margin: '1.25rem 0 1rem 0' }}>
                   Self-Reported Match Metrics
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Matches Played</label>
                    <input
                      type="number"
                      value={formData.stats.matchesPlayed}
                      onChange={(e) => setFormData({ ...formData, stats: { ...formData.stats, matchesPlayed: Number(e.target.value) } })}
                      style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>MOTM Count</label>
                    <input
                      type="number"
                      value={formData.stats.motmCount}
                      onChange={(e) => setFormData({ ...formData, stats: { ...formData.stats, motmCount: Number(e.target.value) } })}
                      style={{ width: '100%', padding: '0.65rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                    />
                  </div>
                </div>

                <button type="submit" disabled={saving} className="auth-btn" style={{ width: '100%', padding: '0.85rem' }}>
                  {saving ? 'Saving...' : 'Save Profile Updates'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Bookings & Games */}
      {activeTab === 'bookings' && (
        <MyBookingsPage socket={socket} currentUser={currentUser} embedMode={true} />
      )}

      {/* TAB 3: My Connections & Teammates */}
      {activeTab === 'teammates' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Pending Requests */}
          {connectionsData.pendingIncoming.length > 0 && (
            <div style={{ marginBottom: '2rem', background: 'rgba(255, 94, 54, 0.08)', border: '1px solid var(--fire-orange)', padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--fire-orange)', marginBottom: '1rem' }}>
                 Pending Incoming Requests ({connectionsData.pendingIncoming.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {connectionsData.pendingIncoming.map(item => (
                  <div key={item.connectionId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}></span>
                      <div>
                        <div style={{ fontWeight: '600', color: '#fff' }}>{item.user?.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Pos: {item.user?.position} • {item.user?.location}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="auth-btn"
                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                        onClick={() => handleRespondConnection(item.connectionId, 'accept')}
                      >
                        Accept
                      </button>
                      <button
                        className="nav-btn"
                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}
                        onClick={() => handleRespondConnection(item.connectionId, 'decline')}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accepted Connections Network */}
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#fff', marginBottom: '1rem' }}>
             Accepted Teammates Network ({connectionsData.acceptedFriends.length})
          </h3>

          {loadingConns ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Loading connections...</div>
          ) : connectionsData.acceptedFriends.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
              No accepted connections yet. Visit the Player Directory to connect with local footballers!
            </div>
          ) : (
            <div className="grid-layout">
              {connectionsData.acceptedFriends.map(f => (
                <div key={f._id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: 'rgba(194, 210, 173, 0.15)', color: 'var(--pitch-green)', width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '0.9rem' }}>
                    {f.position || 'MF'}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: '#fff', fontSize: '1.05rem' }}>{f.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--pitch-green)', fontWeight: '700' }}>
                      {f.position} • {f.experienceLevel?.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}> {f.location}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Turf Management Owner Portal */}
      {activeTab === 'turfs' && (
        <OwnerDashboardPage currentUser={currentUser} embedMode={true} />
      )}
    </div>
  );
}
