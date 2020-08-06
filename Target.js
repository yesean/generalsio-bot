const Game = require('./GameState');
const Algorithms = require('./Algorithms');

const colors = require('colors');
const { performance } = require('perf_hooks');
const { captureRejectionSymbol } = require('events');

class Target {
  constructor() {
    this.targetType = '';
    this.targetPath = [];
    this.gatherPath = [];
  }

  hasTarget = (player, game) => {
    const { playerIndex, headIndex, headSize, resetHead } = player;
    const {
      turn,
      scores,
      crown,
      cities,
      width,
      height,
      armies,
      terrain,
      foundGenerals,
      myScore,
      numOwnedCities,
      biggestEnemy,
      dist,
      isReachable,
    } = game;

    // reset gatherPath if gathering if finished
    if (
      this.gatherPath.length > 0 &&
      player.headIndex === this.gatherPath[this.gatherPath.length - 1]
    ) {
      console.log('finished gathering');
      this.gatherPath = [];
    }

    // reset targetPath if target is acquired
    if (
      this.targetPath.length > 0 &&
      // terrain[this.targetPath[this.targetPath.length - 1]] === playerIndex
      player.team.has(terrain[this.targetPath[this.targetPath.length - 1]])
    ) {
      console.log('finished targeting');
      this.targetPath = [];
      this.targetType = '';
    }

    if (
      foundGenerals.length > 0 &&
      game.dist(foundGenerals[0].index, headIndex) <= 2 &&
      headSize > armies[foundGenerals[0].index] + 1
    ) {
      // kill crown if possible
      console.log(`killing crown`);
      this.clearAllPaths();
      this.targetType = 'kill crown';
      this.setTargetPath(
        player.headIndex,
        foundGenerals[0].index,
        player,
        game
      );
      return true;
    }

    // reset target if cannot be seen anymore
    if (
      (this.targetType === 'close enemy' ||
        this.targetType === 'enemy territory') &&
      game.terrain[this.targetPath[this.targetPath.length - 1]] < 0
    ) {
      this.targetType = '';
      this.targetPath = [];
    }

    const incomingHead = this.getBestIncomingHead(player, game);
    if (
      incomingHead !== -1 &&
      (this.targetType !== 'incoming head' ||
        incomingHead !== this.targetPath[this.targetPath.length - 1])
    ) {
      this.clearAllPaths();
      this.targetType = 'incoming head';
      this.setTargetPath(player.headIndex, incomingHead, player, game);

      // reset head to crown if current target path is insufficent
      const potentialTargetPathSum = this.getPathSum(
        this.targetPath,
        player,
        game
      );
      if (potentialTargetPathSum <= game.armies[incomingHead]) {
        resetHead(game.crown);
        this.setTargetPath(player.headIndex, incomingHead, player, game);
      }
      console.log(
        'targeting from',
        player.headIndex,
        'to',
        this.targetPath[this.targetPath.length - 1]
      );
      console.log(
        `targeting ${this.targetType} at index ${
          this.targetPath[this.targetPath.length - 1]
        }`
      );
      return true;
    }

    // target close enemies if it is only close enemy or a closer one has been located
    const closestEnemy = this.getBestCloseEnemy(player, game);
    if (
      closestEnemy !== -1 &&
      this.targetType !== 'incoming head' &&
      (this.targetType !== 'close enemy' ||
        closestEnemy !== this.targetPath[this.targetPath.length - 1])
    ) {
      this.clearAllPaths();
      this.targetType = 'close enemy';
      this.setTargetPath(player.headIndex, closestEnemy, player, game);

      // reset head to crown if current target path is insufficent
      const potentialTargetPathSum = this.getPathSum(
        this.targetPath,
        player,
        game
      );
      if (potentialTargetPathSum <= game.armies[closestEnemy]) {
        resetHead(game.crown);
        this.setTargetPath(player.headIndex, closestEnemy, player, game);
      }
      console.log(
        'targeting from',
        player.headIndex,
        'to',
        this.targetPath[this.targetPath.length - 1]
      );
      console.log(
        `targeting ${this.targetType} at index ${
          this.targetPath[this.targetPath.length - 1]
        }`
      );
      return true;
    }

    // if gathering
    if (this.gatherPath.length > 0) {
      console.log('gathering');
      return true;
    }

    // remove corrupted target path
    while (
      this.targetPath.length > 0 &&
      (game.terrain[this.targetPath[0]] !== player.playerIndex ||
        // (!player.team.has(game.terrain[this.targetPath[0]]) ||
        game.armies[this.targetPath[0]] < 2)
    ) {
      this.targetPath.shift();
    }

    // if targeting
    if (this.targetPath.length > 0) {
      console.log(
        `targeting ${this.targetType} at index ${this.targetPath.slice(-1)[0]}`
      );
      return true;
    }

    let targetIndex = -1;
    if (foundGenerals.length > 0) {
      // if not busy, target enemy crown
      targetIndex = foundGenerals[0].index;
      this.targetType = 'crown';
    } else if (this.shouldGetCities(player, game)) {
      // if not busy, target cities
      targetIndex = this.getClosestCity(player, game);
      this.targetType = 'city';
    } else if (biggestEnemy !== -1) {
      // if not busy, target enemy territory
      // targetIndex = this.getBestEnemyTerritory(player, game);
      this.targetType = 'enemy territory';
      targetIndex = 0;
    }

    if (targetIndex !== -1) {
      // reset head if head is too far or too close from target and not enough

      if (this.targetType === 'enemy territory') {
        this.targetPath = Algorithms.dijkstra(
          player.headIndex,
          game.biggestEnemy,
          player,
          game,
          true
        );
      } else {
        this.setTargetPath(player.headIndex, targetIndex, player, game);
      }
      const potentialTargetPathSum = this.getPathSum(
        this.targetPath,
        player,
        game
      );
      if (
        potentialTargetPathSum <= game.armies[targetIndex] &&
        dist(player.headIndex, targetIndex) <
          Math.floor(game.width / 2 + game.height / 2)
      ) {
        console.log(
          "resetting head bc targetPath isn't sufficient and head and target are too close"
        );
        resetHead(game.crown);
        if (this.targetType === 'enemy territory') {
          this.targetPath = Algorithms.dijkstra(
            player.headIndex,
            game.biggestEnemy,
            player,
            game,
            true
          );
        } else {
          this.setTargetPath(player.headIndex, targetIndex, player, game);
        }
      }
      console.log(
        'targeting from',
        player.headIndex,
        'to',
        this.targetPath[this.targetPath.length - 1]
      );
      console.log(
        `targeting ${this.targetType} at index ${
          this.targetPath[this.targetPath.length - 1]
        }`
      );
      return true;
    }

    // no targets
    return false;
  };

