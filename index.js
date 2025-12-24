/* ==================== IMPORTS ==================== */
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { MongoClient, ObjectId } = require('mongodb');
const serverless = require('serverless-http');
require('dotenv').config();

/* ==================== APP SETUP ==================== */
const app = express();

// Middleware
app.use(cors({ origin: ['https://zesty-treacle-71cc0b.netlify.app', 'http://localhost:3000'], credentials: true }));
app.use(express.json());
app.use(cookieParser());

/* ==================== DATABASE ==================== */
const client = new MongoClient(process.env.DB_URI);
let usersCollection, productsCollection, ordersCollection;

async function connectDB() {
  await client.connect();
  const db = client.db('garmentsTracker');
  usersCollection = db.collection('users');
  productsCollection = db.collection('products');
  ordersCollection = db.collection('orders');
  console.log('✅ MongoDB Connected');
}
connectDB().catch(err => console.error('❌ MongoDB connection error:', err));

/* ==================== JWT MIDDLEWARE ==================== */
const verifyToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

/* ==================== AUTH ROUTES ==================== */
// Register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const exists = await usersCollection.findOne({ email });
    if (exists) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await usersCollection.insertOne({ name, email, password: hashedPassword, role, status: 'active' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await usersCollection.findOne({ email: email.trim() });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    if (user.status !== 'active') return res.status(403).json({ message: 'User inactive' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
  res.json({ success: true });
});

/* ==================== PRODUCTS ROUTES ==================== */
// Home Products
app.get('/api/home-products', async (req, res) => {
  try {
    const products = await productsCollection.find({ showOnHome: true }).limit(6).toArray();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// All Products
app.get('/api/all-products', async (req, res) => {
  try {
    const products = await productsCollection.find().toArray();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// Single Product
app.get('/api/product/:id', async (req, res) => {
  try {
    const product = await productsCollection.findOne({ _id: new ObjectId(req.params.id) });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch product' });
  }
});

/* ==================== MANAGER CRUD ==================== */
// Add Product
app.post('/api/products', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
  try {
    const result = await productsCollection.insertOne(req.body);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Product
app.put('/api/products/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
  try {
    const result = await productsCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: req.body });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Product
app.delete('/api/products/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).json({ message: 'Forbidden' });
  try {
    const result = await productsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ==================== ORDERS ROUTES ==================== */
// Book Product
app.post('/api/book-product', verifyToken, async (req, res) => {
  try {
    const order = { ...req.body, userEmail: req.user.email, status: 'Pending', createdAt: new Date() };
    const result = await ordersCollection.insertOne(order);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// My Orders
app.get('/api/my-orders', verifyToken, async (req, res) => {
  try {
    const orders = await ordersCollection.find({ userEmail: req.user.email }).sort({ createdAt: -1 }).toArray();
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ==================== ROOT ROUTE ==================== */
app.get('/api', (req, res) => res.json({ message: 'Garments Tracker Server Running' }));

/* ==================== EXPORT FOR VERCEL ==================== */
module.exports = serverless(app);
