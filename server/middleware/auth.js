const jwt = require('jsonwebtoken');

if (process.env.NODE_ENV === 'production' &&
    (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 ||
     ['replace-with-a-long-random-secret', 'football_passport_secret_key_2026'].includes(process.env.JWT_SECRET))) {
  throw new Error('Set JWT_SECRET to a random secret of at least 32 characters before deploying.');
}
const JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken, JWT_SECRET };
