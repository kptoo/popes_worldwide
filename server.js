const express = require('express');
const path = require('path');
const fs = require('fs');
const parse = require('csv-parse/sync'); // CSV parser

const app = express();

// Load CSV Data
function loadCSVData() {
  const churchFiles = [
    { file: 'data/popes.csv', key: 'popes' },
    { file: 'data/saints.csv', key: 'saints' },
    { file: 'data/miracles.csv', key: 'miracles' }
  ];

  let popes = [], saints = [], miracles = [];

  churchFiles.forEach(({ file, key }) => {
    const rawCsv = fs.readFileSync(path.join(__dirname, file), 'utf8');
    const records = parse.parse(rawCsv, {
      columns: true,
      skip_empty_lines: true
    });

    if (key === 'popes') popes = records;
    if (key === 'saints') saints = records;
    if (key === 'miracles') miracles = records;
  });

  console.log('✅ Total Popes loaded:', popes.length);
  console.log('✅ Total Saints loaded:', saints.length);
  console.log('✅ Total Miracles loaded:', miracles.length);

  return { popes, saints, miracles };
}

const CSVData = loadCSVData();

// Enable CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Serve static files if needed
app.use(express.static(__dirname));

// Routes
app.get('/api/church-data', (req, res) => {
  try {
    res.json(CSVData);
  } catch (error) {
    console.error('Error loading data:', error);
    res.status(500).json({ error: 'Failed to load church data' });
  }
});

// Filter saints
app.get('/filter-saints', (req, res) => {
  const name = (req.query.name || '').toLowerCase();
  const country = (req.query.country || '').toLowerCase();
  const born = (req.query.born || '').toLowerCase();

  let filtered = CSVData.saints;

  filtered = filtered.filter(saint => {
    return (
      (!name || (saint.Name || '').toLowerCase().includes(name)) ||
      (!country || (saint.Country || '').toLowerCase().includes(country)) ||
      (!born || (saint['Born Location'] || '').toLowerCase().includes(born))
    );
  });

  const limit = 100;
  const page = parseInt(req.query.page) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedData = filtered.slice(startIndex, startIndex + limit);

  res.json({
    saints: paginatedData,
    pagination: {
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / limit),
      currentPage: page,
      limit
    }
  });
});

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
