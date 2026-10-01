import definitions from '../../../shared/footballFormats.json' with { type: 'json' };

export const FORMAT_OPTIONS = definitions;
export function getVenueFormats(venue) {
  if (Array.isArray(venue?.formats)) return definitions.map(item => item.value).filter(format => venue.formats.includes(format));
  const legacy = definitions.find(item => item.legacySportType === venue?.sportType);
  return legacy ? [legacy.value] : [];
}
export const defaultSpots = format => definitions.find(item => item.value === format)?.spots || 10;

// Once reserved, the selected format belongs to the booking. Legacy reservations
// without a format can choose from the venue's current supported formats.
export function getHostFormats(venue, booking) {
  const formats = getVenueFormats(venue);
  return booking?.format ? formats.filter(format => format === booking.format) : formats;
}
