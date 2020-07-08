const { reset } = require('nodemon');

// terrain constants
const TILE_EMPTY = -1;
const TILE_MOUNTAIN = -2;
const TILE_FOG = -3;
const TILE_FOG_OBSTACLE = -4;

class Target {
  constructor() {
    this.startIndex = -1;
    this.targetIndex = -1;
    this.targetPath = [];
    this.targetType = '';
    this.gatherTargetIndex = -1;
    this.gatherPath = [];
  }

  getNextIndex = (
    { playerIndex, headIndex, headSize, eDist, resetHead },
    { cities, width, height, armies, terrain, avgTileSize }
  ) => {
    // reset path if mountain is hit
    if (
      this.gatherPath.length > 0 &&
      terrain[this.gatherPath[0] === TILE_MOUNTAIN]
    ) {
      console.log(`resetting path, initial path hit mountain`);
      this.setPath(
        playerIndex,
        headSize,
        eDist,
        resetHead,
        cities,
        width,
        height,
        armies,
        terrain,
        avgTileSize,
        headIndex,
        this.gatherTargetIndex
      );
    } else if (
      this.targetPath.length > 0 &&
      terrain[this.targetPath[0]] === TILE_MOUNTAIN
    ) {
      console.log(`resetting path, initial path hit mountain`);
      this.startIndex = headIndex;
      this.setTargetPath(
        playerIndex,
        headSize,
        eDist,
        resetHead,
        cities,
        width,
        height,
        armies,
        terrain,
        avgTileSize
      );
    }

    // if current path isn't enough, gather troops on path
    if (
      this.gatherTargetIndex === -1 &&
      this.getPathSum(playerIndex, armies, terrain) <
        armies[this.targetIndex] + 2
    ) {
      console.log(`calculating gather`);
      const [pathRow, pathCol] = this.targetPath
        .reduce(
          (pos, index) => {
            pos[0] += Math.floor(index / width);
            pos[1] += index % width;
            return pos;
          },
          [0, 0]
        )
        .map((pos) => Math.floor(pos / this.targetPath.length));
      console.log(`pathrow: ${pathRow}, pathcol: ${pathCol}`);
      const pathCenter = pathRow * width + pathCol;
      const gatherStartIndex = terrain.reduce((best, tile, index) => {
        if (
          tile === playerIndex &&
          this.targetPath.indexOf(index) === -1 &&
          armies[index] > 1
        ) {
          if (best === -1) {
            return index;
          } else {
            const tileWeight = armies[index];
            // Math.pow(armies[index], 2) / eDist(pathCenter, index);
            const bestWeight = armies[best];
            // Math.pow(armies[best], 2) / eDist(pathCenter, best);
            return tileWeight > bestWeight ? index : best;
          }
        } else {
          return best;
        }
      }, -1);
      resetHead(gatherStartIndex);
      this.gatherTargetIndex = this.targetPath.reduce((min, index) =>
        eDist(gatherStartIndex, index) < eDist(gatherStartIndex, min)
          ? index
          : min
      );
      console.log(
        `gathering from ${gatherStartIndex} to ${this.gatherTargetIndex}`
      );
      this.setGatherPath(
        playerIndex,
        headSize,
        eDist,
        resetHead,
        cities,
        width,
        height,
        armies,
        terrain,
        avgTileSize,
        gatherStartIndex,
        this.gatherTargetIndex
      );
    }

    // update start index as targetPath progresses
    if (this.gatherPath.length === 0) {
      this.startIndex = this.targetPath[0];
    }
    return this.gatherPath.shift() || this.targetPath.shift();
  };

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

  // calculate path to targetIndex with dijkstra's
  dijkstra = (
    start,
    end,
    playerIndex,
    armies,
    terrain,
    cities,
    width,
    height,
    gather = false
  ) => {
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
          terrain[nextIndex] === TILE_MOUNTAIN ||
          nextIndex < 0 ||
          nextIndex >= width * height ||
          Math.abs((nextIndex % width) - (currIndex % width)) > 1
        ) {
          continue;
        }
        let moveWeight = weights[currIndex] + 1;

        // when gathering, favor my own tiles and blanks
        if (gather) {
          if (
            (terrain[nextIndex] === TILE_EMPTY &&
              cities.indexOf(nextIndex) === -1) ||
            terrain[nextIndex] === playerIndex
          ) {
            moveWeight += width * height - armies[nextIndex];
          } else {
            moveWeight += 2 * width * height;
          }
        } else {
          // add weight to unknown obstacles
          if (terrain[nextIndex] === TILE_FOG_OBSTACLE) {
            moveWeight += 50;
          }

          // add weight to cities
          if (
            cities.indexOf(nextIndex) !== -1 &&
            terrain[nextIndex] !== playerIndex
          ) {
            moveWeight += armies[nextIndex] + 2;
          }
        }

        // update path weight to nextIndex if lower than current
        if (moveWeight < weights[nextIndex]) {
          weights[nextIndex] = moveWeight;
          prev.set(nextIndex, currIndex);
        }

        // insert index into priority queue
        const position = pqueue.indexOf(nextIndex);
        if (position !== -1) {
          pqueue.splice(position, 1);
        }

