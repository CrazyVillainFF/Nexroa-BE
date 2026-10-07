const mongoose = require('mongoose');

let mongod = null;

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  const isProd = process.env.NODE_ENV === 'production';

  // In production, MONGO_URI is required — fail fast and clearly
  if (isProd && !uri) {
    throw new Error('[MongoDB] MONGO_URI environment variable is not set. Set it in Render → Environment.');
  }

  // Cloud Atlas URI — connect directly, no fallback
  if (uri && !uri.includes('127.0.0.1') && !uri.includes('localhost')) {
    try {
      const conn = await mongoose.connect(uri);
      console.log(`[MongoDB] Connected to Cloud Cluster: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error(`[MongoDB] Failed to connect to Atlas: ${error.message}`);
      throw error; // Crash in production — don't silently fall back
    }
  }

  // Development fallback: try local MongoDB first
  try {
    const conn = await mongoose.connect(uri || 'mongodb://127.0.0.1:27017/nexora', {
      serverSelectionTimeoutMS: 2500
    });
    console.log(`[MongoDB] Connected locally: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.warn(`[MongoDB] Local MongoDB unavailable. Trying In-Memory fallback...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongod = await MongoMemoryServer.create({ instance: { dbName: 'nexora' } });
      const memUri = mongod.getUri();
      const conn = await mongoose.connect(memUri);
      console.log(`[MongoDB] In-Memory MongoDB running at ${memUri}`);
      return conn;
    } catch (memErr) {
      console.error(`[MongoDB] In-Memory Mongo error: ${memErr.message}`);
      throw memErr;
    }
  }
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
};

module.exports = { connectDB, disconnectDB };
