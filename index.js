const express = require('express');
const http = require('http');
require('dotenv').config();
const cors = require('cors');
const userController = require('./controllers/usersController');
const taskController = require('./controllers/taskController');
const projectsController = require('./controllers/projectsController');
const ratingsController = require('./controllers/ratingsController');

const airdrops = require('./routes/airdrops');
const avatars = require('./routes/avatars');
const testRoutes = require('./routes/test');

const app = express();
const server = http.createServer(app);

// Configure CORS
const corsOptions = {
  origin: ['https://bamboo-1.vercel.app', 'http://localhost:5173'],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api', taskController);
app.use('/api', userController);
app.use('/api', projectsController);
app.use('/api', ratingsController);
app.use('/api', airdrops);
app.use('/api', avatars);
app.use('/api', testRoutes);

app.get('/', (req, res) => {
  res.send('Node API');
});

// Start HTTP server on port 8000
server.listen(8000, () => {
  console.log('Server is running on port 8000');
});
