import React, { useState, useEffect } from 'react';

export default function MatchNoticeBoard({ matchId, socket, currentUser, isAcceptedPlayer }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}/comments`);
      const data = await res.json();
      if (res.ok) {
        setComments(data.comments || []);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  useEffect(() => {
    if (matchId) {
      fetchComments();
    }
  }, [matchId]);

  useEffect(() => {
    if (!socket || !matchId) return;

    socket.on(`match_comment_${matchId}`, (comment) => {
      setComments(prev => [...prev, comment]);
    });

    return () => {
      socket.off(`match_comment_${matchId}`);
    };
  }, [socket, matchId]);

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const token = sessionStorage.getItem('token');
    if (!token) return alert('Please login to post comments.');

    setSubmitting(true);
    try {
      const res = await fetch(`/api/matches/${matchId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ commentText: newComment })
      });
      const data = await res.json();
      if (res.ok) {
        setNewComment('');
      } else {
        alert(data.message || 'Error posting comment.');
      }
    } catch (err) {
      alert('Error posting comment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="notice-board">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--pitch-green)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📋 Match Notice Board (Squad Discussion)
        </h4>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {comments.length} Messages
        </span>
      </div>

      {comments.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '1rem' }}>
          No notices posted yet. Be the first to start the squad discussion!
        </p>
      ) : (
        <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '0.25rem', marginBottom: '1rem' }}>
          {comments.map((c, idx) => (
            <div key={c._id || idx} className="comment-item">
              <div className="comment-header">
                <span className="comment-author">
                  ⚽ {c.userName} ({c.userPosition})
                </span>
                <span className="comment-time">
                  {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="comment-text">{c.commentText}</p>
            </div>
          ))}
        </div>
      )}

      {isAcceptedPlayer ? (
        <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Post squad update (e.g. Bringing bibs, extra ball, 7 PM sharp)..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            style={{
              flex: 1,
              padding: '0.65rem 1rem',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontSize: '0.85rem'
            }}
          />
          <button
            type="submit"
            disabled={submitting}
            className="auth-btn"
            style={{ padding: '0.65rem 1rem', fontSize: '0.85rem' }}
          >
            {submitting ? '...' : 'Post'}
          </button>
        </form>
      ) : (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: '8px' }}>
          🔒 Only accepted match players can post on the Notice Board.
        </p>
      )}
    </div>
  );
}
