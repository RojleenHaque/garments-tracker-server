// index.js inside /api folder

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { MongoClient, ObjectId } = require('mongodb');
const serverless = require('serverless-http');
require('dotenv').config();

const app = express();

// ----------------------
// Middleware
// ----------------------
const allowedOrigins = [
  'http://localhost:3000',
  'https://zesty-treacle-71cc0b.netlify.app', // your frontend URL
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow Postman or server-to-server
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS not allowed for this origin'), false);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// ----------------------
// MongoDB Connection
// ----------------------
const client = new MongoClient(process.env.DB_URI);
let usersCollection, productsCollection, ordersCollection;

async function connectDB() {
  await client.connect();
  const db = client.db('garmentsTracker');
  usersCollection = db.collection('users');
  productsCollection = db.collection('products');
  ordersCollection = db.collection('orders');
  console.log('MongoDB connected');
}
connectDB().catch(err => console.error('DB connection error:', err));

// ----------------------
// JWT Middleware
// ----------------------
const verifyToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// ----------------------
// Routes
// ----------------------

// Test
app.get('/api', (req, res) => res.json({ message: 'Server running' }));

// Auth
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (await usersCollection.findOne({ email })) return res.status(400).json({ message: 'User exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    await usersCollection.insertOne({ name, email, password: hashedPassword, role, status: 'active' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await usersCollection.findOne({ email: email.trim() });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (user.status !== 'active') return res.status(403).json({ message: 'Inactive user' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
  res.json({ success: true });
});

// Products
app.get('/api/all-products', async (req, res) => {
  try {
    const products = await productsCollection.find().toArray();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/product/:id', async (req, res) => {
  try {
    const product = await productsCollection.findOne({ _id: new ObjectId(req.params.id) });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Orders
app.post('/api/book-product', verifyToken, async (req, res) => {
  try {
    const order = { ...req.body, userEmail: req.user.email, status: 'Pending', createdAt: new Date() };
    const result = await ordersCollection.insertOne(order);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/my-orders', verifyToken, async (req, res) => {
  try {
    const orders = await ordersCollection.find({ userEmail: req.user.email }).sort({ createdAt: -1 }).toArray();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Root route
app.get('/', (req, res) => {
  res.send('Garments Tracker Server is running!');
});

// ----------------------
// Vercel serverless export
// ----------------------
module.exports = serverless(app);

