const express = require('express');
const { ObjectId } = require('mongodb');
const path = require('path');
const os = require('os');
const cors = require('cors');
const { connectToDatabase, client } = require('./config/db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
let db;

// Get server info
app.get('/api/server-info', (req, res) => {
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];
  
  // Get all IP addresses
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(iface => {
      // Skip internal/loopback interfaces
      if (!iface.internal && iface.family === 'IPv4') {
        addresses.push({
          interface: interfaceName,
          address: iface.address
        });
      }
    });
  });
  
  res.json({
    success: true,
    serverInfo: {
      hostname: os.hostname(),
      platform: os.platform(),
      addresses: addresses,
      port: PORT,
      uptime: os.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version
    }
  });
});

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

// Get all collections (sheets)
app.get('/api/collections', async (req, res) => {
  try {
    const collections = await db.listCollections().toArray();
    res.json({
      success: true,
      collections: collections.map(col => col.name)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get records from a specific collection
app.get('/api/collections/:collectionName', async (req, res) => {
  try {
    const { collectionName } = req.params;
    const { page = 1, limit = 20, search } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const collection = db.collection(collectionName);
    
    // Build query
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { fatherName: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const total = await collection.countDocuments(query);
    const data = await collection.find(query).skip(skip).limit(parseInt(limit)).toArray();
    
    res.json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get a single record by ID
app.get('/api/collections/:collectionName/:id', async (req, res) => {
  try {
    const { collectionName, id } = req.params;
    const collection = db.collection(collectionName);
    
    const record = await collection.findOne({ _id: new ObjectId(id) });
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }
    
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update a record
app.put('/api/collections/:collectionName/:id', async (req, res) => {
  try {
    const { collectionName, id } = req.params;
    const collection = db.collection(collectionName);
    const updates = req.body;
    
    // Create an updates object with only the fields that are provided
    const updateFields = {};
    
    if (updates.name) updateFields.name = updates.name;
    if (updates.fatherName) updateFields.fatherName = updates.fatherName;
    if (updates.address) updateFields.address = updates.address;
    if (updates.phoneNumber) updateFields.phoneNumber = updates.phoneNumber;
    if (updates.email) updateFields.email = updates.email;
    
    // Update additionalInfo as well to keep data consistent
    if (Object.keys(updateFields).length > 0) {
      const additionalInfoUpdates = {};
      if (updates.name) additionalInfoUpdates['additionalInfo.NAME'] = updates.name;
      if (updates.fatherName) additionalInfoUpdates['additionalInfo.FATHER/HUSBAND NAME'] = updates.fatherName;
      if (updates.address) additionalInfoUpdates['additionalInfo.ADDRESS'] = updates.address;
      if (updates.phoneNumber) additionalInfoUpdates['additionalInfo.MOBILE NO'] = updates.phoneNumber;
      if (updates.email) additionalInfoUpdates['additionalInfo.EMAIL'] = updates.email;
      
      Object.assign(updateFields, additionalInfoUpdates);
    }
    
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Record updated successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Initialize database connection and start server
(async () => {
  try {
    db = await connectToDatabase();
    console.log('Connected to MongoDB in Express server');
    
    // Start server
    app.listen(PORT, HOST, () => {
      console.log(`Server running on ${HOST}:${PORT}`);
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Server is now accessible globally at:`);
        
        // Show all available interfaces
        const networkInterfaces = os.networkInterfaces();
        Object.keys(networkInterfaces).forEach(interfaceName => {
          networkInterfaces[interfaceName].forEach(iface => {
            if (!iface.internal && iface.family === 'IPv4') {
              console.log(`http://${iface.address}:${PORT}/`);
            }
          });
        });
      } else {
        console.log('Server is running in production mode');
      }
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
})();

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('Closing MongoDB connection...');
  await client.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});

// Handle termination signal (useful for cloud environments like Render)
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await client.close();
  console.log('MongoDB connection closed');
  process.exit(0);
}); 