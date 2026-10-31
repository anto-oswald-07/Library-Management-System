/**
 * LibTrack — Express HTTP Server & REST API Router
 * Serves static website assets and exposes REST endpoints for data structures.
 */

const express = require('express');
const path = require('path');
const Library = require('./library');

const app = express();
const library = new Library();

// JSON Body Parser
app.use(express.json());

// Request & Error Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalJson = res.json;

  res.json = function(body) {
    const duration = Date.now() - start;
    if (res.statusCode >= 400) {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} | ${JSON.stringify(body)} (${duration}ms)`);
    } else if (req.originalUrl.startsWith('/api')) {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
    return originalJson.call(this, body);
  };

  next();
});

// CORS Headers for API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// ============================================================================
// REST API Routes
// ============================================================================

// 1. Book Catalog API
app.get('/api/books', (req, res) => {
  res.json(library.getBooks());
});

app.get('/api/books/:id', (req, res) => {
  const book = library.getBook(req.params.id);
  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }
  res.json(book);
});

app.post('/api/books', (req, res) => {
  const result = library.addBook(req.body);
  if (!result.success) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  res.status(201).json({ message: 'Book added successfully', id: result.id });
});

app.delete('/api/books/:id', (req, res) => {
  const result = library.removeBook(req.params.id);
  if (!result.success) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  res.json({ message: 'Book deleted successfully', id: result.id });
});

// 2. Stats API
app.get('/api/stats', (req, res) => {
  res.json(library.getStats());
});

// 3. Borrowing & Returns API
app.post('/api/borrow', (req, res) => {
  const { bookId, studentId, studentName } = req.body || {};
  const result = library.borrowBook(bookId, studentId, studentName);
  if (!result.success) {
    return res.status(result.status || 400).json({
      error: result.error,
      canQueue: Boolean(result.canQueue)
    });
  }
  res.json({ message: result.message });
});

const handleReturn = (req, res) => {
  const { bookId, studentName, studentId } = req.body || {};
  const studentInfo = studentId || studentName;
  const result = library.returnBook(bookId, studentInfo);
  if (!result.success) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  res.json({ message: result.message });
};
app.post('/api/return', handleReturn);
app.post('/api/return/', handleReturn);

// 4. FIFO Waiting Queue API
app.get('/api/queue', (req, res) => {
  res.json(library.getQueue());
});

app.post('/api/queue', (req, res) => {
  const result = library.enqueueRequest(req.body || {});
  res.status(201).json({ message: result.message });
});

const handleServe = (req, res) => {
  const result = library.serveNextRequest();
  if (!result.success) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  res.json({
    message: result.message,
    studentName: result.studentName,
    bookId: result.bookId
  });
};
app.post('/api/queue/serve', handleServe);
app.post('/api/queue/serve/', handleServe);
app.post('/api/serve', handleServe);
app.post('/api/serve/', handleServe);

// 5. LIFO Returns Stack API
app.get('/api/returns', (req, res) => {
  res.json(library.getReturns());
});

// 6. Visual Data Structure Console API
app.get('/api/structures', (req, res) => {
  res.json(library.getStructures());
});

// ============================================================================
// Static Assets
// ============================================================================
const rootDir = path.join(__dirname, '..');
app.use(express.static(rootDir));

app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

// Fallback 404 for unknown endpoints
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint or file not found' });
  }
  res.status(404).sendFile(path.join(rootDir, 'index.html'));
});

// Start Server if invoked directly
if (require.main === module) {
  const port = parseInt(process.argv[2] || process.env.PORT, 10) || 8080;
  app.listen(port, () => {
    console.log('========================================================');
    console.log(` LibTrack Node.js & Express Backend running on http://localhost:${port}`);
    console.log(' Serving Static Website and REST API endpoints');
    console.log('========================================================');
  });
}

module.exports = { app, library };

