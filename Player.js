const Game = require('./GameState');
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
    this.game = new Game();
    this.target = -1;
    this.targetPath = [];
    this.currPath = new Map();
    this.headIndex = -1;
    this.resetHead = false;
    this.foundGenerals = [];
    this.socket = socket;
  }

  update = (data) => {
    this.game.update(data);
  };

  play = () => {
    // map dimensions
    const width = this.game.map[0];
    const height = this.game.map[1];
    const size = width * height;

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

    // update board state
    const turn = this.game.turn;
    const armies = this.game.map.slice(2, size + 2);
    const terrain = this.game.map.slice(size + 2, size + 2 + size);

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

    const crown = this.game.generals[this.playerIndex];
    for (const g of this.game.generals) {
      if (g !== -1 && g !== crown && this.foundGenerals.indexOf(g) === -1) {
        this.foundGenerals.push(g);
      }
    }

    // update cities
    const myCities = this.game.cities.filter(
      (c) => terrain[c] === this.playerIndex
    );

    const [myArmy, rowSum, colSum] = terrain.reduce(
      (acc, t, i) => {
        if (t === this.playerIndex) {
          acc[0].push(i);
        }
        acc[1] += Math.floor(i / width);
        acc[2] += i % width;
        return acc;
      },
      [[], 0, 0]
    );

    const highTileStack = myArmy.slice().sort((a, b) => armies[a] - armies[b]);

    const myScore = this.game.scores.find((s) => s.i === this.playerIndex);
    const numTroops = myScore.total;
    const numTiles = myScore.tiles;
    const avgTileSize = Math.floor(numTroops / numTiles);
    let headSize = armies[this.headIndex];

    console.log(`headIndex at ${this.headIndex}, headSize ${headSize}`);

    const avgRow = Math.floor(rowSum / numTiles);
    const avgCol = Math.floor(colSum / numTiles);
    const centerIndex = avgRow * width + avgCol; // based on centerIndex of army

    if (this.target !== -1 && terrain[this.target] === this.playerIndex) {
      this.target = -1;
      this.currPath.clear();
      console.log(`targeting finished`);
    }

    this.resetHead = false;
    if (
      headSize < avgTileSize ||
      terrain[this.headIndex] !== this.playerIndex
    ) {
      this.resetHead = true;
    }

    if (this.resetHead) {
      let nextHeadIndex;
      do {
        nextHeadIndex = highTileStack.pop();
      } while (nextHeadIndex === this.headIndex);
      this.headIndex = nextHeadIndex;
      headSize = armies[this.headIndex];
      this.currPath.clear();
      this.currPath.set(this.headIndex, 1);
      console.log(
        `resetting to headIndex ${this.headIndex}, headSize ${headSize}`
      );
      this.resetHead = false;
    }

    let nextIndex;
    nextIndex = Spread(
      this.playerIndex,
      width,
      height,
      this.headIndex,
      centerIndex,
      avgTileSize,
      terrain,
      armies,
      this.game.cities,
      this.currPath,
      eDist
    );

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
      const numOwnedCities = myCities.length;
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
    //   headSize < armies[this.target] + 2 &&
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
        armies,
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
          armies,
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
