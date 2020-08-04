const Bot = require('./../Bot.js');
require('dotenv').config();

const monkey = new Bot(
  process.env.MONKEY,
  process.env.MONKEY,
  process.env.GAME_ID,
  process.env.MONKEY_TEAM
);
