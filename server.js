const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

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

app.post('/verify-login', async (req, res) => {
  try {
    const { email, deviceKnown } = req.body;

    const riskScore = deviceKnown
      ? Math.floor(Math.random() * 15) + 3
      : Math.floor(Math.random() * 20) + 68;

    const decision = riskScore < 40 ? "allow" : "review";

    const db = client.db("cadence");
    const result = await db.collection("loginAttempts").insertOne({
      email,
      riskScore,
      decision,
      timestamp: new Date()
    });

    res.json({ riskScore, decision, id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});