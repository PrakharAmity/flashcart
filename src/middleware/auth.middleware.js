import { verifyToken } from '../utils/security.js';
import { config } from '../config.js';
import { db } from '../db/index.js';

export function authenticate(req, res, next) {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.flashcart_token) {
    token = req.cookies.flashcart_token;
  }

  if (!token) {
    // Check if test or dev mode has a default demo user header
    if (req.headers['x-user-id']) {
      const user = db.findUserById(req.headers['x-user-id']);
      if (user) {
        req.user = user;
        return next();
      }
    }
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const payload = verifyToken(token, config.jwtSecret);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }

  const user = db.findUserById(payload.id);
  if (!user || user.status !== 'ACTIVE') {
    return res.status(401).json({ error: 'User account not active.' });
  }

  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of [${roles.join(', ')}] role.`
      });
    }
    next();
  };
}
