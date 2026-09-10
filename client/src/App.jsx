import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

import VenuesPage from './pages/VenuesPage';
import OpenMatchesPage from './pages/OpenMatchesPage';
import PlayerDirectoryPage from './pages/PlayerDirectoryPage';
import ProfilePage from './pages/ProfilePage';
import MyBookingsPage from './pages/MyBookingsPage';
import OwnerDashboardPage from './pages/OwnerDashboardPage';
import AuthModal from './components/AuthModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('venues'); // 'venues' | 'matches' | 'players' | 'profile' | 'bookings' | 'owner'
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [socket, setSocket] = useState(null);

  // Initialize Socket.io
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Fetch logged in user on mount
  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setCurrentUser(data.user);
          } else {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
          }
        })
        .catch(err => console.error(err));
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setCurrentUser(null);
    setActiveTab('venues');
  };

  return (
    <div>
      {/* Top Navbar */}
      <nav className="navbar">
        <div className="brand-logo" onClick={() => setActiveTab('venues')} style={{ cursor: 'pointer' }}>
          <div className="brand-icon">⚽</div>
          <span>CAUGHTOFFSIDE</span>
        </div>

        <ul className="nav-links">
          <li>
            <button
              className={`nav-btn ${activeTab === 'venues' ? 'active' : ''}`}
              onClick={() => setActiveTab('venues')}
            >
              🏟️ Venues
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${activeTab === 'matches' ? 'active' : ''}`}
              onClick={() => setActiveTab('matches')}
            >
              ⚡ Open Games
            </button>
          </li>
          <li>
            <button
              className={`nav-btn ${activeTab === 'players' ? 'active' : ''}`}
              onClick={() => setActiveTab('players')}
            >
              🎴 Player Directory
            </button>
          </li>

          {currentUser && (
            <li>
              <button
                className={`nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                👤 My Profile & Hub
              </button>
            </li>
          )}

          {currentUser ? (
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.85rem', borderRadius: '20px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--pitch-green)', fontWeight: '800' }}>{currentUser.position || 'MF'}</span>
                <span style={{ color: '#fff', fontWeight: '700' }}>{currentUser.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="nav-btn"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: 'var(--fire-orange)' }}
              >
                Logout
              </button>
            </li>
          ) : (
            <li>
              <button className="auth-btn" onClick={() => setIsAuthModalOpen(true)}>
                Sign In / Sign Up
              </button>
            </li>
          )}
        </ul>
      </nav>

      {/* Main Page View Routing */}
      <main>
        <div style={{ padding: '0.8rem 1rem', textAlign: 'center', background: 'rgba(0, 255, 135, 0.08)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          College project demo · Sample venues and shared demo accounts · Bookings and payments are simulated. No money is charged.
        </div>
        {activeTab === 'venues' && (
          <VenuesPage socket={socket} currentUser={currentUser} />
        )}
        {activeTab === 'matches' && (
          <OpenMatchesPage socket={socket} currentUser={currentUser} />
        )}
        {activeTab === 'players' && (
          <PlayerDirectoryPage currentUser={currentUser} />
        )}
        {activeTab === 'profile' && (
          <ProfilePage socket={socket} currentUser={currentUser} onUpdateUser={(u) => setCurrentUser(u)} />
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthModalOpen(false);
        }}
      />
    </div>
  );
}
