const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB Connection URI with SSL options
const uri = process.env.MONGODB_URI || "mongodb+srv://quickinfo:quickinfo123@cluster0.7pbjynj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const dbName = process.env.DB_NAME || "excel_data";

const client = new MongoClient(uri, {
  ssl: true,
});

// Connect to MongoDB
async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected to MongoDB successfully");
    return client.db(dbName);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

module.exports = { connectToDatabase, client, dbName }; 