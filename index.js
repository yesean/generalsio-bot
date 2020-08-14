const Bot = require('./Bot.js');
require('dotenv').config();

const monkey =
    new Bot(process.env.MONKEY_USER, process.env.MONKEY_USER,
            process.argv[2] || process.env.GAME_ID, process.env.MONKEY_TEAM);

const gorilla =
    new Bot(process.env.GORILLA_USER, process.env.GORILLA_USER,
            process.argv[2] || process.env.GAME_ID, process.env.GORILLA_TEAM);

const chimp =
    new Bot(process.env.CHIMP_USER, process.env.CHIMP_USER,
            process.argv[2] || process.env.GAME_ID, process.env.CHIMP_TEAM);

const baboon =
    new Bot(process.env.BABOON_USER, process.env.BABOON_USER,
            process.argv[2] || process.env.GAME_ID, process.env.BABOON_TEAM);
