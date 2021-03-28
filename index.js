const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).argv;

const Bot = require('./Bot.js');
require('dotenv').config();

const bots = [
  '[Bot] monkeybean',
  '[Bot] gorillabean',
  '[Bot] chimpbean',
  '[Bot] baboonbean',
];

if (argv.count === undefined) {
  console.error('you must specify a bot count between 1-4 (eg --count 3)');
  return;
}
if (argv.count <= 0 || argv.count > 4) {
  console.error('bot count must be between 1-4');
  return;
}

bots.slice(0, argv.count).forEach((bot, i) => {
  new Bot(bot, bot, argv.room || 'ffa', i + 1);
});
