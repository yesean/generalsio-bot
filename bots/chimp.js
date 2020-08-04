const Bot = require('./../Bot.js');
require('dotenv').config();

const chimp = new Bot(
  process.env.CHIMP,
  process.env.CHIMP,
  process.env.GAME_ID,
  process.env.CHIMP_TEAM
);
