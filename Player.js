const GameState = require('./GameState');
const Spread = require('./Spread');
const Target = require('./Target');

class Player {
  constructor(socket, playerIndex) {
    this.socket = socket;
    this.playerIndex = playerIndex;
    this.game = new GameState(this.playerIndex);
    this.spread = new Spread();
    this.target = new Target();
    this.headIndex = -1;
    this.headSize = 0;
  }

  // reset head to provided tile or largest
  resetHead = (index = -1) => {
    if (index !== -1) {
      this.headIndex = index;
    } else {
      this.headIndex = this.game.terrain.reduce((max, tile, index) => {
        if (tile === this.playerIndex && index !== this.headIndex) {
          if (max === -1) {
            return index;
          } else {
            return this.game.armies[index] > this.game.armies[max]
              ? index
              : max;
          }
        } else {
          return max;
        }
      }, -1);
    }
    this.headSize = this.game.armies[this.headIndex];
    console.log(
      `resetting to headIndex ${this.headIndex}, headSize ${this.headSize}`
    );
  };

  // play one turn
  play = (data) => {
    // update game state
    this.game.update(data);
    this.headSize = this.game.armies[this.headIndex]; // update headSize
    console.log(`headIndex: ${this.headIndex}, headSize: ${this.headSize}`);

    // determine next index
    let start, end;
    if (this.target.hasTarget(this, this.game)) {
      // targeting
      this.spread.resetPath();
      [start, end] = this.target.getAttack(this, this.game);
    } else {
      // spreading
      [start, end] = this.spread.getAttack(this, this.game);
    }

    this.socket.emit('attack', start, end); // attack
    this.headIndex = end; // update headIndex
    console.log(`attacking index ${end}`);
    console.log();
  };
}

module.exports = Player;
