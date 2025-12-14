require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/error');

connectDB();

const app = express();
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admins')); // admin management (only admin)
app.use('/api/shops', require('./routes/shops'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/rotas', require('./routes/rotas'));
app.use('/api/punchings', require('./routes/punchings'));
app.use('/api/payouts', require('./routes/payouts'));

// health
app.get('/', (req, res) => res.send({ ok: true }));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
