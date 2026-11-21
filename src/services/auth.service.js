import { db } from '../db/index.js';
import { hashPassword, verifyPassword, generateToken, verifyToken } from '../utils/security.js';
import { config } from '../config.js';

const passwordResetTokens = new Map();
const activeRefreshSessions = new Map();

export const authService = {
  register(userData) {
    const { email, password, name, phone, role } = userData;

    if (!email || !password || !name) {
      throw new Error('Name, email, and password are required');
    }

    if (role === 'ADMIN') {
      throw new Error('Public registration cannot create ADMIN accounts');
    }

    const existingUser = db.findUserByEmail(email);
    if (existingUser) {
      const err = new Error('An account with this email address already exists');
      err.statusCode = 409;
      throw err;
    }

    const assignedRole = role === 'SELLER' ? 'SELLER' : 'CUSTOMER';
    const newUser = {
      id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password),
      name: name.trim(),
      role: assignedRole,
      phone: phone || '',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);

    if (assignedRole === 'SELLER') {
      db.sellers.push({
        id: `seller-${Date.now()}`,
        userId: newUser.id,
        storeName: `${newUser.name}'s Shop`,
        rating: 5.0,
        totalSales: 0,
        verified: false
      });
    }

    db.addAuditLog({
      action: 'USER_REGISTERED',
      userId: newUser.id,
      role: newUser.role,
      details: { email: newUser.email }
    });

    const token = generateToken({ id: newUser.id, email: newUser.email, role: newUser.role }, config.jwtSecret);
    const refreshToken = `ref-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    activeRefreshSessions.set(refreshToken, { userId: newUser.id, expiresAt: Date.now() + 7 * 86400000 });

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        phone: newUser.phone
      },
      token,
      refreshToken
    };
  },

  login(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    if (user.status !== 'ACTIVE') {
      const err = new Error('This account has been deactivated or suspended');
      err.statusCode = 403;
      throw err;
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role }, config.jwtSecret);
    const refreshToken = `ref-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    activeRefreshSessions.set(refreshToken, { userId: user.id, expiresAt: Date.now() + 7 * 86400000 });

    db.addAuditLog({
      action: 'USER_LOGIN',
      userId: user.id,
      role: user.role,
      details: { email: user.email }
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone
      },
      token,
      refreshToken
    };
  },

  refresh(refreshToken) {
    if (!refreshToken || !activeRefreshSessions.has(refreshToken)) {
      const err = new Error('Invalid or expired refresh token');
      err.statusCode = 401;
      throw err;
    }

    const session = activeRefreshSessions.get(refreshToken);
    if (session.expiresAt < Date.now()) {
      activeRefreshSessions.delete(refreshToken);
      const err = new Error('Refresh token expired');
      err.statusCode = 401;
      throw err;
    }

    const user = db.findUserById(session.userId);
    if (!user) {
      activeRefreshSessions.delete(refreshToken);
      const err = new Error('User not found');
      err.statusCode = 401;
      throw err;
    }

    activeRefreshSessions.delete(refreshToken);
    const newRefreshToken = `ref-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    activeRefreshSessions.set(newRefreshToken, { userId: user.id, expiresAt: Date.now() + 7 * 86400000 });

    const newToken = generateToken({ id: user.id, email: user.email, role: user.role }, config.jwtSecret);

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      token: newToken,
      refreshToken: newRefreshToken
    };
  },

  logout(refreshToken) {
    if (refreshToken && activeRefreshSessions.has(refreshToken)) {
      activeRefreshSessions.delete(refreshToken);
    }
    return { success: true, message: 'Logged out successfully' };
  },

  forgotPassword(email) {
    const user = db.findUserByEmail(email);
    if (!user) {
      return { success: true, message: 'If this email is registered, a password reset token has been sent.' };
    }

    const resetToken = `rst-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    passwordResetTokens.set(resetToken, {
      email: user.email,
      expiresAt: Date.now() + 15 * 60 * 1000,
      used: false
    });

    return {
      success: true,
      message: 'If this email is registered, a password reset token has been sent.',
      devResetToken: resetToken
    };
  },

  resetPassword(resetToken, newPassword) {
    if (!resetToken || !passwordResetTokens.has(resetToken)) {
      const err = new Error('Invalid or expired password reset token');
      err.statusCode = 400;
      throw err;
    }

    const record = passwordResetTokens.get(resetToken);
    if (record.used || record.expiresAt < Date.now()) {
      const err = new Error('Reset token has expired or already been used');
      err.statusCode = 400;
      throw err;
    }

    const user = db.findUserByEmail(record.email);
    if (!user) {
      const err = new Error('User no longer exists');
      err.statusCode = 404;
      throw err;
    }

    user.passwordHash = hashPassword(newPassword);
    record.used = true;

    db.addAuditLog({
      action: 'PASSWORD_RESET',
      userId: user.id,
      role: user.role,
      details: { email: user.email }
    });

    return { success: true, message: 'Password has been updated successfully. Please log in.' };
  },

  getCurrentUser(userId) {
    const user = db.findUserById(userId);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      createdAt: user.createdAt
    };
  }
};
