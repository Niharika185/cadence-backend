const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

const uri = process.env.MONGODB_URI || "mongodb://Niharika:Niharika185@ac-tflpbjv-shard-00-00.vio0hbn.mongodb.net:27017,ac-tflpbjv-shard-00-01.vio0hbn.mongodb.net:27017,ac-tflpbjv-shard-00-02.vio0hbn.mongodb.net:27017/?ssl=true&replicaSet=atlas-xql9it-shard-0&authSource=admin&appName=Cluster0";
const client = new MongoClient(uri);

async function connectDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB successfully");
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
  }
}
connectDB();

app.get('/', (req, res) => {
  res.send('Hello from Cadence');
});

// Quick risk score check (used for low-risk auto-approve path)
app.post('/verify-login', async (req, res) => {
  try {
    const { email, deviceKnown } = req.body;
    const riskScore = deviceKnown
      ? Math.floor(Math.random() * 15) + 3
      : Math.floor(Math.random() * 20) + 68;
    const decision = riskScore < 40 ? "allow" : "review";

    const db = client.db("cadence");
    const result = await db.collection("loginAttempts").insertOne({
      email, riskScore, decision, timestamp: new Date()
    });
    res.json({ riskScore, decision, id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Website creates a pending approval request (high-risk logins)
app.post('/login-attempt', async (req, res) => {
  try {
    const { email, deviceText, locationText, ipText, riskScore, photo, video } = req.body;
    const db = client.db("cadence");
    const result = await db.collection("approvalRequests").insertOne({
      email, deviceText, locationText, ipText, riskScore, photo, video,
      status: 'pending',
      decision: null,
      createdAt: new Date()
    });
    res.json({ id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Website periodically sends longer video clips while waiting for a decision
app.post('/update-video/:id', async (req, res) => {
  try {
    const { video } = req.body;
    const db = client.db("cadence");
    await db.collection("approvalRequests").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { video, videoUpdatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Phone app fetches past decisions to show as history
app.get('/history', async (req, res) => {
  try {
    const db = client.db("cadence");
    const history = await db.collection("approvalRequests")
      .find({ status: { $ne: 'pending' } })
      .sort({ respondedAt: -1 })
      .limit(50)
      .toArray();
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Phone app polls this to see new login attempts waiting for review
app.get('/pending', async (req, res) => {
  try {
    const db = client.db("cadence");
    const pending = await db.collection("approvalRequests")
      .find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Phone app submits its allow/deny decision
app.post('/respond/:id', async (req, res) => {
  try {
    const { decision } = req.body;
    const db = client.db("cadence");
    await db.collection("approvalRequests").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: decision === 'allow' ? 'approved' : 'denied', decision, respondedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Phone app deletes a single history entry
app.delete('/delete/:id', async (req, res) => {
  try {
    const db = client.db("cadence");
    await db.collection("approvalRequests").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Website polls this to find out what the phone decided
app.get('/status/:id', async (req, res) => {
  try {
    const db = client.db("cadence");
    const doc = await db.collection("approvalRequests").findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json({ status: doc.status, decision: doc.decision });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});