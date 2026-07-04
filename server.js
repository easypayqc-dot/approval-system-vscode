'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const approvalRoutes = require('./src/routes/approval.routes');
const employeeRoutes = require('./src/routes/employee.routes');
const reportRoutes = require('./src/routes/report.routes');
const shopRoutes = require('./src/routes/shop.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');

const app = express();
const PORT = process.env.PORT || 3100;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static('public'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'Approval System VS Code', phase: 'approval-dashboard-connected-v1', time: new Date().toISOString() });
});

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/shops', shopRoutes);

app.use((_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, HOST, () => {
  console.log(`Approval System running at http://${HOST}:${PORT}`);
});
