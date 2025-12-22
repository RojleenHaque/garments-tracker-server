const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const verifyToken = require('./middleware/verifyToken'); 
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// 1. Middleware Setup (Must be first)
app.use(cors({
    origin: ['http://localhost:5173', 'https://your-live-link.vercel.app'], 
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// 2. JWT Secret & Token Verification Middleware
// This must be defined BEFORE any routes that use it
const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).send({ message: 'unauthorized access' });
    
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).send({ message: 'unauthorized access' });
        req.user = decoded;
        next();
    });
};

// 3. MongoDB Connection
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
        // Connect to MongoDB
        // await client.connect(); // Uncomment if using local Node environment
        
        const db = client.db("garmentsTracker");
        const usersCollection = db.collection("users");
        const productsCollection = db.collection("products");
        const ordersCollection = db.collection("orders");

        // --- AUTH API ---
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            }).send({ success: true });
        });

        app.post('/logout', (req, res) => {
            res.clearCookie('token', { maxAge: 0 }).send({ success: true });
        });

        // --- PRODUCTS API ---
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

        app.post('/products', verifyToken, async (req, res) => {
            const product = req.body;
            const user = await usersCollection.findOne({ email: req.user.email });
            if (user?.status === 'suspended') return res.status(403).send({ message: 'Action forbidden for suspended users' });
            
            const result = await productsCollection.insertOne(product);
            res.send(result);
        });

        // --- USERS API (Admin) ---
        app.get('/users', verifyToken, async (req, res) => {
            const search = req.query.search || ""; 
            const query = { name: { $regex: search, $options: 'i' } };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        });

        app.patch('/users/suspend/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const { reason, feedback } = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: { 
                    status: 'suspended',
                    suspendReason: reason,
                    suspendFeedback: feedback 
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // --- ORDERS API ---
        app.post('/orders', verifyToken, async (req, res) => {
            const order = req.body;
            const user = await usersCollection.findOne({ email: req.user.email });
            if (user?.status === 'suspended') return res.status(403).send({ message: 'Forbidden' });
            
            const result = await ordersCollection.insertOne(order);
            res.send(result);
        });

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
                },
                $set: { currentStatus: status }
            };
            const result = await ordersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        console.log("Successfully connected to MongoDB!");
    } catch (error) {
        console.error("MongoDB Connection Error:", error);
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Garments Tracker Server is Running');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});