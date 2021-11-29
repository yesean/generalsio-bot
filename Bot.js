const Player = require('./Player');
const {performance} = require('perf_hooks');
const io = require('socket.io-client');

let botCount = 0;
class Bot {
  constructor(user_id, username, game_id, team_id) {
    this.socket = io('http://botws.generals.io');
    this.player = null;
    this.team = new Set();
    this.setTeam = null;
    this.setForceStart = null;

    this.socket.on('disconnect', () => {
      this.socket.connect();
      /*
      console.error('Disconnected from server.');
      if (--botCount === 0) {
        process.exit(1);
      }
      */
    });

    this.socket.on('connect', () => {
      console.log('Connected to server.');
      botCount++;
      this.socket.emit('set_username', user_id, username);
      switch (game_id) {
      case '1v1':
        this.socket.emit('join_1v1', user_id);
        console.log('Joined 1v1');
        break;
      case 'ffa':
        this.socket.emit('play', user_id);
        console.log('Joined FFA');
        break;
      default:
        this.socket.emit('join_private', game_id, user_id);
        console.log(`Joined custom game at http://bot.generals.io/games/${
            encodeURIComponent(game_id)}`);
        if (team_id >= 1 && team_id <= 8) {
          this.setTeam = setInterval(
              () => { this.socket.emit('set_custom_team', game_id, team_id); },
              1000);
        }
      }

      setTimeout(() => {
        this.setForceStart = setInterval(
            () => this.socket.emit('set_force_start', game_id, true), 1000);
      }, 5000);
    });

    this.socket.on('game_start', (data) => {
      clearInterval(this.setTeam);
      clearInterval(this.setForceStart);

      this.team.add(data.playerIndex);
      if (data.teams) {
        const teamId = data.teams[data.playerIndex];
        data.teams.forEach((t, playerIndex) => {
          if (t === teamId) {
            this.team.add(playerIndex);
          }
        });
      }
      this.player = new Player(data.playerIndex, this.team);
      let replay_url = `http://bot.generals.io/replays/${
          encodeURIComponent(data.replay_id)}`;
      console.log(
          `Game starting! The replay will be available after the game at ${
              replay_url}`);
    });

    this.socket.on('game_update', (data) => {
      const startOfTurn = performance.now();

      console.log('turn', data.turn);
      const [start, end] = this.player.play(data);
      this.socket.emit('attack', start, end);

      const endOfTurn = performance.now();
      console.log('turn took', endOfTurn - startOfTurn, 'ms to compute');
      console.log();
    });

    this.socket.on('game_lost', (data) => {
      console.log(`defeated by player ${data.killer}`);
      this.leaveGame();
    });

    this.socket.on('game_won', (data) => {
      console.log(`congrats on winning!`);
      this.leaveGame();
    });
  }

  leaveGame = () => {
    console.log('skipped', this.player.skippedTurns, 'turns');
    this.socket.emit('leave_game');
    this.socket.disconnect();
  };
}

module.exports = Bot;
