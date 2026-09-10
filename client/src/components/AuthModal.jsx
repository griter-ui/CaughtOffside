import React, { useState } from 'react';

const getApiUrl = (path) => {
  return path;
};

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'player',
    position: 'MF',
    experienceLevel: 'intermediate',
    preferredFoot: 'Right',
    location: 'Indiranagar, Bangalore',
    bio: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleQuickLogin = async (email, password) => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed.');
      }

      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('user', JSON.stringify(data.user));
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? getApiUrl('/api/auth/login') : getApiUrl('/api/auth/signup');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed.');
      }

      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('user', JSON.stringify(data.user));
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fff' }}>
            {isLogin ? '⚽ Sign In to CaughtOffside' : '🏆 Create Player Profile'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', color: 'var(--text-muted)', fontSize: '1.5rem' }}
          >
            ✕
          </button>
        </div>

        {/* Quick Demo Switcher Section */}
        <div style={{ background: 'rgba(0, 255, 135, 0.06)', border: '1px solid var(--pitch-green-glow)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--pitch-green)', textTransform: 'uppercase', marginBottom: '0.65rem', letterSpacing: '0.5px' }}>
            ⚡ One-Click Demo Accounts
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('rohan@gmail.com', 'password123')}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.5rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', textAlign: 'left' }}
            >
              ⚽ <b>Rohan (Player)</b>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Forward • Match Host</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('arjun@gmail.com', 'password123')}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.5rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', textAlign: 'left' }}
            >
              ⚽ <b>Arjun (Player)</b>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Midfield • Match Host</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('owner@turf.com', 'password123')}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.5rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', textAlign: 'left' }}
            >
              👑 <b>Rajesh (Turf Owner & Player)</b>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Turf Manager & Player</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('vikram@gmail.com', 'password123')}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.5rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', textAlign: 'left' }}
            >
              ⚽ <b>Vikram (Player & Defense)</b>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Defender • HSR Layout</div>
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(255, 94, 54, 0.15)', border: '1px solid var(--fire-orange)', color: 'var(--fire-orange)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Full Name
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="Rohan Verma"
                style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
              />
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Email Address
            </label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="rohan@example.com"
              style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
            />
          </div>

          {!isLogin && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Position
                </label>
                <select
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                >
                  <option value="FW">Forward (FW)</option>
                  <option value="MF">Midfielder (MF)</option>
                  <option value="DF">Defender (DF)</option>
                  <option value="GK">Goalkeeper (GK)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Experience
                </label>
                <select
                  name="experienceLevel"
                  value={formData.experienceLevel}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="pro">Pro</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Foot
                </label>
                <select
                  name="preferredFoot"
                  value={formData.preferredFoot}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff' }}
                >
                  <option value="Right">Right</option>
                  <option value="Left">Left</option>
                  <option value="Ambidextrous">Ambidextrous</option>
                </select>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-btn"
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginTop: '0.5rem' }}
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Player Profile'}
          </button>
        </form>

        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          {isLogin ? "Don't have a profile yet? " : 'Already registered? '}
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{ background: 'none', color: 'var(--pitch-green)', fontWeight: '700', textDecoration: 'underline' }}
          >
            {isLogin ? 'Sign Up Now' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
