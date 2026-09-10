// The demo's venues are in India. Explicit offsets also work on UTC hosting servers.
const DEFAULT_SLOTS = [
  '06:00 AM - 07:00 AM', '07:00 AM - 08:00 AM',
  '08:00 AM - 09:00 AM', '09:00 AM - 10:00 AM',
  '10:00 AM - 11:00 AM', '04:00 PM - 05:00 PM',
  '05:00 PM - 06:00 PM', '06:00 PM - 07:00 PM',
  '07:00 PM - 08:00 PM', '08:00 PM - 09:00 PM',
  '09:00 PM - 10:00 PM', '10:00 PM - 11:00 PM'
];

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isSlotExpired(date, slot, now = new Date()) {
  if (!isValidDate(date) || !DEFAULT_SLOTS.includes(slot)) return true;
  const [, hour, minute, period] = slot.match(/^(\d{2}):(\d{2}) (AM|PM)/);
  const hours = Number(hour) % 12 + (period === 'PM' ? 12 : 0);
  return now >= new Date(`${date}T${String(hours).padStart(2, '0')}:${minute}:00+05:30`);
}

module.exports = { DEFAULT_SLOTS, isValidDate, isSlotExpired };
