const Bot = require('./../Bot.js');
require('dotenv').config();

const chimp = new Bot(
  process.env.CHIMP,
  process.env.CHIMP,
  process.argv[2] || process.env.GAME_ID,
  process.env.CHIMP_TEAM
);
