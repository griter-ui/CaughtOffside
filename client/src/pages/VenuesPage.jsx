import React, { useState, useEffect } from 'react';
import SlotGrid from '../components/SlotGrid';

export default function VenuesPage({ socket, currentUser }) {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Selected venue for booking modal
  const [activeVenue, setActiveVenue] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Payment & Receipt States
  const [paymentStep, setPaymentStep] = useState('slot'); // 'slot' | 'payment' | 'receipt'
  const [bookingReceipt, setBookingReceipt] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  const fetchVenues = async () => {
    setLoading(true);
    try {
      let url = `/api/venues?sportType=${selectedSport}&search=${encodeURIComponent(searchQuery)}`;
      if (maxPrice) url += `&maxPrice=${maxPrice}`;

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setVenues(data.venues || []);
      }
    } catch (err) {
      console.error('Error loading venues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVenues();
  }, [selectedSport, searchQuery, maxPrice]);

  useEffect(() => {
    if (!socket) return;

    socket.on('venue_created', (newVenue) => {
      setVenues(prev => [newVenue, ...prev]);
    });

    return () => {
      socket.off('venue_created');
    };
  }, [socket]);

  // Filter out venues owned by the current user so they don't book their own turf!
  const availableVenuesToBook = venues.filter(v => {
    if (!currentUser) return true;
    const ownerIdStr = typeof v.ownerId === 'object' ? v.ownerId?._id : v.ownerId;
    return ownerIdStr !== currentUser._id;
  });

  const handleOpenBookingModal = (venue) => {
    setActiveVenue(venue);
    setSelectedSlot(null);
    setPaymentStep('slot');
    setBookingReceipt(null);
  };

  const handleConfirmPay = async () => {
    if (!currentUser) return alert('Please login to book a venue.');
    if (!selectedSlot) return alert('Please select a date and time slot first.');

    const token = sessionStorage.getItem('token');
    setProcessingPayment(true);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          venueId: activeVenue._id,
          date: selectedSlot.date,
          timeSlot: selectedSlot.timeSlot,
          price: activeVenue.pricePerHour
        })
      });

      const data = await res.json();

      if (res.ok) {
        setBookingReceipt(data.booking);
        setPaymentStep('receipt');
      } else {
        alert(data.message || 'Booking conflict or payment failed.');
      }
    } catch (err) {
      alert('Payment processing error.');
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">🏟️ Browse Turf Venues</h1>
        <p className="page-subtitle">
          Find & book artificial turf pitches across the city with real-time conflict-safe slot locking.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', background: 'var(--bg-card)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        <input
          type="text"
          placeholder="Search by venue name, location, area..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: '1 1 240px', padding: '0.75rem 1rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: '#fff' }}
        />

        <select
          value={selectedSport}
          onChange={(e) => setSelectedSport(e.target.value)}
          style={{ flex: '0 0 160px', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: '#fff' }}
        >
          <option value="All">All Formats</option>
          <option value="5-a-side">5-a-side</option>
          <option value="7-a-side">7-a-side</option>
          <option value="11-a-side">11-a-side</option>
          <option value="Box Cricket & Football">Box Cricket & Football</option>
        </select>

        <input
          type="number"
          placeholder="Max Price ₹/hr"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          style={{ flex: '0 0 140px', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: '#fff' }}
        />
      </div>

      {/* Venue Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading turf venues...
        </div>
      ) : availableVenuesToBook.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
          No open venues available for booking. (Your owned turfs are managed under "Manage My Turfs" inside My Profile & Hub!)
        </div>
      ) : (
        <div className="grid-layout">
          {availableVenuesToBook.map(v => (
            <div key={v._id} className="card">
              <div style={{ height: '180px', margin: '-1.5rem -1.5rem 1rem -1.5rem', overflow: 'hidden', position: 'relative' }}>
                <img
                  src={v.photos?.[0] || 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800'}
                  alt={v.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <span style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(9, 13, 22, 0.85)', padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '800', color: 'var(--pitch-green)', backdropFilter: 'blur(8px)' }}>
                  ★ {v.rating}
                </span>
                <span style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0, 255, 135, 0.9)', color: '#000', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800' }}>
                  {v.sportType}
                </span>
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff' }}>{v.name}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0.85rem 0' }}>
                📍 {v.location}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
                {v.amenities?.map((am, i) => (
                  <span key={i} style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    ✓ {am}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <div>
                  <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--pitch-green)' }}>₹{v.pricePerHour}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}> / hour</span>
                </div>
                <button
                  className="auth-btn"
                  style={{ fontSize: '0.85rem', padding: '0.55rem 1.1rem' }}
                  onClick={() => handleOpenBookingModal(v)}
                >
                  Book Slot
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking & Payment Modal */}
      {activeVenue && (
        <div className="modal-overlay" onClick={() => setActiveVenue(null)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#fff' }}>
                {paymentStep === 'slot' && '📅 Select Slot & Book Turf'}
                {paymentStep === 'payment' && '💳 Instant Payment Gateway'}
                {paymentStep === 'receipt' && '✅ Booking Receipt Confirmed'}
              </h3>
              <button onClick={() => setActiveVenue(null)} style={{ background: 'none', color: 'var(--text-muted)', fontSize: '1.4rem' }}>
                ✕
              </button>
            </div>

            {/* STEP 1: Slot Picker */}
            {paymentStep === 'slot' && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  📍 {activeVenue.location} • ₹{activeVenue.pricePerHour}/hr
                </p>

                <SlotGrid
                  venueId={activeVenue._id}
                  selectedSlot={selectedSlot}
                  onSelectSlot={(slot) => setSelectedSlot(slot)}
                  socket={socket}
                />

                {selectedSlot && (
                  <div style={{ marginTop: '1.5rem', background: 'rgba(0, 255, 135, 0.08)', border: '1px solid var(--pitch-green)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Selected Time Slot</div>
                      <div style={{ fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
                        {selectedSlot.date} | {selectedSlot.timeSlot}
                      </div>
                    </div>
                    <button
                      className="auth-btn"
                      onClick={() => setPaymentStep('payment')}
                    >
                      Proceed to Pay ₹{activeVenue.pricePerHour} →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Payment Checkout */}
            {paymentStep === 'payment' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>💳</div>
                <h4 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '0.25rem' }}>Secure Express Checkout</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  Instant Razorpay & UPI Checkout for <b>{activeVenue.name}</b>
                </p>

                <div style={{ background: 'var(--bg-input)', padding: '1.25rem', borderRadius: 'var(--radius-md)', textAlign: 'left', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Venue:</span>
                    <span style={{ fontWeight: '700', color: '#fff' }}>{activeVenue.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Date & Slot:</span>
                    <span style={{ fontWeight: '700', color: 'var(--pitch-green)' }}>{selectedSlot.date} ({selectedSlot.timeSlot})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)', fontSize: '1.1rem', fontWeight: '800' }}>
                    <span>Total Amount Payable:</span>
                    <span style={{ color: 'var(--pitch-green)' }}>₹{activeVenue.pricePerHour}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    className="nav-btn"
                    style={{ flex: 1, border: '1px solid var(--border-color)' }}
                    onClick={() => setPaymentStep('slot')}
                  >
                    ← Back
                  </button>
                  <button
                    className="auth-btn"
                    style={{ flex: 2, padding: '0.85rem' }}
                    onClick={handleConfirmPay}
                    disabled={processingPayment}
                  >
                    {processingPayment ? 'Processing Payment...' : `Pay ₹${activeVenue.pricePerHour} & Confirm Booking`}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Printable Receipt Confirmation */}
            {paymentStep === 'receipt' && bookingReceipt && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ background: 'rgba(0, 255, 135, 0.15)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', fontSize: '2rem' }}>
                  ✅
                </div>
                <h4 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff' }}>Booking Confirmed!</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  Receipt Reference: <b style={{ color: 'var(--pitch-green)' }}>{bookingReceipt.receiptId}</b>
                </p>

                <div style={{ background: 'var(--bg-input)', border: '2px dashed var(--pitch-green)', padding: '1.5rem', borderRadius: 'var(--radius-md)', textAlign: 'left', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff', marginBottom: '0.75rem' }}>
                    {bookingReceipt.venueId?.name || activeVenue.name}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    📅 Date: {bookingReceipt.date}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    ⏰ Time Slot: {bookingReceipt.timeSlot}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    💳 Amount Paid: ₹{bookingReceipt.price} (Status: PAID)
                  </p>
                </div>

                <button
                  className="auth-btn"
                  style={{ width: '100%', padding: '0.85rem' }}
                  onClick={() => setActiveVenue(null)}
                >
                  Done / View My Bookings
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