        // only visit unvisited tiles
        if (!visited.has(nextIndex)) {
          this.insert(pqueue, nextIndex, weights);
        }
      }
    }

    // determine shortest path
    const path = [];
    let prevIndex = end;
    while (prevIndex !== start) {
      path.unshift(prevIndex);
      prevIndex = prev.get(prevIndex);
    }
    return path;
  };

  hasTarget = (
    { playerIndex, headIndex, headSize, eDist, reachableTile, resetHead },
    {
      turn,
      crown,
      cities,
      width,
      height,
      armies,
      terrain,
      foundGenerals,
      numOwnedCities,
      avgTileSize,
    }
  ) => {
    // reset if gatherTargetIndex or targetIndex is aqcquired
    if (this.gatherTargetIndex !== -1) {
      if (headIndex === this.gatherTargetIndex) {
        this.gatherTargetIndex = -1;
        console.log(`finished gathering`);
      } else {
        console.log(`gathering`);
        return true;
      }
    }
    if (this.targetIndex !== -1) {
      if (terrain[this.targetIndex] === playerIndex) {
        this.targetIndex = -1;
        this.targetType = '';
        console.log(`finished targeting`);
      } else {
        // reset targetPath if head isnt big enough
        if (headIndex === this.targetIndex) {
          this.startIndex = resetHead();
          this.setTargetPath(
            playerIndex,
            headSize,
            eDist,
            resetHead,
            cities,
            width,
            height,
            armies,
            terrain,
            avgTileSize
          );
        }
        console.log(
          `targeting ${this.targetType} at index ${this.targetIndex}`
        );
        return true;
      }
    }

    const closeEnemy = terrain.reduce((closest, tile, index) => {
      if (tile !== playerIndex && tile >= 0 && eDist(crown, index) < 10) {
        if (closest === -1) {
          return index;
        } else {
          return eDist(crown, index) < eDist(crown, closest) ? index : closest;
        }
      } else {
        return closest;
      }
    }, -1);
    // always targetIndex nearby enemies
    if (closeEnemy !== -1 && this.targetType !== 'close enemy') {
      this.targetIndex = closeEnemy;
      this.targetType = 'close enemy';
    } else if (foundGenerals.length > 0) {
      // if not busy targetIndex enemy crown
      this.targetIndex = foundGenerals[0];
      this.targetType = 'crown';
    } else if (
      // if not busy targetIndex cities
      numOwnedCities < Math.floor(turn / 75) &&
      cities.length > numOwnedCities
    ) {
      this.targetIndex = cities
        .filter((city) => terrain[city] !== playerIndex)
        .reduce((min, c) => (eDist(crown, c) < eDist(crown, min) ? c : min));
      this.targetType = 'city';
    } else if (
      // if not busy targetIndex enemy territory
      terrain.some(
        (tile, index) =>
          tile !== playerIndex && tile >= 0 && reachableTile(index)
      )
    ) {
      const enemyTerritory = terrain.reduce((closest, tile, index) => {
        if (tile !== playerIndex && tile >= 0 && reachableTile(index)) {
          if (closest === -1) {
            return index;
          } else {
            const tDist = eDist(headIndex, index);
            const cDist = eDist(headIndex, closest);
            return tDist < cDist ? index : closest;
          }
        } else {
          return closest;
        }
      }, -1);
      this.targetIndex = enemyTerritory;
      this.targetType = 'enemy territory';
    }

    if (this.targetIndex !== -1) {
      console.log(`targeting ${this.targetType} at index ${this.targetIndex}`);
      // reset head if head is too far and small from targetIndex
      if (
        terrain[headIndex] !== playerIndex ||
        headSize < 2 ||
        armies[this.targetIndex] / headSize > 5 ||
        eDist(headIndex, this.targetIndex, width) > 15
      ) {
        console.log(`resetting startIndex`);
        this.startIndex = resetHead();
      } else {
        this.startIndex = headIndex;
      }
      this.setTargetPath(
        playerIndex,
        headSize,
        eDist,
        resetHead,
        cities,
        width,
        height,
        armies,
        terrain,
        avgTileSize
      );
    }

    // no targets
    return this.targetIndex !== -1;
  };

  setTargetPath = (
    playerIndex,
    headSize,
    eDist,
    resetHead,
    cities,
    width,
    height,
    armies,
    terrain,
    avgTileSize
  ) => {
    // calculate path
    console.log(
      `running dijkstra's from ${this.startIndex} to ${this.targetIndex}`
    );
    this.targetPath = this.dijkstra(
      this.startIndex,
      this.targetIndex,
      playerIndex,
      armies,
      terrain,
      cities,
      width,
      height
    );
  };

  setGatherPath = (
    playerIndex,
    headSize,
    eDist,
    resetHead,
    cities,
    width,
    height,
    armies,
    terrain,
    avgTileSize,
    start,
    end
  ) => {
    // calculate path
    console.log(`running dijkstra's from ${start} to ${end}`);
    this.gatherPath = this.dijkstra(
      start,
      end,
      playerIndex,
      armies,
      terrain,
      cities,
      width,
      height,
      true
    );
  };

  getPathSum = (playerIndex, armies, terrain) => {
    // calculate how much head will have on arrival
    let sum = armies[this.startIndex];
    for (const index of this.targetPath) {
      if (index !== this.targetIndex) {
        if (terrain[index] === playerIndex || terrain[index] === TILE_FOG) {
          sum += armies[index] - 1;
        } else if (terrain[index] >= 0) {
          sum -= armies[index] + 1;
        } else if (terrain[index] === TILE_FOG_OBSTACLE) {
          sum -= 50 + 1;
        }
      }
    }
    console.log(`pathsum: ${sum}, armies[target]: ${armies[this.targetIndex]}`);
    return sum;
  };
}

// const getTargetPath = (headIndex, targetIndex, terrain) => {
//   const moves = [-1, 1, -width, width];

//   // go toward a specific this.targetIndex if specified
//   if (this.targetIndex !== -1) {
//     console.log();
//     console.log(`surrounding this.targetIndex weights`);
//     const bestDist = moves
//       .map((move) => this.headIndex + move)
//       .reduce(
//         (min, endIndex) => {
//           let weight = 0;
//           let distToTarget = eDist(endIndex, this.targetIndex);
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
