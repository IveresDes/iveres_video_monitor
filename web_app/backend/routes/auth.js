const crypto = require('crypto');
const path = require('path');

const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const connectToDatabase = require('../db/conn.js');
const { rolePermissions } = require('../utils/userRoles');

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

passport.use(new LocalStrategy(
  async function verify(username, password, cb) {
    const db = await connectToDatabase();
    const user = await db.collection('users').findOne({ username });
    if (!user) {
      return cb(null, false, { message: 'Incorrect username or password.' });
    }
    crypto.pbkdf2(password, user.salt, 310000, 32, 'sha256', function (err, hashedPassword) {
      if (err) { return cb(err); }
      const check = crypto.timingSafeEqual(
        Buffer.from(user.hashedPassword),
        Buffer.from(hashedPassword.toString('hex'))
      );
      if (!check) {
        return cb(null, false, { message: 'Incorrect username or password.' });
      }
      return cb(null, user);
    });
  }
));

passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    cb(null, { _id: user._id, username: user.username, role: user.role });
  });
});

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

let router = express.Router();

router.post('/login', passport.authenticate('local'),
  function (req, res, next) {
    if (req.user) {
      res.json({ username: req.user.username, role: req.user.role });
    } else {
      res.status(401).json({ error: 'Login error' });
    }
  }
);

router.get('/user',
  function (req, res, next) {
    if (req.user) {
      res.json({ username: req.user.username, role: req.user.role });
    } else {
      res.json({ error: 'No user exists' });
    }
  }
);

router.post('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return res.json({ error: 'Logout error' });
    } else {
      return res.json({ ok: true });
    }
  });
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    return res.status(401).json({ error: 'Not authenticated' });
  }
}

function ensureRole(role) {
  return (req, res, next) => {
    if (req.user && rolePermissions[req.user.role] >= rolePermissions[role]) {
      return next();
    } else {
      return res.status(401).json({ error: 'Role permissions insufficient' });
    }
  }
}

module.exports = { router, ensureAuthenticated, ensureRole };
