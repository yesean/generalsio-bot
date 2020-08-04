const Player = require('./Player');
const { performance } = require('perf_hooks');
const io = require('socket.io-client');
const socket = io('http://botws.generals.io');

class Bot {
  constructor(user_id, username, custom_game_id, team_id) {
    this.setTeam = null;
    this.setForceStart = null;
    this.player = null;
    this.team = new Set();

    socket.on('disconnect', () => {
      console.error('Disconnected from server.');
      process.exit(1);
    });

    socket.on('connect', () => {
      console.log('Connected to server.');
      socket.emit('join_private', custom_game_id, user_id);
      console.log(
        `Joined custom game at http://bot.generals.io/games/${encodeURIComponent(
          custom_game_id
        )}`
      );

      this.setTeam = setInterval(() => {
        socket.emit('set_custom_team', custom_game_id, team_id);
      }, 1000);

      setTimeout(() => {
        this.setForceStart = setInterval(
          () => socket.emit('set_force_start', custom_game_id, true),
          1000
        );
      }, 5000);
    });

    socket.on('game_start', (data) => {
      clearInterval(this.setTeam);
      clearInterval(this.setForceStart);

      const teamId = data.teams[data.playerIndex];
      data.teams.forEach((t, playerIndex) => {
        if (t === teamId) {
          this.team.add(playerIndex);
        }
      });
      this.player = new Player(data.playerIndex, this.team);
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
      const [start, end] = this.player.play(data);
      socket.emit('attack', start, end);

      const endOfTurn = performance.now();
      console.log('turn took', endOfTurn - startOfTurn, 'ms to compute');
      console.log();
    });

    socket.on('game_lost', (data) => {
      console.log(`defeated by player ${data.killer}`);
      this.leaveGame();
    });

    socket.on('game_won', (data) => {
      console.log(`congrats on winning!`);
      this.leaveGame();
    });
  }
  leaveGame = () => {
    console.log('skipped', this.player.skippedTurns, 'turns');
    socket.emit('leave_game');
    console.log('left game');
    socket.disconnect();
  };
}

module.exports = Bot;
