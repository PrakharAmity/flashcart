import express from 'express';
import { authService } from '../services/auth.service.js';
import { authenticate } from '../middleware/auth.middleware.js';

export const authRouter = express.Router();

authRouter.post('/register', (req, res) => {
  try {
    const result = authService.register(req.body);
    res.cookie('flashcart_token', result.token, { httpOnly: true, sameSite: 'lax', maxAge: 2 * 3600 * 1000 });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

authRouter.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const result = authService.login(email, password);
    res.cookie('flashcart_token', result.token, { httpOnly: true, sameSite: 'lax', maxAge: 2 * 3600 * 1000 });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

authRouter.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = authService.refresh(refreshToken);
    res.cookie('flashcart_token', result.token, { httpOnly: true, sameSite: 'lax', maxAge: 2 * 3600 * 1000 });
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 401).json({ error: err.message });
  }
});

authRouter.post('/logout', (req, res) => {
  const { refreshToken } = req.body;
  authService.logout(refreshToken);
  res.clearCookie('flashcart_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

authRouter.post('/forgot-password', (req, res) => {
  try {
    const { email } = req.body;
    const result = authService.forgotPassword(email);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

authRouter.post('/reset-password', (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    const result = authService.resetPassword(resetToken, newPassword);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

authRouter.get('/me', authenticate, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      phone: req.user.phone
    }
  });
});
