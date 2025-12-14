const serverless = require('serverless-http');
const app = require('./server'); // adjust path if needed

module.exports = serverless(app);