  getBestEnemyTerritory = (player, game) => {
    return game.terrain.reduce((closest, tile, index) => {
      if (tile === game.biggestEnemy && game.isReachable(index)) {
        if (closest === -1) {
          return index;
        } else {
          const tDist = game.dist(player.headIndex, index);
          const cDist = game.dist(player.headIndex, closest);
          return tDist < cDist ? index : closest;
        }
      } else {
        return closest;
      }
    }, -1);
  };

  getClosestCity = (player, game) => {
    return game.cities
      .filter(
        (city) =>
          // game.terrain[city] !== player.playerIndex && game.isReachable(city)
          !player.team.has(game.terrain[city]) && game.isReachable(city)
      )
      .reduce((min, city) =>
        game.dist(game.crown, city) < game.dist(game.crown, min) ? city : min
      );
  };

  shouldGetCities = (player, game) => {
    const closestBiggestEnemy = game.terrain.reduce((closest, tile, index) => {
      if (tile === game.biggestEnemy) {
        const indexObj = { index: index, dist: game.dist(game.crown, index) };
        if (!closest) {
          return indexObj;
        } else {
          return indexObj.dist < closest.dist ? indexObj : closest;
        }
      } else {
        return closest;
      }
    }, null);
    console.log('closestBiggestEnemy:', closestBiggestEnemy);
    const unsafeDist = Math.floor(game.width / 2.5 + game.height / 2.5);
    const isBiggestEnemyAThreat =
      game.biggestEnemy !== -1 &&
      game.scores.find((score) => score.i === game.biggestEnemy).total >
        game.myScore.total &&
      closestBiggestEnemy &&
      closestBiggestEnemy.dist < unsafeDist;

    // target cities if enemies aren't a huge threat and cities are lacking
    return (
      !isBiggestEnemyAThreat &&
      game.numOwnedCities < Math.floor(game.turn / 75) &&
      game.turn % 15 === 0 &&
      game.cities.some(
        (city) =>
          // game.terrain[city] !== player.playerIndex && game.isReachable(city)
          !player.team.has(game.terrain[city]) && game.isReachable(city)
      )
    );
  };

