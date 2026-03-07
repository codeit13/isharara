// api/index.js
// This file imports your built Express app and serves it as a Vercel function
const app = require('../dist/index.cjs');

module.exports = app;