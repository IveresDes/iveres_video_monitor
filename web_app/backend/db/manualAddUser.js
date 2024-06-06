#!/usr/bin/node

const crypto = require('crypto');
const connectToDatabase = require('../db/conn.js');
const { role: userRoles } = require('../utils/userRoles.js')

const username = process.argv[2];
const role = process.argv[3];
const password = process.argv[4] || crypto.randomBytes(5).toString('hex');


if (!username || !role || !password) {
  console.log("Missing args");
  process.exit();
}

if (!Object.values(userRoles).includes(role)) {
  console.log("Invalid role");
  process.exit();
}

const salt = crypto.randomBytes(16).toString('hex');
const hashedPassword = crypto.pbkdf2Sync(password, salt, 310000, 32, 'sha256').toString('hex');
const newUser = { username, role, hashedPassword, salt, created: new Date() };

(async () => {
  const db = await connectToDatabase();
  const res = await db.collection('users').insertOne(newUser);
  if (res?.insertedId) {
    console.log('Created:', username, role, password, res.insertedId.toString());
  } else {
    console.log('Error inserting user', res);
  }
  process.exit();
})();
