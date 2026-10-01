const definitions = require('../../shared/footballFormats.json');
const FORMATS = definitions.map(format => format.value);

// Old single-format venues keep exactly their advertised format. A generic
// "Box Cricket & Football" label does not establish a football team size.
function getVenueFormats(venue) {
  if (Array.isArray(venue?.formats)) return FORMATS.filter(format => venue.formats.includes(format));
  const legacy = definitions.find(format => format.legacySportType === venue?.sportType);
  return legacy ? [legacy.value] : [];
}

function validateFormats(formats) {
  if (!Array.isArray(formats) || !formats.length || formats.length > FORMATS.length ||
      formats.some(format => !FORMATS.includes(format)) || new Set(formats).size !== formats.length) {
    throw Object.assign(new Error('Select one or more distinct football formats: 5v5, 7v7, or 11-a-side.'), { status: 400 });
  }
  return FORMATS.filter(format => formats.includes(format));
}

function selectBookingFormat(venue, requested) {
  const allowed = getVenueFormats(venue);
  // Omitted formats remain compatible for single-format callers. A multi-format
  // venue requires an explicit choice, rather than silently reserving the wrong size.
  const format = requested === undefined && allowed.length === 1 ? allowed[0] : requested;
  if (!allowed.includes(format)) {
    throw Object.assign(new Error(allowed.length
      ? `Choose a format offered by this turf: ${allowed.join(', ')}.`
      : 'The owner must configure this turf\'s football formats before it can be booked.'), { status: 400 });
  }
  return format;
}

const legacySportType = format => definitions.find(item => item.value === format)?.legacySportType;
const defaultSpots = format => definitions.find(item => item.value === format)?.spots;

module.exports = { FORMATS, definitions, getVenueFormats, validateFormats, selectBookingFormat, legacySportType, defaultSpots };
