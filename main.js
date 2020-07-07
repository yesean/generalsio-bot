require('dotenv').config();
const Player = require('./Player');

// only for the first time
// set username for bot
// socket.emit("set_username", user_id, username);

// main.js
const io = require('socket.io-client');
const socket = io('http://botws.generals.io');

// define user id and username
const user_id = process.env.USER_ID;
const username = process.env.USERNAME;
const custom_game_id = process.env.GAME_ID;

socket.on('disconnect', () => {
  console.error('Disconnected from server.');
  process.exit(1);
});

socket.on('connect', () => {
  console.log('Connected to server.');
  socket.emit('join_private', custom_game_id, user_id);
  socket.emit('set_force_start', custom_game_id, true);
  console.log(
    `Joined custom game at http://bot.generals.io/games/${encodeURIComponent(
      custom_game_id
    )}`
  );
});

// game data
let player;

socket.on('game_start', (data) => {
  player = new Player(socket, data.playerIndex);
  let replay_url = `http://bot.generals.io/replays/${encodeURIComponent(
    data.replay_id
  )}`;
  console.log(
    `Game starting! The replay will be available after the game at ${replay_url}`
  );
});

socket.on('game_update', (data) => {
  console.log(`on turn ${data.turn}`);
  player.play(data);
});

leaveGame = () => {
  socket.emit('leave_game');
  console.log('left game');
  socket.disconnect();
};

socket.on('game_lost', (data) => {
  leaveGame();
  console.log(`defeated by ${data.killer}`);
});
socket.on('game_won', (data) => {
  leaveGame();
  console.log(`congrats on winning!`);
});
