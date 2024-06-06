const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const passport = require('passport');
const MongoDBStore = require('connect-mongodb-session')(session);

const indexRouter = require('./routes/index');
const apiRouter = require('./routes/api');
const { router: authRouter, ensureAuthenticated } = require('./routes/auth');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const app = express();
const store = new MongoDBStore({
  uri: process.env.MONGO_URI,
  databaseName: process.env.MONGO_DB,
  collection: 'userSessions'
});
store.on('error', function (error) {
  console.error(error);
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'lMC3A30Lhc',
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000  // 1 week
  },
  store: store,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.authenticate('session'));
app.use('/auth', authRouter);
app.use('/resources', ensureAuthenticated, express.static(path.join(process.env.VIDEOS_PATH)));
app.use('/api', ensureAuthenticated, apiRouter);
app.use(indexRouter);

module.exports = app;
