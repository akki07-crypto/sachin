const http = require('http');
const fs = require('fs');
const path = require('path');

let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3030;
const PUBLIC_DIR = __dirname;
const DATABASE_FILE = path.join(__dirname, 'contacts.json');

// MIME types mapper
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Initialize database file if it doesn't exist
if (!fs.existsSync(DATABASE_FILE)) {
    fs.writeFileSync(DATABASE_FILE, JSON.stringify([], null, 2), 'utf8');
}

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // Enable CORS for testing
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // 1. API: POST /api/contact (Receive and save contact inquiries)
    if (req.method === 'POST' && req.url === '/api/contact') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const contactData = JSON.parse(body);
                
                // Form validation checks
                if (!contactData.name || !contactData.email || !contactData.phone || !contactData.message) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'All fields are required' }));
                    return;
                }

                // Add metadata
                contactData.id = Date.now().toString();
                contactData.date = new Date().toISOString();

                // Read existing database
                fs.readFile(DATABASE_FILE, 'utf8', (err, data) => {
                    let contacts = [];
                    if (!err && data) {
                        try {
                            contacts = JSON.parse(data);
                        } catch (e) {
                            contacts = [];
                        }
                    }

                    contacts.push(contactData);

                    // Write updated list
                    fs.writeFile(DATABASE_FILE, JSON.stringify(contacts, null, 2), 'utf8', (writeErr) => {
                        if (writeErr) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Failed to write query data' }));
                            return;
                        }

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: 'Message saved successfully!' }));
                    });
                });

            } catch (parseError) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON body structure' }));
            }
        });
        return;
    }

    // 2. API: GET /api/contacts (Fetch all contact queries for Admin Dashboard)
    if (req.method === 'GET' && req.url === '/api/contacts') {
        fs.readFile(DATABASE_FILE, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Could not load queries database' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        });
        return;
    }

    // 3. STATIC FILE SERVER: Serve website frontend files
    let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);

    // Prevent directory traversal attacks
    const relative = path.relative(PUBLIC_DIR, filePath);
    if (relative && relative.startsWith('..') && !path.isAbsolute(relative)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Access Forbidden');
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // Serve index.html as fallback for router or respond with 404
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 - File Not Found</h1><p>The requested URL was not found on this server.</p>');
            return;
        }

        fs.readFile(filePath, (readErr, content) => {
            if (readErr) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        });
    });
});

function startServer(p) {
    server.listen(p, () => {
        console.log(`Server is running at http://localhost:${p}`);
    });
}

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is in use, trying next port...`);
        port++;
        startServer(port);
    } else {
        console.error(err);
    }
});

startServer(port);
