// server/index.js
const express = require('express');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken'); // [cite: 241]

const app = express();
// Middleware: cors, express.json()

// MongoDB Connection 
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster...`;

// Endpoints
app.get('/products', async (req, res) => {
  // Fetch with limit 6 for home or all for products page [cite: 51, 82]
});

app.post('/orders', async (req, res) => {
  // Save booking details [cite: 124]
});

app.listen(5000, () => console.log("Server running on 5000"));

// Example update route for Managers
app.patch('/orders/:id/track', verifyToken, async (req, res) => {
  const { status, location, note } = req.body;
  const filter = { _id: new ObjectId(req.params.id) };
  const updateDoc = {
    $push: {
      trackingHistory: {
        status,
        location,
        note,
        updatedAt: new Date()
      }
    }
  };
  const result = await orderCollection.updateOne(filter, updateDoc);
  res.send(result);
});