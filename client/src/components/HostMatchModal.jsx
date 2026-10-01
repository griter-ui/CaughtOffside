import React, { useEffect, useState } from 'react';
import './HostMatchModal.css';

const indiaToday = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);

export default function HostMatchModal({ socket, onClose, onHosted }) {
  const [venues, setVenues] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [mode, setMode] = useState('new');
  const [bookingId, setBookingId] = useState('');
  const [form, setForm] = useState({ venueId: '', date: indiaToday(), timeSlot: '', format: '5v5', totalSpots: 10, pricePerSpot: 0, notes: '' });
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  // Keep the key across network retries. Editing a draft starts a different request.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const headers = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });
  const change = patch => { setForm(previous => ({ ...previous, ...patch })); setRequestId(crypto.randomUUID()); setError(''); };

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/venues', { signal: controller.signal }),
      fetch('/api/bookings/my-bookings', { headers: headers(), signal: controller.signal })
    ]).then(async ([v, b]) => {
      if (!v.ok || !b.ok) throw new Error('Unable to load venues and reservations. Close and try again.');
      const venueData = await v.json();
      const bookingData = await b.json();
      if (controller.signal.aborted) return;
      setVenues(venueData.venues);
      // The server rechecks exact slot-start expiry when an existing booking is used.
      setBookings(bookingData.bookings.filter(item => !item.matchId && item.date >= indiaToday() && !['cancelled', 'pending'].includes(item.paymentStatus)));
      setForm(previous => ({ ...previous, venueId: venueData.venues[0]?._id || '' }));
    }).catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (mode !== 'new' || !form.venueId || !form.date) return;
    const controller = new AbortController();
    setSlotsLoading(true);
    setSlots([]);
    fetch(`/api/venues/${form.venueId}/slots?date=${form.date}`, { signal: controller.signal })
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.message); return data; })
      .then(data => {
        if (controller.signal.aborted) return;
        setSlots(data.slots);
        setForm(previous => ({ ...previous, timeSlot: data.slots.some(s => s.timeSlot === previous.timeSlot && s.status === 'available') ? previous.timeSlot : '' }));
      }).catch(err => { if (err.name !== 'AbortError') setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setSlotsLoading(false); });
    return () => controller.abort();
  }, [form.venueId, form.date, mode, refresh]);

  useEffect(() => {
    const update = event => { if (String(event.venueId?._id || event.venueId) === form.venueId && event.date === form.date) setRefresh(value => value + 1); };
    const reconnect = () => setRefresh(value => value + 1);
    socket?.on('slot_booked', update);
    socket?.on('slot_cancelled', update);
    socket?.on('connect', reconnect);
    return () => { socket?.off('slot_booked', update); socket?.off('slot_cancelled', update); socket?.off('connect', reconnect); };
  }, [socket, form.venueId, form.date]);

  const selectedBooking = bookings.find(b => b._id === bookingId);
  const selectedVenue = venues.find(v => v._id === form.venueId);
  const price = mode === 'existing' ? selectedBooking?.price : selectedVenue?.pricePerHour;

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const body = { ...form, hostingRequestId: requestId, ...(mode === 'existing' ? { bookingId } : {}) };
      const res = await fetch('/api/matches', { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { if (res.status === 409) setRefresh(value => value + 1); throw new Error(data.message || 'Unable to host match.'); }
      onHosted(data.match);
    } catch (err) { setError(err.message || 'Connection lost. Retry with the same details to check your reservation.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal-content host-match-modal" role="dialog" aria-modal="true" aria-labelledby="host-match-title" onClick={event => event.stopPropagation()}>
        <div className="host-match-heading">
          <div><h3 id="host-match-title">Reserve your turf & host</h3><p>Your game goes live with a confirmed slot.</p></div>
          <button type="button" className="nav-btn" aria-label="Close host form" disabled={saving} onClick={onClose}>✕</button>
        </div>
        {error && <p className="host-match-error" role="alert">{error}</p>}
        {loading ? <p role="status">Loading venues and your reservations…</p> : (
          <form onSubmit={submit}>
            <fieldset disabled={saving}>
              <label htmlFor="host-source">Turf reservation</label>
              <select id="host-source" value={mode} onChange={event => { setMode(event.target.value); setRequestId(crypto.randomUUID()); setError(''); }}>
                <option value="new">Reserve a new slot</option><option value="existing">Use my existing reservation</option>
              </select>
              {mode === 'existing' ? (
                <><label htmlFor="host-booking">Your unused reservations</label>
                  <select id="host-booking" value={bookingId} required onChange={event => { setBookingId(event.target.value); setRequestId(crypto.randomUUID()); }}>
                    <option value="">Select a reservation</option>
                    {bookings.map(b => <option key={b._id} value={b._id}>{b.venueId?.name} — {b.date}, {b.timeSlot}</option>)}
                  </select>
                  {!bookings.length && <p>No upcoming unused reservations. Choose “Reserve a new slot”.</p>}
                  <p>The match uses this reservation’s venue, date and time. No second booking is created.</p>
                </>
              ) : (
                <><label htmlFor="host-venue">Turf venue</label>
                  <select id="host-venue" value={form.venueId} required onChange={event => change({ venueId: event.target.value, timeSlot: '' })}>
                    {!venues.length && <option value="">No venues available</option>}
                    {venues.map(v => <option key={v._id} value={v._id}>{v.name} ({v.location})</option>)}
                  </select>
                  <label htmlFor="host-date">Date (India time)</label>
                  <input id="host-date" type="date" min={indiaToday()} value={form.date} required onChange={event => change({ date: event.target.value, timeSlot: '' })} />
                  <label htmlFor="host-slot">Available time slot</label>
                  <select id="host-slot" value={form.timeSlot} required disabled={slotsLoading} onChange={event => change({ timeSlot: event.target.value })}>
                    <option value="">{slotsLoading ? 'Loading availability…' : 'Select an available slot'}</option>
                    {slots.map(slot => <option key={slot.timeSlot} value={slot.timeSlot} disabled={slot.status !== 'available'}>{slot.timeSlot}{slot.status !== 'available' ? ` (${slot.status})` : ''}</option>)}
                  </select>
                  {!slotsLoading && form.venueId && !slots.some(slot => slot.status === 'available') && <p>No available slots for this date. Choose another date or venue.</p>}
                </>
              )}
              <div className="host-match-fields">
                <div><label htmlFor="host-format">Format</label><select id="host-format" value={form.format} onChange={event => change({ format: event.target.value, totalSpots: { '5v5': 10, '7v7': 14, '11-a-side': 22 }[event.target.value] })}>
                  <option>5v5</option><option>7v7</option><option>11-a-side</option>
                </select></div>
                <div><label htmlFor="host-spots">Spots including you</label><input id="host-spots" type="number" min="2" max="22" step="1" required value={form.totalSpots} onChange={event => change({ totalSpots: event.target.value })} /></div>
                <div><label htmlFor="host-price">Contribution / player (₹)</label><input id="host-price" type="number" min="0" max="100000" step="0.01" required value={form.pricePerSpot} onChange={event => change({ pricePerSpot: event.target.value })} /></div>
              </div>
              <label htmlFor="host-notes">Match notes</label><textarea id="host-notes" rows="3" maxLength="2000" value={form.notes} onChange={event => change({ notes: event.target.value })} placeholder="Bring bibs, arrive 10 minutes early…" />
              <div className="host-match-summary">
                <strong>Turf fee: {price === undefined ? 'Select a reservation or venue' : `₹${price}`}</strong>
                <p>Pay the venue directly. Player contributions are arranged with the host; no online payment is collected.</p>
              </div>
              <button className="auth-btn" type="submit" disabled={saving || (mode === 'new' ? slotsLoading || !form.timeSlot : !bookingId)}>
                {saving ? 'Reserving & hosting…' : mode === 'existing' ? 'Host with this reservation' : 'Reserve slot & host match'}
              </button>
            </fieldset>
          </form>
        )}
      </div>
    </div>
  );
}