  getBestCloseEnemy = (player, game) => {
    // calculate any nearby enemies
    const unsafeDist = Math.floor(game.width / 4 + game.height / 4);
    const closestEnemy = game.terrain.reduce((largest, tile, index) => {
      if (
        !player.team.has(tile) &&
        tile >= 0 &&
        game.generals
          .filter((g, i) => player.team.has(i))
          .some((teamCrown) => game.dist(teamCrown, index) < unsafeDist)
      ) {
        if (largest === -1) {
          return index;
        } else {
          if (game.armies[index] === game.armies[largest]) {
            return game.dist(index, game.crown) > game.dist(largest, game.crown)
              ? index
              : largest;
          } else {
            return game.armies[index] > game.armies[largest] ? index : largest;
          }
        }
      } else {
        return largest;
      }
    }, -1);
    return closestEnemy;
  };

  getBestIncomingHead = (player, game) => {
    const bestHead = game.terrain.reduce((largest, tile, index) => {
      let isHeadDangerous = false;
      const isHeadRelativelyLarge =
        !player.team.has(tile) &&
        tile >= 0 &&
        game.armies[index] > game.armies[game.crown];
      if (isHeadRelativelyLarge) {
        const headPath = Algorithms.aStar(game.crown, index, player, game);
        let pathSum = headPath.reduce((sum, headPathSq) => {
          if (
            player.team.has(game.terrain[headPathSq]) &&
            headPathSq !== player.headIndex
          ) {
            sum += game.armies[headPathSq];
          } else if (game.terrain[headPathSq]) {
            sum += 50;
          } else {
            sum -= game.armies[headPathSq] - 1;
          }
        });
        isHeadDangerous = pathSum <= game.armies[index];
      }
      if (isHeadDangerous) {
        if (largest === -1) {
          return index;
        } else {
          return game.armies[index] > game.armies[largest] ? index : largest;
        }
      } else {
        return largest;
      }
    }, -1);
    return bestHead;
  };

  getAttack = (player, game) => {
    const { playerIndex, headIndex, resetHead } = player;
    const { crown, width, height, armies, terrain, avgTileSize, dist } = game;

    // reset gather or target path if mountain is hit
    if (this.gatherPath.length > 1 && game.mountains.has(this.gatherPath[1])) {
      console.log('hit gather mountain');
      if (this.gatherPath.length === 2) {
        this.gatherPath = [];
      } else {
        this.setGatherPath(
          player.headIndex,
          this.gatherPath[this.gatherPath.length - 1],
          player,
          game
        );
      }
    } else if (
      this.targetPath.length > 1 &&
      game.mountains.has(this.targetPath[1])
    ) {
      console.log('hit target mountain');
      this.setTargetPath(
        player.headIndex,
        this.targetPath[this.targetPath.length - 1],
        player,
        game
      );
    }

    if (this.targetPath.length > 0 && this.gatherPath.length === 0) {
      this.gatherPath = this.getGatherPath(player, game);
    }

    if (this.targetPath.length > 0) {
      console.log('targetPath:', this.targetPath);
      this.printPath(game, this.targetPath);
    }

    if (this.gatherPath.length > 0) {
      this.printPath(game, this.gatherPath);
      console.log('gatherPath:', this.gatherPath);
    }

    if (this.gatherPath.length > 0) {
      return [this.gatherPath.shift(), this.gatherPath[0]];
    } else {
      return [this.targetPath.shift(), this.targetPath[0]];
    }
  };

