const mongoose = require('mongoose');

let mongod = null;

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  try {
    if (uri && !uri.includes('127.0.0.1') && !uri.includes('localhost')) {
      const conn = await mongoose.connect(uri);
      console.log(`[MongoDB] Connected to Cloud Cluster: ${conn.connection.host}`);
      return conn;
    }

    // Try standard connection first
    const conn = await mongoose.connect(uri || 'mongodb://127.0.0.1:27017/nexora', {
      serverSelectionTimeoutMS: 2500
    });
    console.log(`[MongoDB] Connected locally: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.warn(`[MongoDB] Local instance unavailable (${error.message}). Initializing In-Memory Mongo Instance for seamless development...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongod = await MongoMemoryServer.create({
        instance: {
          dbName: 'nexora'
        }
      });
      const memUri = mongod.getUri();
      const conn = await mongoose.connect(memUri);
      console.log(`[MongoDB] In-Memory MongoDB running successfully at ${memUri}`);
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
