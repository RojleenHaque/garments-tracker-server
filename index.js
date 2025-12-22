const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
// This line imports the function from your middleware file
const verifyToken = require('./middleware/verifyToken'); 
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// 1. Middleware Setup
// index.js
app.use(cors({
    origin: [
        'http://localhost:3000', // Add this for your current frontend
        'http://localhost:5173', // Keep this for Vite default
        'https://your-live-link.vercel.app' // Your production link
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// 2. MongoDB Connection
const uri = process.env.DB_URI; 
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const db = client.db("garmentsTracker");
        const usersCollection = db.collection("users");
        const productsCollection = db.collection("products");
        const ordersCollection = db.collection("orders");

        // --- AUTH API ---
        app.post('/jwt', async (req, res) => { /* ... code remains same ... */ });
        app.post('/logout', (req, res) => { /* ... code remains same ... */ });

        // --- PRODUCTS API (KEEP THIS ONE INSIDE RUN) ---
        app.get('/home-products', async (req, res) => {
            const query = { showOnHome: true }; 
            const result = await productsCollection.find(query).limit(6).toArray();
            res.send(result);
        });

        app.get('/all-products', async (req, res) => {
            const page = parseInt(req.query.page) || 0;
            const size = parseInt(req.query.size) || 10;
            const result = await productsCollection.find()
                .skip(page * size)
                .limit(size)
                .toArray();
            res.send(result);
        });

        // ... rest of your routes (post products, users, orders) ...

        console.log("Successfully connected to MongoDB!");
    } catch (error) {
        console.error("MongoDB Connection Error:", error);
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Garments Tracker Server is Running');
});
// GET /home-products -> return 6 products
app.get('/home-products', async (req, res) => {
  try {
    const result = await productsCollection.find().limit(6).toArray(); // LIMIT 6
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error fetching products" });
  }
});
// index.js - Inside the run() function
app.get('/product/:id', async (req, res) => {
    try {
        const id = req.params.id;

        // 1. Validate ID format before querying MongoDB
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid ID format" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await productsCollection.findOne(query);

        if (!result) {
            return res.status(404).send({ message: "Product not found" });
        }

        res.send(result);
    } catch (error) {
        console.error("Fetch Single Product Error:", error);
        res.status(500).send({ message: "Server error" });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});