const path = require('path');
const express = require('express');

let router = express.Router();

router.use(express.static(path.join(__dirname, '../../frontend/build')));
router.get('/*', function (req, res) {
  res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
});

module.exports = router;
