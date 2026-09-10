import React, { useState, useEffect } from 'react';

export default function SlotGrid({ venueId, onSelectSlot, selectedSlot, socket }) {
  const getTodayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  const [selectedDate, setSelectedDate] = useState(getTodayISO);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [socketLockedSlot, setSocketLockedSlot] = useState(null);

  // Parse YYYY-MM-DD components
  const [currYear, currMonth, currDay] = selectedDate.split('-').map(Number);

  // Generate Year options up to 2030
  const startYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 3 }, (_, i) => startYear + i);

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Calculate days in selected month & year
  const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();
  const maxDays = getDaysInMonth(currYear, currMonth);

  const fetchSlots = async (date) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/venues/${venueId}/slots?date=${date}`);
      const data = await res.json();
      if (res.ok) {
        setSlots(data.slots || []);
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (venueId) {
      fetchSlots(selectedDate);
    }
  }, [venueId, selectedDate]);

  useEffect(() => {
    if (!socket) return;

    socket.on('slot_booked', ({ venueId: bookedVenueId, date, timeSlot }) => {
      if (bookedVenueId === venueId && date === selectedDate) {
        setSlots(prev => prev.map(s => s.timeSlot === timeSlot ? { ...s, status: 'booked' } : s));
      }
    });

    socket.on('slot_selecting', ({ venueId: selVenueId, date, timeSlot }) => {
      if (selVenueId === venueId && date === selectedDate) {
        setSocketLockedSlot(timeSlot);
      }
    });

    socket.on('slot_deselected', ({ venueId: deselVenueId, date, timeSlot }) => {
      if (deselVenueId === venueId && date === selectedDate) {
        setSocketLockedSlot(null);
      }
    });

    socket.on('slot_cancelled', ({ venueId: canVenueId, date, timeSlot }) => {
      if ((canVenueId === venueId || canVenueId?._id === venueId) && date === selectedDate) {
        setSlots(prev => prev.map(s => s.timeSlot === timeSlot ? { ...s, status: 'available' } : s));
      }
    });

    return () => {
      socket.off('slot_booked');
      socket.off('slot_selecting');
      socket.off('slot_deselected');
      socket.off('slot_cancelled');
    };
  }, [socket, venueId, selectedDate]);

  const updateDateComponents = (year, month, day) => {
    const yStr = String(year).padStart(4, '0');
    const mStr = String(month).padStart(2, '0');
    const daysMax = getDaysInMonth(year, month);
    const validDay = Math.min(day, daysMax);
    const dStr = String(validDay).padStart(2, '0');

    const newIso = `${yStr}-${mStr}-${dStr}`;

    // Ensure selected date is not in the past
    if (newIso < getTodayISO()) {
      setSelectedDate(getTodayISO());
    } else {
      setSelectedDate(newIso);
    }
    onSelectSlot(null);
  };

  const handleSlotClick = (slot) => {
    if (slot.status === 'booked' || slot.status === 'expired') return;

    const isSelecting = selectedSlot?.timeSlot !== slot.timeSlot;
    if (isSelecting) {
      socket?.emit('select_slot', { venueId, date: selectedDate, timeSlot: slot.timeSlot });
      onSelectSlot({ date: selectedDate, timeSlot: slot.timeSlot });
    } else {
      socket?.emit('deselect_slot', { venueId, date: selectedDate, timeSlot: slot.timeSlot });
      onSelectSlot(null);
    }
  };

  return (
    <div className="slot-grid-container">
      <h4 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        📅 Select Date & Time Slot (Bookings open through 2030)
      </h4>

      {/* Year, Month, Day Dropdowns */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', background: 'var(--bg-input)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ flex: '1 1 110px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Year</label>
          <select
            value={currYear}
            onChange={(e) => updateDateComponents(Number(e.target.value), currMonth, currDay)}
            style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 140px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Month</label>
          <select
            value={currMonth}
            onChange={(e) => updateDateComponents(currYear, Number(e.target.value), currDay)}
            style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
          >
            {monthNames.map((mName, idx) => (
              <option key={idx + 1} value={idx + 1}>{mName}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 90px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Date</label>
          <select
            value={currDay}
            onChange={(e) => updateDateComponents(currYear, currMonth, Number(e.target.value))}
            style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
          >
            {Array.from({ length: maxDays }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 150px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Date Picker Calendar</label>
          <input
            type="date"
            min={getTodayISO()}
            max="2030-12-31"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) {
                setSelectedDate(e.target.value);
                onSelectSlot(null);
              }
            }}
            style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Quick Shortcut Date Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        <button
          type="button"
          className={`date-tab ${selectedDate === getTodayISO() ? 'active' : ''}`}
          onClick={() => { setSelectedDate(getTodayISO()); onSelectSlot(null); }}
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
        >
          Today
        </button>
        <button
          type="button"
          className={`date-tab ${selectedDate === new Date(Date.now() + 86400000).toISOString().split('T')[0] ? 'active' : ''}`}
          onClick={() => {
            const tom = new Date(Date.now() + 86400000).toISOString().split('T')[0];
            setSelectedDate(tom);
            onSelectSlot(null);
          }}
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
        >
          Tomorrow
        </button>
      </div>

      {/* Selected Date Summary */}
      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--pitch-green)', marginBottom: '1rem' }}>
        📅 Booking Date Selected: {selectedDate}
      </div>

      {/* Slots Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
          Loading slot availability...
        </div>
      ) : (
        <div className="slots-flex">
          {slots.map(s => {
            const isBooked = s.status === 'booked';
            const isExpired = s.status === 'expired';
            const isSelected = selectedSlot?.timeSlot === s.timeSlot && selectedSlot?.date === selectedDate;
            const isSocketLocked = socketLockedSlot === s.timeSlot && !isSelected;

            let btnClass = 'slot-btn available';
            if (isBooked || isExpired) btnClass = 'slot-btn booked';
            if (isSelected) btnClass = 'slot-btn selected';
            if (isSocketLocked) btnClass = 'slot-btn booked';

            return (
              <button
                key={s.timeSlot}
                className={btnClass}
                disabled={isBooked || isExpired || isSocketLocked}
                onClick={() => handleSlotClick(s)}
              >
                <span>{s.timeSlot}</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                  {isExpired
                    ? '⏳ Past / Expired'
                    : isBooked
                    ? '❌ Booked'
                    : isSelected
                    ? '✓ Selected'
                    : isSocketLocked
                    ? '🔒 Locking...'
                    : '🟢 Available'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
