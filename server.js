const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const LINKS_FILE = path.join(__dirname, 'links.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readLinks() {
  try {
    return JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeLinks(data) {
  fs.writeFileSync(LINKS_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/links', (req, res) => {
  res.json(readLinks());
});

app.post('/api/links', (req, res) => {
  const links = readLinks();
  const newLink = {
    id: Date.now().toString(),
    name: req.body.name,
    url: req.body.url,
    description: req.body.description || '',
    category: req.body.category || 'General',
    icon: req.body.icon || 'ti-link'
  };
  links.push(newLink);
  writeLinks(links);
  res.json(newLink);
});

app.put('/api/links/:id', (req, res) => {
  let links = readLinks();
  const idx = links.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  links[idx] = { ...links[idx], ...req.body };
  writeLinks(links);
  res.json(links[idx]);
});

app.delete('/api/links/:id', (req, res) => {
  let links = readLinks();
  links = links.filter(l => l.id !== req.params.id);
  writeLinks(links);
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => console.log(`Broadway Dashboard running on port ${PORT}`));
