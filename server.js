require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const port = process.env.PORT || 4000;
const dbFile = process.env.DATABASE_FILE || './mpv.sqlite';
const db = new sqlite3.Database(dbFile);
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname,'uploads')));

// helper: run SQL with promise
const run = (sql, params=[]) => new Promise((res, rej) => db.run(sql, params, function(err){ if(err) rej(err); else res(this); }));
const all = (sql, params=[]) => new Promise((res, rej) => db.all(sql, params, (err, rows) => err?rej(err):res(rows)));
const get = (sql, params=[]) => new Promise((res, rej) => db.get(sql, params, (err, row) => err?rej(err):res(row)));

// Auth: signup
app.post('/api/signup', async (req,res)=>{
  const { name, email, password, role='client' } = req.body;
  if(!email || !password) return res.status(400).json({error:'Email and password required'});
  const hashed = await bcrypt.hash(password, 10);
  try{
    const r = await run('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)',[name,email,hashed,role]);
    const user = await get('SELECT id,name,email,role FROM users WHERE id=?',[r.lastID]);
    const token = jwt.sign({id:user.id,role:user.role}, process.env.JWT_SECRET || 'secret', {expiresIn:'7d'});
    res.json({user, token});
  }catch(e){ res.status(400).json({error:e.message}); }
});

// Auth: login
app.post('/api/login', async (req,res)=>{
  const { email, password } = req.body;
  if(!email || !password) return res.status(400).json({error:'Email and password required'});
  try{
    const user = await get('SELECT * FROM users WHERE email=?',[email]);
    if(!user) return res.status(401).json({error:'Invalid credentials'});
    const ok = await bcrypt.compare(password, user.password);
    if(!ok) return res.status(401).json({error:'Invalid credentials'});
    const token = jwt.sign({id:user.id,role:user.role}, process.env.JWT_SECRET || 'secret', {expiresIn:'7d'});
    res.json({user:{id:user.id,name:user.name,email:user.email,role:user.role}, token});
  }catch(e){ res.status(500).json({error:e.message}); }
});

// Simple middleware to verify token
function auth(req,res,next){
  const authh = req.headers.authorization;
  if(!authh) return res.status(401).json({error:'No token'});
  const token = authh.split(' ')[1];
  try{ const data = jwt.verify(token, process.env.JWT_SECRET || 'secret'); req.user = data; next(); }catch(e){ res.status(401).json({error:'Invalid token'}); }
}

// Orders endpoints
app.get('/api/orders', async (req,res)=>{
  const rows = await all('SELECT o.*, s.title as service FROM orders o LEFT JOIN services s ON s.id=o.service_id ORDER BY o.created_at DESC');
  res.json(rows);
});
app.post('/api/orders', auth, async (req,res)=>{
  const { service_id, artist_id, price } = req.body;
  const client_id = req.user.id;
  const order_id = 'ORD-'+Date.now();
  const r = await run('INSERT INTO orders (order_id, service_id, client_id, artist_id, price, status) VALUES (?,?,?,?,?,?)',[order_id, service_id, client_id, artist_id, price, 'Pending']);
  const row = await get('SELECT * FROM orders WHERE id=?',[r.lastID]);
  res.json(row);
});
app.patch('/api/orders/:id', auth, async (req,res)=>{
  const id = req.params.id; const { status } = req.body;
  await run('UPDATE orders SET status=? WHERE id=?',[status,id]);
  const row = await get('SELECT * FROM orders WHERE id=?',[id]); res.json(row);
});

// Payments endpoints (mock)
app.get('/api/payments', auth, async (req,res)=>{
  const rows = await all('SELECT * FROM payments ORDER BY created_at DESC'); res.json(rows);
});
app.post('/api/payments', auth, async (req,res)=>{
  const { amount, type } = req.body; const txn = 'TXN-'+Date.now();
  const r = await run('INSERT INTO payments (txn_id, user_id, amount, type, status) VALUES (?,?,?,?,?)',[txn, req.user.id, amount, type, 'Completed']);
  const row = await get('SELECT * FROM payments WHERE id=?',[r.lastID]); res.json(row);
});

// Artists / Services endpoints
app.get('/api/artists', async (req,res)=>{ const rows = await all('SELECT a.*, u.name as name FROM artists a LEFT JOIN users u ON u.id=a.user_id'); res.json(rows); });
app.get('/api/services', async (req,res)=>{ const rows = await all('SELECT * FROM services'); res.json(rows); });

// File upload (e.g., portfolio or audio)
app.post('/api/upload', auth, upload.single('file'), (req,res)=>{
  if(!req.file) return res.status(400).json({error:'No file'});
  res.json({url:`/uploads/${path.basename(req.file.path)}`});
});

// Start server
app.listen(port, ()=> console.log('MPV Backend running on', port));
