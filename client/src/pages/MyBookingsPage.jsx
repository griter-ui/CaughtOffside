import React, { useState, useEffect } from 'react';
import MatchNoticeBoard from '../components/MatchNoticeBoard';
import { isMatchExpired } from '../utils/dateUtils';

export default function MyBookingsPage({ socket, currentUser, embedMode = false }) {
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'hosted' | 'joined'
  const [bookings, setBookings] = useState([]);
  const [hostedMatches, setHostedMatches] = useState([]);
  const [joinedMatches, setJoinedMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected Match for notice board inside joined/hosted
  const [selectedNoticeMatch, setSelectedNoticeMatch] = useState(null);

  const fetchBookingsData = async () => {
    const token = sessionStorage.getItem('token');
    if (!token) return;

    setLoading(true);
    try {
      // Fetch turf slot bookings
      const bRes = await fetch('/api/bookings/my-bookings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const bData = await bRes.json();
      if (bRes.ok) setBookings(bData.bookings || []);

      // Fetch hosted and joined open games
      const mRes = await fetch('/api/matches/my-matches', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const mData = await mRes.json();
      if (mRes.ok) {
        setHostedMatches(mData.hostedMatches || []);
        setJoinedMatches(mData.joinedMatches || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchBookingsData();
    }
  }, [currentUser]);

  const handleRespondMatchRequest = async (matchId, playerId, action) => {
    const token = sessionStorage.getItem('token');
    try {
      const res = await fetch(`/api/matches/${matchId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ playerId, action })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Player request ${action}ed!`);
        fetchBookingsData();
      } else {
        alert(data.message || 'Error responding to request.');
      }
    } catch (err) {
      alert('Error responding to request.');
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this turf booking? Your slot will be freed and refund processed.')) return;

    const token = sessionStorage.getItem('token');
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert('🚫 Booking cancelled successfully. Refund processed and slot freed!');
        fetchBookingsData();
      } else {
        alert(data.message || 'Error cancelling booking.');
      }
    } catch (err) {
      alert('Error cancelling booking.');
    }
  };

  if (!currentUser) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <h2>🔒 Sign In Required</h2>
        <p style={{ color: 'var(--text-muted)', margin: '1rem 0' }}>
          Please sign in to view your booked turf slots and hosted matches.
        </p>
      </div>
    );
  }

  // Partition arrays into Upcoming vs Past
  const upcomingBookings = bookings.filter(b => !isMatchExpired(b.date, b.timeSlot));
  const pastBookings = bookings.filter(b => isMatchExpired(b.date, b.timeSlot));

  const upcomingHosted = hostedMatches.filter(m => !isMatchExpired(m.date, m.timeSlot));
  const pastHosted = hostedMatches.filter(m => isMatchExpired(m.date, m.timeSlot));

  const upcomingJoined = joinedMatches.filter(m => !isMatchExpired(m.date, m.timeSlot));
  const pastJoined = joinedMatches.filter(m => isMatchExpired(m.date, m.timeSlot));

  const renderBookingCard = (b, isPast = false) => (
    <div key={b._id} className="card" style={{ opacity: isPast ? 0.75 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{
          background: isPast ? 'rgba(255,255,255,0.1)' : 'rgba(0, 255, 135, 0.15)',
          color: isPast ? 'var(--text-muted)' : 'var(--pitch-green)',
          padding: '0.2rem 0.6rem',
          borderRadius: '4px',
          fontSize: '0.75rem',
          fontWeight: '800'
        }}>
          {isPast ? '⏳ PAST BOOKING' : '🟢 CONFIRMED RECEIPT'}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          #{b.receiptId}
        </span>
      </div>

      <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>{b.venueId?.name || 'Turf Venue'}</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.2rem 0 0.85rem 0' }}>
        📍 {b.venueId?.location}
      </p>

      <div style={{ background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
        <div>📅 <b>Date:</b> {b.date}</div>
        <div style={{ marginTop: '0.2rem' }}>⏰ <b>Slot:</b> {b.timeSlot}</div>
        <div style={{ marginTop: '0.2rem', color: isPast ? 'var(--text-muted)' : 'var(--pitch-green)', fontWeight: '700' }}>
          💰 Paid Amount: ₹{b.price}
        </div>
      </div>

      {!isPast && (
        <button
          className="nav-btn"
          style={{ width: '100%', color: 'var(--fire-orange)', border: '1px solid var(--fire-orange)', fontSize: '0.8rem', padding: '0.45rem', justifyContent: 'center' }}
          onClick={() => handleCancelBooking(b._id)}
        >
          🚫 Cancel Booking & Refund
        </button>
      )}
    </div>
  );

  const renderHostedMatchCard = (m, isPast = false) => (
    <div key={m._id} className="card" style={{ opacity: isPast ? 0.8 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff' }}>
              ⚽ {m.venueId?.name} ({m.format})
            </h3>
            <span style={{
              background: isPast ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 255, 135, 0.15)',
              color: isPast ? 'var(--text-muted)' : 'var(--pitch-green)',
              padding: '0.15rem 0.55rem',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: '800'
            }}>
              {isPast ? '⏳ PAST HOSTED GAME' : '🟢 ACTIVE MATCH'}
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            📅 {m.date} | ⏰ {m.timeSlot} | 💰 ₹{m.pricePerSpot}/spot
          </p>
        </div>

        <button
          className="nav-btn"
          style={{ border: '1px solid var(--border-color)', fontSize: '0.85rem' }}
          onClick={() => setSelectedNoticeMatch(selectedNoticeMatch?._id === m._id ? null : m)}
        >
          💬 Match Board ({m.acceptedPlayers?.length} Squad)
        </button>
      </div>

      {/* Pending Player Join Approvals (Only for upcoming matches) */}
      {!isPast && m.pendingRequests?.length > 0 && (
        <div style={{ background: 'rgba(255, 94, 54, 0.08)', border: '1px solid var(--fire-orange)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
          <h5 style={{ fontSize: '0.9rem', color: 'var(--fire-orange)', marginBottom: '0.75rem' }}>
            📩 Pending Player Requests to Join ({m.pendingRequests.length}):
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {m.pendingRequests.map(p => (
              <div key={p._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.85rem', color: '#fff' }}>
                  <b>{p.name}</b> ({p.position || 'MF'}) • {p.experienceLevel?.toUpperCase()} • 📍 {p.location}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="auth-btn"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                    onClick={() => handleRespondMatchRequest(m._id, p._id, 'accept')}
                  >
                    Accept Player
                  </button>
                  <button
                    className="nav-btn"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}
                    onClick={() => handleRespondMatchRequest(m._id, p._id, 'decline')}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted Squad Members */}
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <b>Squad ({m.acceptedPlayers?.length}/{m.totalSpots}):</b>{' '}
        {m.acceptedPlayers?.map(ap => ap.name).join(', ') || 'No accepted players yet'}
      </div>

      {selectedNoticeMatch?._id === m._id && (
        <div style={{ marginTop: '1.25rem' }}>
          <MatchNoticeBoard
            matchId={m._id}
            socket={socket}
            currentUser={currentUser}
            isAcceptedPlayer={true}
          />
        </div>
      )}
    </div>
  );

  const renderJoinedMatchCard = (m, isPast = false) => (
    <div key={m._id} className="card" style={{ opacity: isPast ? 0.8 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>
              ⚽ {m.venueId?.name} ({m.format})
            </h3>
            <span style={{
              background: isPast ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 255, 135, 0.15)',
              color: isPast ? 'var(--text-muted)' : 'var(--pitch-green)',
              padding: '0.15rem 0.55rem',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: '800'
            }}>
              {isPast ? '⏳ PAST MATCH PLAYED' : '🟢 UPCOMING MATCH'}
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Host: {m.hostId?.name} • 📅 {m.date} ({m.timeSlot})
          </p>
        </div>

        <button
          className="auth-btn"
          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          onClick={() => setSelectedNoticeMatch(selectedNoticeMatch?._id === m._id ? null : m)}
        >
          💬 Squad Discussion Board
        </button>
      </div>

      {selectedNoticeMatch?._id === m._id && (
        <div style={{ marginTop: '1rem' }}>
          <MatchNoticeBoard
            matchId={m._id}
            socket={socket}
            currentUser={currentUser}
            isAcceptedPlayer={true}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className={embedMode ? "embedded-container" : "page-container"}>
      {!embedMode && (
        <div className="page-header">
          <h1 className="page-title">🎟️ My Bookings & Hosted Games</h1>
          <p className="page-subtitle">
            Track confirmed turf receipts, approve incoming squad requests, and post on match notice boards.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
        <button
          className={`date-tab ${activeTab === 'bookings' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          🏟️ Turf Bookings ({bookings.length})
        </button>
        <button
          className={`date-tab ${activeTab === 'hosted' ? 'active' : ''}`}
          onClick={() => setActiveTab('hosted')}
        >
          👑 Games I Host ({hostedMatches.length})
        </button>
        <button
          className={`date-tab ${activeTab === 'joined' ? 'active' : ''}`}
          onClick={() => setActiveTab('joined')}
        >
          ⚽ Joined Squads ({joinedMatches.length})
        </button>
      </div>

      {/* TAB 1: Turf Slot Bookings */}
      {activeTab === 'bookings' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading bookings...</div>
          ) : bookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
              You haven't booked any turf slots yet. Browse venues to book your next match!
            </div>
          ) : (
            <div>
              {/* Upcoming Bookings */}
              <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--pitch-green)', marginBottom: '1rem' }}>
                🟢 Upcoming Turf Bookings ({upcomingBookings.length})
              </h4>
              {upcomingBookings.length === 0 ? (
                <div style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', marginBottom: '2.5rem', fontSize: '0.9rem' }}>
                  No upcoming turf bookings scheduled.
                </div>
              ) : (
                <div className="grid-layout" style={{ marginBottom: '2.5rem' }}>
                  {upcomingBookings.map(b => renderBookingCard(b, false))}
                </div>
              )}

              {/* Past Bookings */}
              {pastBookings.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    ⌛ Past Turf Bookings History ({pastBookings.length})
                  </h4>
                  <div className="grid-layout">
                    {pastBookings.map(b => renderBookingCard(b, true))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Games I Host */}
      {activeTab === 'hosted' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading hosted games...</div>
          ) : hostedMatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
              You are not hosting any open games right now. Click "Host a New Match" to recruit players!
            </div>
          ) : (
            <div>
              {/* Upcoming Hosted Games */}
              <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--pitch-green)', marginBottom: '1rem' }}>
                🟢 Active & Upcoming Hosted Games ({upcomingHosted.length})
              </h4>
              {upcomingHosted.length === 0 ? (
                <div style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', marginBottom: '2.5rem', fontSize: '0.9rem' }}>
                  No upcoming hosted games active.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
                  {upcomingHosted.map(m => renderHostedMatchCard(m, false))}
                </div>
              )}

              {/* Past Hosted Games */}
              {pastHosted.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    ⌛ Past Hosted Games History ({pastHosted.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {pastHosted.map(m => renderHostedMatchCard(m, true))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Joined Squads */}
      {activeTab === 'joined' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading joined matches...</div>
          ) : joinedMatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
              You haven't joined any hosted matches yet. Check out Open Games to find a slot!
            </div>
          ) : (
            <div>
              {/* Upcoming Joined Matches */}
              <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--pitch-green)', marginBottom: '1rem' }}>
                🟢 Upcoming Matches To Play ({upcomingJoined.length})
              </h4>
              {upcomingJoined.length === 0 ? (
                <div style={{ padding: '1.5rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', marginBottom: '2.5rem', fontSize: '0.9rem' }}>
                  No upcoming squad matches scheduled.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
                  {upcomingJoined.map(m => renderJoinedMatchCard(m, false))}
                </div>
              )}

              {/* Past Games Played */}
              {pastJoined.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    ⌛ Past Games Played History ({pastJoined.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {pastJoined.map(m => renderJoinedMatchCard(m, true))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
