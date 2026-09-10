/**
 * Helper to check if a match or slot date/time has passed relative to current system time.
 * @param {string} dateStr - Date string in format "YYYY-MM-DD" e.g. "2026-09-09"
 * @param {string} timeSlotStr - Time slot string e.g. "07:00 PM - 08:00 PM"
 * @returns {boolean} true if match date/time is in the past, false otherwise
 */
export function isMatchExpired(dateStr, timeSlotStr) {
  if (!dateStr) return false;

  const now = new Date();
  const indiaNow = new Date(now.getTime() + 19800000);
  const year = indiaNow.getUTCFullYear();
  const month = String(indiaNow.getUTCMonth() + 1).padStart(2, '0');
  const day = String(indiaNow.getUTCDate()).padStart(2, '0');
  const todayISO = `${year}-${month}-${day}`;

  // If match date is prior to today's date -> expired
  if (dateStr < todayISO) return true;
  // If match date is in the future -> not expired
  if (dateStr > todayISO) return false;

  // If match date is today, check end time of time slot
  if (!timeSlotStr) return false;

  // Extract end time portion e.g. "07:00 PM - 08:00 PM" -> "08:00 PM"
  const parts = timeSlotStr.split('-');
  const endTimeStr = (parts.length > 1 ? parts[1] : parts[0]).trim();

  const parsedEnd = parseTimeToDate(dateStr, endTimeStr);
  if (!parsedEnd) return false;

  return now > parsedEnd;
}

function parseTimeToDate(dateStr, timeStr) {
  // Matches "08:00 PM", "8:00 PM", "11:30 AM", "20:00"
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toUpperCase() : null;

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hours, minutes) - 19800000);
}
