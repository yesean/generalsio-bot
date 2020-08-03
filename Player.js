const GameState = require('./GameState');
const Spread = require('./Spread');
const Target = require('./Target');

class Player {
  constructor(socket, playerIndex, team) {
    this.socket = socket;
    this.playerIndex = playerIndex;
    this.team = team;
    this.game = new GameState(this.playerIndex);
    this.spread = new Spread();
    this.target = new Target();
    this.headIndex = -1;
    this.headSize = 0;
    this.prevMove = null;
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
    const [prevArmies, prevTerrain] = this.game.update(this, data);
    // skip turn if prev move isn't processed
    if (
      this.prevMove &&
      prevArmies[this.prevMove.start] ===
        this.game.armies[this.prevMove.start] &&
      prevArmies[this.prevMove.end] === this.game.armies[this.prevMove.end] &&
      prevTerrain[this.prevMove.start] ===
        this.game.terrain[this.prevMove.start] &&
      prevTerrain[this.prevMove.end] === this.game.terrain[this.prevMove.end]
    ) {
      console.log("skipping turn bc prevMove hasn't been processed");
      return [-1, -1];
    }
    this.headSize = this.game.armies[this.headIndex]; // update headSize
    console.log(`headIndex: ${this.headIndex}, headSize: ${this.headSize}`);

    // reset head if head becomes too small or swallowed
    if (
      this.headSize < 2 ||
      this.game.terrain[this.headIndex] !== this.playerIndex
    ) {
      console.log('resetting bc head was swallowed or was too small');
      this.resetHead();
      this.spread.resetPath();
      this.target.clearAllPaths();
    }

    // skip turn if no moves are possible
    if (this.headSize < 2) {
      console.log('skipping turn bc no available moves');
      return [-1, -1];
    }

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

    this.prevMove = { start: start, end: end };
    this.headIndex = end; // update headIndex
    console.log('attacking from', start, 'to', end);
    return [start, end];
  };
}

module.exports = Player;
