require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureVaultStructure } = require('./src/utils/obsidian');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/students', require('./src/routes/students'));
app.use('/api/assignments', require('./src/routes/assignments'));
app.use('/api/assessments', require('./src/routes/assessments'));
app.use('/api/ai', require('./src/routes/ai'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  ensureVaultStructure();
  const aiStatus = process.env.ANTHROPIC_API_KEY ? '✅ AI enabled' : '⚠️  AI disabled (add ANTHROPIC_API_KEY to .env)';
  console.log(`\n🌾 Homeschool Manager running at http://localhost:${PORT}`);
  console.log(`📚 Obsidian vault syncing to: /Users/deborahsmith/Documents/collab/Homeschool`);
  console.log(`${aiStatus}\n`);
});
