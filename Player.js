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
    this.playerIndex = playerIndex;
    this.game = new GameState();
    this.target = -1;
    this.targetPath = [];
    this.currPath = new Map();
    this.headIndex = -1;
    this.this.headSize = 0;
    this.resetHead = false;
    this.socket = socket;
  }

  play = (data) => {
    // update game state
    this.game.update(data);

    // euclidean distance
    const eDist = (s, e) =>
      Math.sqrt(
        Math.pow(Math.floor(e / width) - Math.floor(s / width), 2) +
          Math.pow((e % width) - (s % width), 2)
      );

    // manhattan distance
    const mDist = (s, e) =>
      Math.abs(Math.floor(e / width) - Math.floor(s / width)) +
      Math.abs((e % width) - (s % width));

    // check if tile can be currently reachable
    const reachableTile = (tile) => {
      return (
        terrain[tile - 1] >= TILE_EMPTY ||
        terrain[tile + 1] >= TILE_EMPTY ||
        terrain[tile - width] >= TILE_EMPTY ||
        terrain[tile + width] >= TILE_EMPTY ||
        terrain[tile] >= 0
      );
    };

    this.headSize = this.game.armies[this.headIndex];

    if (this.target !== -1 && terrain[this.target] === this.playerIndex) {
      this.target = -1;
      this.currPath.clear();
      console.log(`targeting finished`);
    }

    if (
      this.headSize < avgTileSize ||
      terrain[this.headIndex] !== this.playerIndex
    ) {
      this.resetHead = true;
    }

    if (this.resetHead) {
      this.headIndex = this.game.terrain.reduce((max, tile, index) => {
        if (tile === this.playerIndex && index !== this.headIndex) {
          if (max === -1) {
            return index;
          } else {
            return this.game.armies[index] > this.game.armies[max]
              ? index
              : max;
          }
        }
      }, -1);
      this.headSize = this.game.armies[this.headIndex];
      this.currPath.clear();
      this.currPath.set(this.headIndex, 1);
      console.log(
        `resetting to headIndex ${this.headIndex}, this.headSize ${this.headSize}`
      );
      this.resetHead = false;
    }

    let nextIndex = Spread(this, this.game, eDist);

    // used to determine the number troops needed for takeover
    let targetingEnemyTerritory = false;

    // always stop nearby enemies
    const closeEnemy = terrain.reduce((closest, t, i) => {
      if (t !== this.playerIndex && t >= 0 && eDist(crown, i) < 7) {
        if (closest === -1) {
          return i;
        } else {
          return eDist(crown, i) < eDist(crown, closest) ? i : closest;
        }
      } else {
        return closest;
      }
    }, -1);
    if (closeEnemy !== -1 && this.target !== closeEnemy) {
      this.target = closeEnemy;
    }

    // if possible try to attack enemy crown
    if (this.target === -1) {
      if (this.foundGenerals.length > 0) {
        this.target = this.foundGenerals[0];
      }
    }

    // if possible try to this.target enemy territory
    let enemyTerritory = -1;
    if (
      this.target === -1 &&
      terrain.some(
        (t, i) => t !== this.playerIndex && t >= 0 && reachableTile(i)
      )
    ) {
      enemyTerritory = terrain.reduce((closest, t, i) => {
        if (t !== this.playerIndex && t >= 0 && reachableTile(i)) {
          if (closest === -1) {
            return i;
          } else {
            const tDist = eDist(crown, i);
            const cDist = eDist(crown, closest);
            return tDist < cDist ? i : closest;
          }
        }
      });
      targetingEnemyTerritory = true;
      this.target = enemyTerritory;
    }

    // if possible this.target cities
    if (this.target === -1) {
      const numOwnedCities = cities.filter(
        (c) => terrain[c] === this.playerIndex
      ).length;
      if (
        numOwnedCities < Math.floor(turn / 75) &&
        this.game.cities.length > numOwnedCities &&
        this.game.cities.some((c) => c !== -1)
      ) {
        this.target = this.game.cities
          .filter((c) => terrain[c] !== this.playerIndex && c !== -1)
          .reduce((min, c) => (eDist(crown, c) < eDist(crown, min) ? c : min));
      }
    }

    const targetRow = Math.floor(this.target / width);
    const targetCol = this.target % width;
    if (this.target !== -1) {
      console.log(
        `targeting index ${this.target}, row ${targetRow}, col ${targetCol}`
      );
      console.log(
        `target is a ${
          closeEnemy !== -1
            ? 'close enemy'
            : this.game.generals.indexOf(this.target) >= 0
            ? 'crown'
            : enemyTerritory !== -1
            ? 'enemy territory'
            : 'city'
        }`
      );
    }

    // // if head is too small and far away, reset head
    // if (
    //   this.target !== -1 &&
    //   this.headSize < this.game.armies[this.target] + 2 &&
    //   eDist(this.headIndex, this.target) < 2 &&
    //   eDist(crown, this.headIndex) > 10
    // ) {
    //   this.resetHead = true;
    //   console.log(`target too large, resetting head`);
    //   console.log();
    //   return;
    // }

    // set target path of target
    if (this.target !== -1 && this.targetPath.length === 0) {
      console.log(`determining path from ${this.headIndex} to ${this.target}`);
      this.targetPath = Target(
        this.headIndex,
        this.target,
        terrain,
        this.game.armies,
        this.game.cities,
        this.playerIndex,
        width,
        height
      );
    }

    // follow target path
    if (this.target !== -1 && this.targetPath.length > 0) {
      console.log(`using path ${this.targetPath}`);
      nextIndex = this.targetPath.shift();
      if (terrain[nextIndex] === TILE_MOUNTAIN) {
        console.log(`dijkstra ran into mountain, recomputing path`);
        this.targetPath = Target(
          this.headIndex,
          this.target,
          terrain,
          this.game.armies,
          this.game.cities,
          this.playerIndex,
          width,
          height
        );
        return;
      }
    }

    if (this.currPath.has(nextIndex)) {
      this.currPath.set(nextIndex, this.currPath.get(nextIndex) + 1);
    } else {
      this.currPath.set(nextIndex, 1);
    }

    this.socket.emit('attack', this.headIndex, nextIndex);
    console.log(
      `going to index ${nextIndex}, freq: ${this.currPath.get(nextIndex)}`
    );
    this.headIndex = nextIndex;
    console.log();
  };
}

module.exports = Player;
