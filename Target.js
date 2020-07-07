// terrain constants
const TILE_EMPTY = -1;
const TILE_MOUNTAIN = -2;
const TILE_FOG = -3;
const TILE_FOG_OBSTACLE = -4;

class Target {
  constructor() {
    this.target = -1;
    this.targetPath = [];
    this.targetPathSum = 0;
    this.targetType = '';
  }

  hasTarget(
    { playerIndex, headIndex, headSize, eDist },
    {
      turn,
      crown,
      cities,
      width,
      armies,
      terrain,
      foundGenerals,
      numOwnedCities,
    }
  ) {
    // true if currently targeting
    if (this.target !== -1) {
      if (terrain[this.target] === playerIndex) {
        this.target = -1;
      } else {
        return true;
      }
    }

    // always target nearby enemies
    const closeEnemy = terrain.reduce((closest, tile, index) => {
      if (tile !== playerIndex && tile >= 0 && eDist(crown, index, width) < 7) {
        if (closest === -1) {
          return index;
        } else {
          return eDist(crown, index, width) < eDist(crown, closest, width)
            ? index
            : closest;
        }
      } else {
        return closest;
      }
    }, -1);
    if (closeEnemy !== -1 && this.target !== closeEnemy) {
      this.target = closeEnemy;
      this.targetType = 'close enemy';
      return true;
    }

    // if not busy target enemy crown
    if (this.target === -1) {
      if (foundGenerals.length > 0) {
        this.target = foundGenerals[0];
        this.targetType = 'crown';
        return true;
      }
    }

    // if not busy target enemy territory
    if (
      this.target === -1 &&
      terrain.some(
        (tile, index) =>
          tile !== playerIndex && tile >= 0 && reachableTile(index, width)
      )
    ) {
      enemyTerritory = terrain.reduce((closest, tile, index) => {
        if (tile !== playerIndex && tile >= 0 && reachableTile(index, width)) {
          if (closest === -1) {
            return index;
          } else {
            const tDist = eDist(crown, index, width);
            const cDist = eDist(crown, closest, width);
            return tDist < cDist ? index : closest;
          }
        }
      });
      this.target = enemyTerritory;
      this.targetType = 'enemy territory';
      return true;
    }

    // if not busy target cities
    if (
      this.target === -1 &&
      numOwnedCities < Math.floor(turn / 75) &&
      cities.length > numOwnedCities
    ) {
      this.target = cities
        .filter((city) => terrain[city] !== playerIndex)
        .reduce((min, c) =>
          eDist(crown, c, width) < eDist(crown, min, width) ? c : min
        );
      this.targetType = 'city';
      return true;
    }

    // no targets
    return false;
  }

  getNextIndex(
    { playerIndex, headIndex },
    { cities, width, height, armies, terrain }
  ) {
    // insert tile into priority queue for dijkstra's
    const insert = (array, index, weights) => {
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

    // calculate path to target with dijkstra's
    const dijkstra = (start, end) => {
      let prev = new Map();
      let weights = terrain.map((tile) => Number.MAX_SAFE_INTEGER);
      weights[start] = 1;

      let visited = new Set();
      let pqueue = [start];
      const moves = [-1, 1, -width, width];
      while (pqueue.length > 0) {
        const currIndex = pqueue.shift();

        // terminate search if target is found
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

          // add weight to unknown obstacles
          if (terrain[nextIndex] === TILE_FOG_OBSTACLE) {
            moveWeight += 40;
          }

          // add weight to cities
          if (
            cities.indexOf(nextIndex) !== -1 &&
            terrain[nextIndex] !== playerIndex
          ) {
            moveWeight += armies[nextIndex];
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
            insert(pqueue, nextIndex, weights);
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

    // calculate path if no path is set
    if (this.targetPath.length === 0) {
      console.log(`calculating path with dijkstra's`);
      this.targetPath = dijkstra(headIndex, this.target);
      this.targetPathSum = this.targetPath.reduce(
        (sum, index) => sum + armies[index],
        0
      );
    }

    return this.targetPath.shift();
  }
}

// const getTargetPath = (headIndex, targetIndex, terrain) => {
//   const moves = [-1, 1, -width, width];

//   // go toward a specific this.target if specified
//   if (this.target !== -1) {
//     console.log();
//     console.log(`surrounding this.target weights`);
//     const bestDist = moves
//       .map((move) => this.headIndex + move)
//       .reduce(
//         (min, endIndex) => {
//           let weight = 0;
//           let distToTarget = eDist(endIndex, this.target);
//           weight += distToTarget;

//           // overweight previously visited squares
//           if (this.currPath.has(endIndex)) {
//             weight += size * this.currPath.get(endIndex);
//           }

//           // overweight main this.target if helper this.target is current
//           if (/* helperTarget !== -1 && */ endIndex === this.target) {
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

//           // underweight this.target
//           if (endIndex === this.target) {
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
