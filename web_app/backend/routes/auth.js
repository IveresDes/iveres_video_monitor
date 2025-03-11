const crypto = require('crypto');
const path = require('path');

const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const connectToDatabase = require('../db/conn.js');
const { rolePermissions } = require('../utils/userRoles');

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const WEB_AUTH_API_KEY = process.env.WEB_AUTH_API_KEY;

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
      if (user?.created && user?.expirationTime) {
        const isExpired = (Date.now() - user.created.getTime()) > 1000 * user.expirationTime;
        if (isExpired) {
          console.log('Expired user');
          return cb(null, false, { message: 'Expired user.' });
        }
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
      // Change session cookie maxAge for users with expirationTime
      if (req.user.expirationTime) {
        req.session.cookie.maxAge = req.user.expirationTime * 1000;
      }
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

const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === WEB_AUTH_API_KEY) {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden' });
  }
};

router.post('/create-temp-user', authenticateApiKey, async (req, res) => {
  const { username, password, expirationTime } = req.body;
  if (!username || !password || !expirationTime) {
    return res.status(400).json({ error: 'Missing username, password or expirationTime' });
  }

  // Check if user already exists
  const db = await connectToDatabase();
  const user = await db.collection('users').findOne({ username });
  // If the existing user is not a temporary user do not continue
  if (user && !user?.tempUser) {
    return res.status(409).json({ error: 'username already exists' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hashedPassword = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
  const newUser = {
    username,
    role: 'uploader',
    hashedPassword,
    salt,
    created: new Date(),
    expirationTime,
    tempUser: true,
  };

  // If temporary user already existed replace it otherwise create a new user
  const result = await db.collection('users').updateOne(
    { username, tempUser: true },
    { $set: newUser, $inc: { createCount: 1 } },
    { upsert: true }
  );

  // If the user is new, subscribe and add some videos
  if (result?.upsertedId) {
    const userId = result.upsertedId.toString();
    try {
      const channelsId = [
        'hespress',
        'LibertadDigital',
        '6965785214690837510',
        '6807574107615364101',
        '7286062708264829985',
        'tvrain',
        'ChechuLeduc',
        'mundodesconocido',
        'Spanish_Revolution',
      ];
      // Add user to monitoring
      const subscribeDatetime = (new Date()).toISOString().replace('Z', '+00:00');
      await db.collection('watchlist').updateMany(
        { channelId: { $in: channelsId } },
        { $push: { monitoringUsers: { userId, subscribeDatetime, tempUser: true } } }
      );
      // Add last videos
      const now = new Date();
      const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startDateStr = startDate.toISOString().replace('Z', '+00:00');
      await db.collection('videos').updateMany(
        {
          downloadDatetime: { '$gt': startDateStr },
          'platformMetadata.uploaderId': { $in: channelsId }
        },
        { $push: { requests: { userId, source: 'tempMonitor', tempUser: true } } }
      );
    } catch (error) {
      console.log(`Error adding monitoring for user ${userId}`, error);
    }
  }

  res.status(201).json({ message: 'User created successfully' });
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
