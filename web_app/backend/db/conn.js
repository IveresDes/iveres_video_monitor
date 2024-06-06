const { MongoClient, Db } = require('mongodb');
const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const connectionString = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';

const client = new MongoClient(connectionString);

let db = null;

/**
 * Connects to the database and returns the initialized database object.
 * @returns {Promise<Db>} A promise that resolves to the MongoDB database object.
 */
async function connectToDatabase() {
  if (!db) {
    try {
      await client.connect();
      db = client.db(process.env.MONGO_DB);
      console.debug('Db connected')
    } catch (e) {
      console.error('Error connecting to the database:', e);
    }
  }
  return db;
}

module.exports = connectToDatabase;
