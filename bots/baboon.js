const Bot = require('./../Bot.js');
require('dotenv').config();

const baboon = new Bot(
  process.env.BABOON,
  process.env.BABOON,
  process.argv[2] || process.env.GAME_ID,
  process.env.BABOON_TEAM
);
