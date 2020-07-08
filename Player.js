const GameState = require('./GameState');
const Spread = require('./Spread');
const Target = require('./Target');

class Player {
  constructor(socket, playerIndex) {
    this.socket = socket;
    this.playerIndex = playerIndex;
    this.game = new GameState(this.playerIndex);
    this.target = new Target();
    this.headIndex = -1;
    this.headSize = 0;
    this.currPath = new Map();
  }

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
    this.currPath.clear();
    this.currPath.set(this.headIndex, 1);
    console.log(
      `resetting to headIndex ${this.headIndex}, headSize ${this.headSize}`
    );
    return this.headIndex;
  };

  play = (data) => {
    // update game state
    this.game.update(data);
    this.headSize = this.game.armies[this.headIndex]; // update headSize
    console.log(`headIndex: ${this.headIndex}, headSize: ${this.headSize}`);

    // determine next index
    let nextIndex;
    if (this.target.hasTarget(this, this.game)) {
      // targeting
      nextIndex = this.target.getNextIndex(this, this.game);
    } else {
      // spreading
      // reset head if head becomes too small or swallowed
      if (
        this.game.armies[this.headIndex] < this.game.avgTileSize ||
        this.game.terrain[this.headIndex] !== this.playerIndex
      ) {
        this.resetHead();
      }
      nextIndex = Spread.getNextIndex(this, this.game);

      // update currpath
      if (this.currPath.has(nextIndex)) {
        this.currPath.set(nextIndex, this.currPath.get(nextIndex) + 1);
      } else {
        this.currPath.set(nextIndex, 1);
      }
    }

    // attack
    console.log(`attacking index ${nextIndex}`);
    this.socket.emit('attack', this.headIndex, nextIndex);
    this.headIndex = nextIndex; // update headIndex
    console.log();
  };
}

module.exports = Player;
