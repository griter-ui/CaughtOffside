import React from 'react';
import { FORMAT_OPTIONS } from '../utils/venueFormats';

// One reusable owner control for both new listings and existing turf edits.
export default function VenueFormatPicker({ value, onChange, disabled = false }) {
  return (
    <fieldset disabled={disabled} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', minWidth: 0 }}>
      <legend style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0 0.3rem' }}>Supported football formats</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {FORMAT_OPTIONS.map(({ value: format }) => (
          <label key={format} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={value.includes(format)} onChange={event => onChange(event.target.checked ? [...value, format] : value.filter(item => item !== format))} />
            {format}
          </label>
        ))}
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Select every format available on this turf. All formats share the same time slots.</p>
    </fieldset>
  );
}
