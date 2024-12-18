const express = require('express');
const router = express.Router();

router.post('/test-message', (req, res) => {
  const { message } = req.body;
  console.log('Received message from front end:', message);
  res.status(200).send({ success: true, message: 'Message received successfully' });
});

module.exports = router;
