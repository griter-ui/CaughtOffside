// Owner workspace: display this account's grounds, create listings and inspect/cancel
// their reservations. Backend ownership checks remain authoritative for each write.
import React, { useState, useEffect } from 'react';
import VenueFormatPicker from '../components/VenueFormatPicker';
import { getVenueFormats } from '../utils/venueFormats';

export default function OwnerDashboardPage({ currentUser, embedMode = false }) {
  const [myVenues, setMyVenues] = useState([]);
  const [bookingsLog, setBookingsLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingFormats, setEditingFormats] = useState(null);
  const [savingFormats, setSavingFormats] = useState(false);
  const [formatError, setFormatError] = useState('');

  // New venue listing state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newVenue, setNewVenue] = useState({
    name: '',
    location: '',
    area: '',
    pricePerHour: 1500,
    formats: ['5v5'],
    description: '',
    photos: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800'
  });

  // Two data sources: public venues filtered locally, then protected owner booking log.
  const fetchOwnerData = async () => {
    const token = sessionStorage.getItem('token');
    if (!token) return;

    setLoading(true);
    try {
      // Fetch all venues and filter by logged-in user ID
      const vRes = await fetch('/api/venues');
      const vData = await vRes.json();
      if (vRes.ok) {
        const filtered = (vData.venues || []).filter(
          v => v.ownerId === currentUser._id || v.ownerId?._id === currentUser._id
        );
        setMyVenues(filtered);
      }

      // Fetch owner bookings log
      const bRes = await fetch('/api/bookings/owner', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const bData = await bRes.json();
      if (bRes.ok) {
        setBookingsLog(bData.bookings || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchOwnerData();
    }
  }, [currentUser]);

  // UI confirmation precedes DELETE; the API verifies ownership of the booking's venue.
  const handleOwnerRemoveBooking = async (bookingId, playerName) => {
    if (!window.confirm(`Cancel ${playerName || 'this player'}'s booking? Any linked hosted match will also be cancelled and the slot will be freed.`)) return;

    const token = sessionStorage.getItem('token');
    try {
      const res = await fetch(`/api/bookings/owner/${bookingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(' Booking removed by owner. Time slot freed successfully!');
        fetchOwnerData();
      } else {
        alert(data.message || 'Error removing booking.');
      }
    } catch (err) {
      alert('Error removing booking.');
    }
  };

  // Convert the one-photo draft string to the schema's array shape; the backend
  // supplies ownerId, validates price/required fields and emits venue_created.
  const handleCreateVenue = async (e) => {
    e.preventDefault();
    const token = sessionStorage.getItem('token');

    try {
      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newVenue,
          photos: [newVenue.photos]
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(' Turf Venue listing published! It is now instantly available for everyone to book.');
        setIsAddModalOpen(false);
        setNewVenue({
          name: '',
          location: '',
          area: '',
          pricePerHour: 1500,
          formats: ['5v5'],
          description: '',
          photos: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800'
        });
        fetchOwnerData();
      } else {
        alert(data.message || 'Error creating venue listing.');
      }
    } catch (err) {
      alert('Error creating venue listing.');
    }
  };

  const saveFormats = async () => {
    if (savingFormats) return;
    setSavingFormats(true);
    setFormatError('');
    try {
      const res = await fetch(`/api/venues/${editingFormats._id}/formats`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('token')}` },
        body: JSON.stringify({ formats: editingFormats.formats })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMyVenues(previous => previous.map(venue => venue._id === data.venue._id ? data.venue : venue));
      setEditingFormats(null);
    } catch (error) { setFormatError(error.message || 'Unable to save formats. Try again.'); }
    finally { setSavingFormats(false); }
  };

  if (!currentUser) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <h2> Manage My Turf Venues</h2>
        <p style={{ color: 'var(--text-muted)', margin: '1rem 0' }}>
          Please sign in to list and manage your artificial turf grounds.
        </p>
      </div>
    );
  }

  if (currentUser.role !== 'owner') return <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>Create a venue owner account to list and manage your grounds.</p>;

  // Sum reservation values, not collected revenue: this app does not process payment.
  const totalRevenue = bookingsLog.reduce((sum, b) => sum + (b.price || 0), 0);

  return (
    <div className={embedMode ? "embedded-container" : "page-container"}>
      {!embedMode ? (
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title"> Turf Management Portal</h1>
            <p className="page-subtitle">
              List your own artificial turf ground, manage slot pricing, and track incoming player bookings.
            </p>
          </div>

          <button
            className="auth-btn"
            onClick={() => setIsAddModalOpen(true)}
          >
            + Add New Turf Venue
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff' }}> Turf Listings & Owner Portal</h3>
          <button
            className="auth-btn"
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
            onClick={() => setIsAddModalOpen(true)}
          >
            + Add New Turf Venue
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--pitch-green)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>My Turf Listings</div>
          <div style={{ fontSize: '2rem', fontWeight: '600', color: '#fff', marginTop: '0.25rem' }}>{myVenues.length}</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--electric-cyan)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Player Bookings Received</div>
          <div style={{ fontSize: '2rem', fontWeight: '600', color: '#fff', marginTop: '0.25rem' }}>{bookingsLog.length}</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--gold-accent)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Reservation value</div>
          <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--pitch-green)', marginTop: '0.25rem' }}>₹{totalRevenue}</div>
        </div>
      </div>

      {/* Venues Management Section */}
      <h3 style={{ fontSize: '1.3rem', fontWeight: '600', color: '#fff', marginBottom: '1rem' }}>
         Your Active Turf Listings
      </h3>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading venues...</div>
      ) : myVenues.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)' }}>
          You haven't listed any turf grounds yet. Click "+ Add New Turf Venue" above to list your turf!
        </div>
      ) : (
        <div className="grid-layout" style={{ marginBottom: '3rem' }}>
          {myVenues.map(v => (
            <div key={v._id} className="card">
              <div style={{ height: '140px', margin: '-1.5rem -1.5rem 1rem -1.5rem', overflow: 'hidden' }}>
                <img
                  src={v.photos?.[0] || 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800'}
                  alt={v.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#fff' }}>{v.name}</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.85rem 0' }}> {v.location}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--pitch-green)', fontWeight: '700' }}>
                <span>Formats: {getVenueFormats(v).join(', ') || 'Not configured'}</span>
                <span>₹{v.pricePerHour}/hr</span>
              </div>
              <button type="button" className="nav-btn" style={{ marginTop: '1rem', border: '1px solid var(--border-color)' }} onClick={() => { setEditingFormats({ _id: v._id, name: v.name, formats: getVenueFormats(v) }); setFormatError(''); }}>
                Edit formats
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Reservation log uses populated venue/player fields; it is not a payment ledger. */}
      <h3 style={{ fontSize: '1.3rem', fontWeight: '600', color: '#fff', marginBottom: '1rem' }}>
         Recent Booking Transactions Log
      </h3>

      {bookingsLog.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)' }}>
          No player bookings logged yet for your turf grounds.
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '1rem' }}>Receipt ID</th>
                <th style={{ padding: '1rem' }}>Venue</th>
                <th style={{ padding: '1rem' }}>Booked By</th>
                <th style={{ padding: '1rem' }}>Date & Slot</th>
                <th style={{ padding: '1rem' }}>Amount</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem' }}>Manage Action</th>
              </tr>
            </thead>
            <tbody>
              {bookingsLog.map(b => (
                <tr key={b._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem', fontWeight: '700', color: 'var(--pitch-green)' }}>#{b.receiptId}</td>
                  <td style={{ padding: '1rem', color: '#fff' }}>{b.venueId?.name || 'Turf'}{b.format && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{b.format}</div>}</td>
                  <td style={{ padding: '1rem', color: '#fff' }}>{b.userId?.name || 'Player'} ({b.userId?.position || 'MF'})</td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{b.date} ({b.timeSlot})</td>
                  <td style={{ padding: '1rem', fontWeight: '700', color: '#fff' }}>₹{b.price}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ background: 'rgba(194, 210, 173, 0.15)', color: 'var(--pitch-green)', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700' }}>
                      PAY AT VENUE
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      className="nav-btn"
                      style={{ color: 'var(--fire-orange)', border: '1px solid var(--fire-orange)', padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                      onClick={() => handleOwnerRemoveBooking(b._id, b.userId?.name)}
                    >
                       Remove Booking
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingFormats && (
        <div className="modal-overlay" onClick={() => !savingFormats && setEditingFormats(null)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="edit-formats-title" onClick={event => event.stopPropagation()}>
            <h3 id="edit-formats-title" style={{ marginBottom: '1rem' }}>Formats for {editingFormats.name}</h3>
            <VenueFormatPicker value={editingFormats.formats} disabled={savingFormats} onChange={formats => setEditingFormats({ ...editingFormats, formats })} />
            <p style={{ color: 'var(--text-muted)', margin: '1rem 0' }}>Existing bookings keep their selected format. New bookings and hosted matches use the formats selected here.</p>
            {formatError && <p role="alert" style={{ color: 'var(--fire-orange)', marginBottom: '1rem' }}>{formatError}</p>}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" className="nav-btn" disabled={savingFormats} onClick={() => setEditingFormats(null)}>Cancel</button>
              <button type="button" className="auth-btn" disabled={savingFormats || !editingFormats.formats.length} onClick={saveFormats}>{savingFormats ? 'Saving...' : 'Save formats'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Add Venue Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '600', color: '#fff' }}> Add New Turf Venue</h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', color: 'var(--text-muted)', fontSize: '1.4rem' }}>✕</button>
            </div>

            <form onSubmit={handleCreateVenue}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Venue Name</label>
                <input
                  type="text"
                  required
                  value={newVenue.name}
                  onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
                  placeholder="e.g. Champions Arena Turf"
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Full Address Location</label>
                  <input
                    type="text"
                    required
                    value={newVenue.location}
                    onChange={(e) => setNewVenue({ ...newVenue, location: e.target.value })}
                    placeholder="100 Feet Road, Indiranagar"
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Area / Neighborhood</label>
                  <input
                    type="text"
                    required
                    value={newVenue.area}
                    onChange={(e) => setNewVenue({ ...newVenue, area: e.target.value })}
                    placeholder="Indiranagar"
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Price Per Hour (₹)</label>
                  <input
                    type="number"
                    required
                    value={newVenue.pricePerHour}
                    onChange={(e) => setNewVenue({ ...newVenue, pricePerHour: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                  />
                </div>

                <div>
                  <VenueFormatPicker value={newVenue.formats} onChange={formats => setNewVenue({ ...newVenue, formats })} />
                </div>
              </div>

              <button type="submit" disabled={!newVenue.formats.length} className="auth-btn" style={{ width: '100%', padding: '0.85rem' }}>
                Publish Venue Listing
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
