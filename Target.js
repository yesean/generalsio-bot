const Game = require('./GameState');

const colors = require('colors');

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

    // kill crown if possible
    if (
      foundGenerals.length > 0 &&
      dist(foundGenerals[0], headIndex) === 1 &&
      headSize > armies[foundGenerals[0]] + 1
    ) {
      console.log(`killing crown`);
      this.targetPath = [headIndex, foundGenerals[0]];
      return true;
    }

    // calculate any nearby enemies
    const closeEnemy = terrain.reduce((largest, tile, index) => {
      if (tile !== playerIndex && tile >= 0 && dist(crown, index) < 7) {
        if (largest === -1) {
          return index;
        } else {
          return armies[index] - dist(crown, index) >
            armies[largest] - dist(crown, largest)
            ? index
            : largest;
        }
      } else {
        return largest;
      }
    }, -1);
    // always targetIndex large nearby enemies
    if (
      closeEnemy !== -1 &&
      (this.targetType !== 'close enemy' ||
        dist(closeEnemy, crown) < dist(this.targetPath.slice(-1)[0], crown))
    ) {
      resetHead(crown);
      this.targetType = 'close enemy';
      this.setTargetPath(player.headIndex, closeEnemy, player, game);
      return true;
    }

    // reset if gatherTargetIndex is acquired
    if (this.gatherPath.length > 0) {
      if (headIndex === this.gatherPath.slice(-1)[0]) {
        this.gatherPath = [];
        console.log(`finished gathering`);
      } else {
        console.log(`gathering`);
        return true;
      }
    }

    if (this.targetPath.length > 0) {
      // reset if targetIndex is acquired
      if (terrain[this.targetPath.slice(-1)[0]] === playerIndex) {
        this.targetPath = [];
        this.targetType = '';
        console.log(`finished targeting`);
      } else {
        console.log(
          `targeting ${this.targetType} at index ${
            this.targetPath.slice(-1)[0]
          }`
        );
        return true;
      }
    }

    let targetIndex = -1;
    if (foundGenerals.length > 0) {
      // if not busy targetIndex enemy crown
      targetIndex = foundGenerals[0];
      this.targetType = 'crown';
    } else if (
      // if not busy targetIndex cities if lacking or enemies are afar
      !(
        biggestEnemy !== -1 &&
        scores.find((score) => score.i === biggestEnemy).total < myScore.total
      ) &&
      numOwnedCities < Math.floor(turn / 75) &&
      cities.some((city) => terrain[city] !== playerIndex && isReachable(city))
    ) {
      // calculate closest city to crown
      const closestCity = cities
        .filter((city) => terrain[city] !== playerIndex && isReachable(city))
        .reduce((min, city) =>
          dist(crown, city) < dist(crown, min) ? city : min
        );
      targetIndex = closestCity;
      this.targetType = 'city';
    } else if (biggestEnemy !== -1) {
      // target enemy closest to head
      const enemyTerritory = terrain.reduce((closest, tile, index) => {
        if (tile === biggestEnemy && isReachable(index)) {
          if (closest === -1) {
            return index;
          } else {
            const tDist = dist(headIndex, index);
            const cDist = dist(headIndex, closest);
            return tDist < cDist ? index : closest;
          }
        } else {
          return closest;
        }
      }, -1);
      targetIndex = enemyTerritory;
      this.targetType = 'enemy territory';
    }

    if (targetIndex !== -1) {
      // reset head if head is too far or too close from target and not enough
      if (
        dist(headIndex, targetIndex) > Math.floor(width / 2 + height / 2) ||
        (dist(headIndex, targetIndex) <= 2 &&
          armies[headIndex] < armies[targetIndex] / 2)
      ) {
        console.log(
          `resetting head bc head and target are too far or too close`
        );
        resetHead();
      }
      console.log(`targeting ${this.targetType} at index ${targetIndex}`);
      this.setTargetPath(headIndex, targetIndex, player, game);
      return true;
    }

    // no targets
    return false;
  };

  getAttack = (player, game) => {
    const { playerIndex, headIndex, resetHead } = player;
    const { crown, width, height, armies, terrain, avgTileSize, dist } = game;
    // reset path if mountain is hit
    if (
      this.gatherPath.length > 1 &&
      // terrain[this.gatherPath[1] === Game.TILE_MOUNTAIN]
      game.mountains.has(this.gatherPath[1])
    ) {
      console.log(`resetting gather path, initial path hit mountain`);
      this.setTargetPath(headIndex, this.gatherPath.slice(-1)[0], player, game);
    } else if (
      this.targetPath.length > 1 &&
      // terrain[this.targetPath[1]] === Game.TILE_MOUNTAIN
      game.mountains.has(this.targetPath[1])
    ) {
      console.log(`resetting target path, initial path hit mountain`);
      this.setTargetPath(headIndex, this.targetPath.slice(-1)[0], player, game);
    }

    let captureCost;
    captureCost = armies[this.targetPath.slice(-1)[0]] + 1;
    if (dist(this.targetPath.slice(-1)[0], crown) > width / 2 + height / 2) {
      captureCost *= 2;
    }
    console.log(`capture cost: ${captureCost}`);
    if (this.gatherPath.length === 0 && this.getPathSum(game) < captureCost) {
      console.log(`calculating gather`);
      const [pathCenterRow, pathCenterCol] = this.targetPath
        .reduce(
          (pos, index) => {
            pos[0] += Math.floor(index / width);
            pos[1] += index % width;
            return pos;
          },
          [0, 0]
        )
        .map((pos) => Math.floor(pos / this.targetPath.length));
      console.log(
        `pathCenterRow: ${pathCenterRow}, pathCenterCol: ${pathCenterCol}`
      );
      const pathCenter = pathCenterRow * width + pathCenterCol;
      const gatherStartIndex = terrain.reduce((best, tile, index) => {
        if (
          tile === playerIndex &&
          this.targetPath.indexOf(index) === -1 &&
          armies[index] > 1
        ) {
          if (best === -1) {
            return index;
          } else {
            const tileWeight =
              Math.pow(armies[index], 1.5) / dist(index, pathCenter);
            const bestWeight =
              Math.pow(armies[best], 1.5) / dist(index, pathCenter);
            return tileWeight > bestWeight ? index : best;
          }
        } else {
          return best;
        }
      }, -1);
      const gatherTargetIndex = this.targetPath.reduce((min, index) =>
        dist(gatherStartIndex, index) < dist(gatherStartIndex, min)
          ? index
          : min
      );
      resetHead(gatherStartIndex);
      this.setGatherPath(gatherStartIndex, gatherTargetIndex, player, game);
      console.log(`gathering from ${gatherStartIndex} to ${gatherTargetIndex}`);
    }

    if (this.gatherPath.length > 0) {
      return [this.gatherPath.shift(), this.gatherPath[0]];
    } else {
      this.printPath(game);
      return [this.targetPath.shift(), this.targetPath[0]];
    }
  };

  setTargetPath = (start, end, player, game) => {
    // calculate path
    console.log(`running dijkstra's from ${start} to ${end}`);
    // this.targetPath = this.dijkstra(start, end, game);
    this.targetPath = this.aStar(start, end, game);
  };

  setGatherPath = (start, end, player, game) => {
    // calculate path
    console.log(`running dijkstra's from ${start} to ${end}`);
    // this.gatherPath = this.dijkstra(start, end, game, true);
    this.gatherPath = this.aStar(start, end, game, true);
  };

  getPathSum = (game) => {
    const { playerIndex, armies, terrain } = game;
    // calculate how much head will have on arrival
    let sum = 0;
    for (const index of this.targetPath.slice(0, -1)) {
      if (terrain[index] === playerIndex || terrain[index] === Game.TILE_FOG) {
        sum += armies[index] - 1;
      } else if (terrain[index] >= 0) {
        sum -= armies[index] + 1;
      } else if (terrain[index] === Game.TILE_FOG_OBSTACLE) {
        sum -= 50;
      }
    }
    console.log(
      `pathsum: ${sum}, armies[target]: ${armies[this.targetPath.slice(-1)[0]]}`
    );
    return sum;
  };

  // calculate path to targetIndex with dijkstra's
  dijkstra = (start, end, game, gather = false) => {
    const {
      playerIndex,
      armies,
      terrain,
      cities,
      width,
      height,
      isValidMove,
    } = game;
    let prev = new Map();
    let weights = terrain.map((tile) => Number.MAX_SAFE_INTEGER);
    weights[start] = 1;

    let visited = new Set();
    let pqueue = [start];
    const moves = [-1, 1, -width, width];
    while (pqueue.length > 0) {
      const currIndex = pqueue.shift();

      // terminate search if targetIndex is found
      if (currIndex === end) {
        break;
      }

      visited.add(currIndex);
      for (const move of moves) {
        // ignore impossible moves
        const nextIndex = currIndex + move;
        if (
          game.mountains.has(nextIndex) ||
          // terrain[nextIndex] === Game.TILE_MOUNTAIN ||
          !isValidMove(currIndex, nextIndex)
        ) {
          continue;
        }
        let moveWeight =
          weights[currIndex] + this.calcWeight(nextIndex, game, gather);

        // update path weight to nextIndex if lower than current
        if (moveWeight < weights[nextIndex]) {
          weights[nextIndex] = moveWeight;
          prev.set(nextIndex, currIndex);
        }

        // insert index into priority queue if unvisited
        if (!visited.has(nextIndex)) {
          // remove index if its already in the queue
          const position = pqueue.indexOf(nextIndex);
          if (position !== -1) {
            pqueue.splice(position, 1);
          }
          this.insert(pqueue, nextIndex, weights);
        }
      }
    }

    // determine shortest path
    const path = [];
    let prevIndex = end;
    while (prevIndex !== undefined) {
      path.unshift(prevIndex);
      prevIndex = prev.get(prevIndex);
    }
    return path;
  };

  // calculate path to targetIndex with aStar
  aStar = (start, end, game, gather = false) => {
    const {
      playerIndex,
      armies,
      terrain,
      cities,
      width,
      height,
      isValidMove,
    } = game;
    let prev = new Map();
    let weights = terrain.map((tile) => Number.MAX_SAFE_INTEGER);
    weights[start] = 1;

    let visited = new Set();
    let pqueue = [start];
    const moves = [-1, 1, -width, width];
    while (pqueue.length > 0) {
      const currIndex = pqueue.shift();

      // terminate search if targetIndex is found
      if (currIndex === end) {
        break;
      }

      visited.add(currIndex);
      for (const move of moves) {
        // ignore impossible moves
        const nextIndex = currIndex + move;
        if (
          // terrain[nextIndex] === Game.TILE_MOUNTAIN ||
          game.mountains.has(nextIndex) ||
          !isValidMove(currIndex, nextIndex)
        ) {
          continue;
        }
        let moveWeight =
          weights[currIndex] + this.calcWeight(nextIndex, game, gather);

        // update path weight to nextIndex if lower than current
        if (moveWeight < weights[nextIndex]) {
          weights[nextIndex] = moveWeight;
          prev.set(nextIndex, currIndex);
        }

        // insert index into priority queue if unvisited
        if (!visited.has(nextIndex)) {
          // remove index if its already in the queue
          const position = pqueue.indexOf(nextIndex);
          if (position !== -1) {
            pqueue.splice(position, 1);
          }
          this.aInsert(pqueue, nextIndex, end, weights, game);
        }
      }
    }

    // determine shortest path
    const path = [];
    let prevIndex = end;
    while (prevIndex !== undefined) {
      path.unshift(prevIndex);
      prevIndex = prev.get(prevIndex);
    }
    return path;
  };

  calcWeight = (nextIndex, game, gather) => {
    const { playerIndex, cities, width, height, armies, terrain } = game;

    let moveWeight = 1;
    // when gathering, favor my own tiles and blanks
    if (gather) {
      if (
        (terrain[nextIndex] === Game.TILE_EMPTY &&
          cities.indexOf(nextIndex) === -1) ||
        terrain[nextIndex] === playerIndex
      ) {
        moveWeight += width * height - armies[nextIndex];
      } else {
        moveWeight += 2 * width * height;
      }
    } else {
      // add weight to unknown obstacles
      if (terrain[nextIndex] === Game.TILE_FOG_OBSTACLE) {
        moveWeight += 40;
      }

      // add weight to cities
      if (
        cities.indexOf(nextIndex) !== -1 &&
        terrain[nextIndex] !== playerIndex
      ) {
        moveWeight += armies[nextIndex] + 2;
      }
    }
    return moveWeight;
  };

  heuristic = (start, end, game) => game.dist(start, end);

  // insert tile into priority queue for dijkstra's
  insert = (array, index, weights) => {
    let added = false;
    for (let i = 0; i < array.length; ++i) {
      if (weights[index] < weights[array[i]]) {
        array.splice(i, 0, index);
        added = true;
        break;
      }
    }
    if (!added) {
      array.push(index);
    }
  };

  // insert tile into priority queue for astar
  aInsert = (array, index, targetIndex, weights, game) => {
    let added = false;
    for (let i = 0; i < array.length; ++i) {
      if (
        weights[index] + this.heuristic(index, targetIndex, game) <
        weights[array[i]] + this.heuristic(array[i], targetIndex, game)
      ) {
        array.splice(i, 0, index);
        added = true;
        break;
      }
    }
    if (!added) {
      array.push(index);
    }
  };

  printPath = (game) => {
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
      if (i === this.targetPath.slice(-1)[0]) {
        grid += 'O'.green;
      } else if (i === this.targetPath[0]) {
        grid += 'O'.red;
      } else if (this.targetPath.indexOf(i) !== -1) {
        grid += 'O'.white;
      } else if (
        (game.terrain[i] === Game.TILE_FOG_OBSTACLE &&
          game.cities.indexOf(i) === -1) ||
        // game.terrain[i] === Game.TILE_MOUNTAIN
        game.mountains.has(i)
      ) {
        grid += 'X'.gray;
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

// const getTargetPath = (headIndex, targetIndex, terrain) => {
//   const moves = [-1, 1, -width, width];

//   // go toward a specific this.targetIndex if specified
//   if (this.targetPath.length > 0) {
//     console.log();
//     console.log(`surrounding this.targetIndex weights`);
//     const bestDist = moves
//       .map((move) => this.headIndex + move)
//       .reduce(
//         (min, endIndex) => {
//           let weight = 0;
//           let distToTarget = dist(endIndex, this.targetIndex);
//           weight += distToTarget;

//           // overweight previously visited squares
//           if (this.currPath.has(endIndex)) {
//             weight += size * this.currPath.get(endIndex);
//           }

//           // overweight main this.targetIndex if helper this.targetIndex is current
//           if (/* helperTarget !== -1 && */ endIndex === this.targetIndex) {
//             weight += size * size;
//           }

//           // underweight my tiles
//           // overweight other tiles
//           const semiPerimeter = width + height;
//           if (terrain[endIndex] === this.playerIndex) {
//             weight -= armies[endIndex] / (semiPerimeter - distToTarget);
//           } else {
//             weight += armies[endIndex];
//           }

//           // underweight this.targetIndex
//           if (endIndex === this.targetIndex) {
//             weight = Number.MIN_SAFE_INTEGER;
//           }

//           console.log(
//             `direction: ${endIndex - this.headIndex} weight: ${weight} freq: ${
//               this.currPath[endIndex]
//             }`
//           );
//           if (weight < min.weight) {
//             return { endIndex: endIndex, weight: weight };
//           } else {
//             return min;
//           }
//         },
//         { weight: Number.MAX_SAFE_INTEGER }
//       );
//     nextIndex = bestDist.endIndex;
//     console.log();
//   }
// };

module.exports = Target;
