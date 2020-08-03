require('dotenv').config();
const Player = require('./Player');
const { performance } = require('perf_hooks');

// only for the first time
// set username for bot
// socket.emit("set_username", user_id, username);

// main.js
const io = require('socket.io-client');
const socket = io('http://botws.generals.io');

// define user id and username
const user_id = process.env.GORILLA;
const username = process.env.GORILLA;
const custom_game_id = process.env.GAME_ID;
const team_id = process.env.TEAM_ONE;

socket.on('disconnect', () => {
  console.error('Disconnected from server.');
  process.exit(1);
  // setTimeout(() => {
  //   socket.connect();
  // }, 10000);
});

socket.on('connect', () => {
  console.log('Connected to server.');
  socket.emit('join_private', custom_game_id, user_id);
  console.log(
    `Joined custom game at http://bot.generals.io/games/${encodeURIComponent(
      custom_game_id
    )}`
  );

  setInterval(() => {
    socket.emit('set_custom_team', custom_game_id, team_id);
  }, 1000);
  setTimeout(() => {
    setInterval(() => {
      socket.emit('set_force_start', custom_game_id, true);
    }, 1000);
  }, 5000);
});

// game data
let player;
let team = new Set();

socket.on('game_start', (data) => {
  const teamId = data.teams[data.playerIndex];
  data.teams.forEach((t, playerIndex) => {
    if (t === teamId) {
      team.add(playerIndex);
    }
  });
  player = new Player(socket, data.playerIndex, team);
  let replay_url = `http://bot.generals.io/replays/${encodeURIComponent(
    data.replay_id
  )}`;
  console.log(
    `Game starting! The replay will be available after the game at ${replay_url}`
  );
});

socket.on('game_update', (data) => {
  const startOfTurn = performance.now();

  console.log('turn', data.turn);
  const [start, end] = player.play(data);
  socket.emit('attack', start, end);

  const endOfTurn = performance.now();
  console.log('turn took', endOfTurn - startOfTurn, 'ms to compute');
  console.log();
});

leaveGame = () => {
  socket.emit('leave_game');
  console.log('left game');
  socket.disconnect();
};

socket.on('game_lost', (data) => {
  console.log(`defeated by player ${data.killer}`);
  leaveGame();
});
socket.on('game_won', (data) => {
  console.log(`congrats on winning!`);
  leaveGame();
});
