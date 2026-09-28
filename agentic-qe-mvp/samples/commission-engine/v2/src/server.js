'use strict';
const { createApp } = require('./app');
const R = require('./rules');

const port = Number(process.env.PORT || 4200);
createApp().listen(port, () => console.log(`Aurora commission engine (${R.BUILD}) on http://localhost:${port}`));
