const GameState = require('./GameState');
const Spread = require('./Spread');
const Target = require('./Target');

// terrain constants
const TILE_EMPTY = -1;
const TILE_MOUNTAIN = -2;
const TILE_FOG = -3;
const TILE_FOG_OBSTACLE = -4;

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

  // euclidean distance
  eDist(start, end, width) {
    return Math.sqrt(
      Math.pow(Math.floor(end / width) - Math.floor(start / width), 2) +
        Math.pow((end % width) - (start % width), 2)
    );
  }

  // manhattan distance
  mDist(start, end, width) {
    return (
      Math.abs(Math.floor(end / width) - Math.floor(start / width)) +
      Math.abs((end % width) - (start % width))
    );
  }

  // check if tile can be currently reachable
  reachableTile(tile, width) {
    return (
      terrain[tile - 1] >= TILE_EMPTY ||
      terrain[tile + 1] >= TILE_EMPTY ||
      terrain[tile - width] >= TILE_EMPTY ||
      terrain[tile + width] >= TILE_EMPTY ||
      terrain[tile] >= 0
    );
  }

  resetHead = () => {
    this.headIndex = this.game.terrain.reduce((max, tile, index) => {
      if (tile === this.playerIndex && index !== this.headIndex) {
        if (max === -1) {
          return index;
        } else {
          return this.game.armies[index] > this.game.armies[max] ? index : max;
        }
      } else {
        return max;
      }
    }, -1);
    this.headSize = this.game.armies[this.headIndex];
    this.currPath.clear();
    this.currPath.set(this.headIndex, 1);
    console.log(
      `resetting to headIndex ${this.headIndex}, headSize ${this.headSize}`
    );
  };

  play = (data) => {
    // update game state
    this.game.update(data);

    console.log(
      `headIndex: ${this.headIndex}, headSize: ${
        this.game.armies[this.headIndex]
      }`
    );

    // reset head if head becomes too small or swallowed
    if (
      this.game.armies[this.headIndex] < this.game.avgTileSize ||
      this.game.terrain[this.headIndex] !== this.playerIndex
    ) {
      this.resetHead();
    }
    this.headSize = this.game.armies[this.headIndex];

    // determine next index
    let nextIndex;
    if (this.target.hasTarget(this, this.game)) {
      console.log(
        `targeting ${this.target.targetType} at index ${this.target.target}`
      );
      // reset head if head is too far and small from target
      if (
        this.eDist(this.headIndex, this.target.target, this.game.width) > 10 &&
        this.headSize < this.game.avgTileSize
      ) {
        this.resetHead();
      }
      // targeting
      nextIndex = this.target.getNextIndex(this, this.game);
    } else {
      console.log(`spreading`);
      // spreading
      nextIndex = Spread(this, this.game);

      // update currpath if spreading
      if (this.currPath.has(nextIndex)) {
        this.currPath.set(nextIndex, this.currPath.get(nextIndex) + 1);
      } else {
        this.currPath.set(nextIndex, 1);
      }
    }

    // attack
    this.socket.emit('attack', this.headIndex, nextIndex);
    this.headIndex = nextIndex; // update headIndex
    console.log(
      `going to index ${this.headIndex}, freq: ${this.currPath.get(
        this.headIndex
      )}`
    );
    console.log();
  };
}

module.exports = Player;
