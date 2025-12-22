const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

/* ---------------- MIDDLEWARE ---------------- */
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

/* ---------------- JWT VERIFICATION ---------------- */
const verifyToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // contains email & role
    next();
  } catch {
    res.status(401).send({ message: 'Invalid token' });
  }
};

/* ---------------- DATABASE ---------------- */
const client = new MongoClient(process.env.DB_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  try {
    await client.connect();
    const db = client.db('garmentsTracker');
    const usersCollection = db.collection('users');
    const productsCollection = db.collection('products');
    const ordersCollection = db.collection('orders');

    console.log('MongoDB Connected');

    /* ---------------- REGISTER ---------------- */
    app.post('/register', async (req, res) => {
      const { name, email, password, role } = req.body;
      const exists = await usersCollection.findOne({ email });
      if (exists) return res.status(400).send({ message: 'User already exists' });

      const hashedPassword = await bcrypt.hash(password, 10);
      await usersCollection.insertOne({ name, email, password: hashedPassword, role, status: 'active' });
      res.send({ success: true });
    });

    /* ---------------- LOGIN ---------------- */
    /* ---------------- LOGIN ---------------- */
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await usersCollection.findOne({ email: email.trim() });
    if (!user) return res.status(401).send({ message: 'Invalid credentials' });

    // Optional: block inactive/suspended users
    if (user.status !== 'active') {
      return res.status(403).send({ message: 'User is suspended or inactive' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).send({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { email: user.email, role: user.role, id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'lax' });

    res.send({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Server error' });
  }
});
    /* ---------------- LOGOUT ---------------- */
    app.post('/logout', (req, res) => {
      res.clearCookie('token');
      res.send({ success: true });
    });

    /* ---------------- PRODUCTS ---------------- */
    // Public products
    app.get('/home-products', async (req, res) => {
      const result = await productsCollection.find({ showOnHome: true }).limit(6).toArray();
      res.send(result);
    });

    app.get('/all-products', async (req, res) => {
      const products = await productsCollection.find().toArray();
      res.send(products);
    });

    app.get('/product/:id', async (req, res) => {
      const product = await productsCollection.findOne({ _id: new ObjectId(req.params.id) });
      res.send(product);
    });

    // Manager CRUD
    app.post('/products', verifyToken, async (req, res) => {
      if (req.user.role !== 'manager') return res.status(403).send({ message: 'Forbidden' });
      const result = await productsCollection.insertOne(req.body);
      res.send(result);
    });

    app.put('/products/:id', verifyToken, async (req, res) => {
      if (req.user.role !== 'manager') return res.status(403).send({ message: 'Forbidden' });
      const result = await productsCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: req.body });
      res.send(result);
    });

    app.delete('/products/:id', verifyToken, async (req, res) => {
      if (req.user.role !== 'manager') return res.status(403).send({ message: 'Forbidden' });
      const result = await productsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    // Admin view all products
    app.get('/admin/products', verifyToken, async (req, res) => {
      if (req.user.role !== 'admin') return res.status(403).send({ message: 'Forbidden' });
      const products = await productsCollection.find().toArray();
      res.send(products);
    });

    /* ---------------- ORDERS ---------------- */
    app.post('/book-product', verifyToken, async (req, res) => {
      const order = { ...req.body, userEmail: req.user.email, status: 'Pending', createdAt: new Date() };
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    // Buyer orders
    app.get('/my-orders', verifyToken, async (req, res) => {
      const orders = await ordersCollection.find({ userEmail: req.user.email }).sort({ createdAt: -1 }).toArray();
      res.send(orders);
    });

    // Manager pending orders
    app.get('/orders/pending', verifyToken, async (req, res) => {
      if (req.user.role !== 'manager') return res.status(403).send({ message: 'Forbidden' });
      const orders = await ordersCollection.find({ status: 'Pending' }).toArray();
      res.send(orders);
    });

    app.put('/orders/:id/approve', verifyToken, async (req, res) => {
      if (req.user.role !== 'manager') return res.status(403).send({ message: 'Forbidden' });
      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: 'Approved', approvedAt: new Date() } }
      );
      res.send(result);
    });

    app.put('/orders/:id/reject', verifyToken, async (req, res) => {
      if (req.user.role !== 'manager') return res.status(403).send({ message: 'Forbidden' });
      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: 'Rejected' } }
      );
      res.send(result);
    });

    // Manager: Add tracking
    app.post('/orders/:id/tracking', verifyToken, async (req, res) => {
      if (req.user.role !== 'manager') return res.status(403).send({ message: 'Forbidden' });
      const trackingUpdate = req.body;
      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $push: { tracking: trackingUpdate } }
      );
      res.send(result);
    });

    // Get tracking info
    app.get('/orders/:id/tracking', verifyToken, async (req, res) => {
      const order = await ordersCollection.findOne({ _id: new ObjectId(req.params.id) });
      res.send(order.tracking || []);
    });

    // Admin: All orders
    app.get('/orders/all', verifyToken, async (req, res) => {
      if (req.user.role !== 'admin') return res.status(403).send({ message: 'Forbidden' });
      const orders = await ordersCollection.find().sort({ createdAt: -1 }).toArray();
      res.send(orders);
    });

    /* ---------------- USERS ---------------- */
    // Admin manage users
    app.get('/admin/users', verifyToken, async (req, res) => {
      if (req.user.role !== 'admin') return res.status(403).send({ message: 'Forbidden' });
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    app.put('/admin/users/:id', verifyToken, async (req, res) => {
      if (req.user.role !== 'admin') return res.status(403).send({ message: 'Forbidden' });
      const { role, status } = req.body;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { role, status } }
      );
      res.send(result);
    });

  } finally {
    // Optional: await client.close();
  }
}

run().catch(console.dir);

app.get('/', (req, res) => res.send('Garments Tracker Server Running'));

app.listen(port, () => console.log(`Server running on port ${port}`));