  getGatherPath = (player, game) => {
    // calculate cost to capture target
    const start = performance.now();
    const bestGatherPathObj = game.terrain.reduce((best, tile, index) => {
      if (
        tile === player.playerIndex &&
        !this.targetPath.includes(index) &&
        game.armies[index] > 1
      ) {
        const closestPathIndex = this.targetPath
          .slice(0, -1)
          .reduce((closestObj, targetPathSq) => {
            const indexDist = game.dist(index, targetPathSq);
            const indexObj = { index: targetPathSq, dist: indexDist };
            if (!closestObj) {
              return indexObj;
            } else {
              return indexDist < closestObj.dist ? indexObj : closestObj;
            }
          }, null).index;

        const gatherPath = Algorithms.aStar(
          index,
          closestPathIndex,
          player,
          game
        );
        const gatherPathSum = gatherPath.reduce((sum, targetPathSq) => {
          if (!this.targetPath.includes(targetPathSq)) {
            if (player.team.has(game.terrain[targetPathSq])) {
              return sum + game.armies[targetPathSq] - 1;
            } else if (game.terrain[targetPathSq] === Game.TILE_FOG_OBSTACLE) {
              return sum - 50; // approx city cost
            } else {
              return sum - game.armies[targetPathSq] - 1;
            }
          } else {
            return sum;
          }
        }, 0);
        const gatherPathObj = {
          index: index,
          closestPathIndex: closestPathIndex,
          gatherPath: gatherPath,
          gatherPathSum: gatherPathSum,
        };
        if (!best) {
          return gatherPathObj;
        } else {
          return gatherPathSum / Math.sqrt(gatherPath.length) >
            best.gatherPathSum / Math.sqrt(best.gatherPath.length)
            ? gatherPathObj
            : best;
        }
      } else {
        return best;
      }
    }, null);
    const end = performance.now();
    console.log('time to compute bestGatherPathObj:', end - start, 'ms');

    const captureCost =
      game.armies[this.targetPath[this.targetPath.length - 1]];
    const targetPathSum = this.getPathSum(this.targetPath, player, game);
    const targetPathSumMyTroops = this.targetPath.reduce(
      (sum, targetPathSq) => {
        if (player.team.has(game.terrain[targetPathSq])) {
          return sum + game.armies[targetPathSq] - 1;
        } else {
          return sum;
        }
      },
      0
    );
    console.log('capture cost:', captureCost, 'targetPathSum:', targetPathSum);

    // gather if target path doesn't provide enough troops
    // or more troops can be used for enemy territory targeting
    if (bestGatherPathObj) {
      console.log(
        'gatherPath length:',
        bestGatherPathObj.gatherPath.length,
        'length restriction',
        game.width / 5 + game.height / 5
      );
    }
    if (
      bestGatherPathObj &&
      this.targetType !== 'kill crown' &&
      (targetPathSum <= captureCost ||
        ((this.targetType === 'enemy territory' ||
          this.targetType === 'crown') &&
          bestGatherPathObj.gatherPathSum > 2 * game.avgTileSize &&
          bestGatherPathObj.gatherPath.length <
            game.width / 4 + game.height / 4))
    ) {
      console.log(
        'gathering from',
        bestGatherPathObj.gatherPath[0],
        'to',
        bestGatherPathObj.gatherPath[bestGatherPathObj.gatherPath.length - 1],
        'provides',
        bestGatherPathObj.gatherPathSum,
        'troops'
      );
      return bestGatherPathObj.gatherPath;
    } else {
      return [];
    }
  };

  setTargetPath = (start, end, player, game) => {
    // calculate path
    this.targetPath = Algorithms.aStar(start, end, player, game);
  };

  setGatherPath = (start, end, player, game) => {
    // calculate path
    this.gatherPath = Algorithms.aStar(start, end, player, game);
  };

  getPathSum = (path, player, game) => {
    // calculate how much head will have on arrival
    let sum = 0;
    for (const index of path.slice(0, -1)) {
      // if (game.terrain[index] === game.playerIndex) {
      if (player.team.has(game.terrain[index])) {
        sum += game.armies[index] - 1;
      } else if (game.terrain[index] === Game.TILE_FOG_OBSTACLE) {
        sum -= 50; // approx city cost
      } else {
        sum -= game.armies[index] + 1;
      }
    }
    return sum;
  };

  clearAllPaths = () => {
    console.log('clearing gather and target paths');
    this.targetType = '';
    this.targetPath = [];
    this.gatherPath = [];
  };

  printPath = (game, path) => {
    let grid = '';
    grid += ' ';
    for (let i = 0; i < game.width; i++) {
      grid += '\u2014 ';
    }
    grid += '\n';
    for (let i = 0; i < game.size; i++) {
      if (i % game.width === 0) {
        grid += '|';
      }
      if (i === path.slice(-1)[0]) {
        grid += 'O'.green;
      } else if (i === path[0]) {
        grid += 'O'.yellow;
      } else if (path.indexOf(i) !== -1) {
        grid += 'O'.white;
      } else if (
        (game.terrain[i] === Game.TILE_FOG_OBSTACLE &&
          game.cities.indexOf(i) === -1) ||
        // game.terrain[i] === Game.TILE_MOUNTAIN
        game.mountains.has(i)
      ) {
        grid += 'X'.red;
      } else {
        grid += ' ';
      }
      if ((i + 1) % game.width === 0) {
        grid += '|\n';
      } else {
        grid += ' ';
      }
    }
    grid += ' ';
    for (let i = 0; i < game.width; i++) {
      grid += '\u2014 ';
    }
    console.log(grid);
  };
}

module.exports = Target;
