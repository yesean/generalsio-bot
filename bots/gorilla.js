const Bot = require('./../Bot.js');
require('dotenv').config();

const gorilla = new Bot(
  process.env.GORILLA,
  process.env.GORILLA,
  process.argv[2] || process.env.GAME_ID,
  process.env.GORILLA_TEAM
);
