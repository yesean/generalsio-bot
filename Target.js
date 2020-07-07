// terrain constants
const TILE_EMPTY = -1;
const TILE_MOUNTAIN = -2;
const TILE_FOG = -3;
const TILE_FOG_OBSTACLE = -4;

class Target {}

// insert tile into priority queue
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

const dijkstra = (
  start,
  end,
  terrain,
  armies,
  cities,
  playerIndex,
  width,
  height
) => {
  let prev = new Map();
  let weights = terrain.map((t) => Number.MAX_SAFE_INTEGER);
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
      // console.log(pqueue.map((t) => ({ index: t, weight: weights[t] })));
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
  while (prevIndex) {
    path.unshift(prevIndex);
    prevIndex = prev.get(prevIndex);
  }
  return path;
};

const getTargetPath = (headIndex, targetIndex, terrain) => {
  let buffer = 2;
  if (targetingEnemyTerritory && eDist(this.headIndex, this.target) > 1) {
    buffer = 15 * armies[this.target];
    this.target;
  }

  // // if main this.target is set, this.target high tiles if headSize isn't enough
  // if (this.target !== -1) {
  //   console.log(
  //     `main targeting ${
  //       closeEnemy !== -1
  //         ? 'close enemy'
  //         : foundGenerals.length > 0
  //         ? 'enemy crown'
  //         : enemyTerritory !== -1
  //         ? 'enemy territory'
  //         : 'city'
  //     } ${this.target} (costs ${armies[this.target] + 2} troops) (${eDist(
  //       crown,
  //       mainTargettarget
  //     )} units away from crown)`
  //   );
  //   console.log(`headSize has ${headSize} troops`);
  //   if (helperTarget === -1 && headSize < armies[this.target] + buffer) {
  //     helperTarget = myArmy
  //       .filter((i) => i !== this.headIndex)
  //       .reduce((best, i) => {
  //         if (armies[i] <= 1) {
  //           return best;
  //         } else {
  //           const iValue = (2 * armies[i]) / eDist(this.headIndex, i);
  //           const bValue = (2 * armies[best]) / eDist(this.headIndex, best);
  //           return iValue > bValue ? i : best;
  //         }
  //       });
  //     this.currPath = [];
  //     console.log(`resetting for helper`);

  //     console.log(
  //       `main this.target too large (requires ${
  //         armies[this.target] - headSize + 2
  //       } more troops)`
  //     );
  //   }
  // }

  // let this.target = -1;
  // if (helperTarget !== -1) {
  //   this.target = helperTarget;
  //   console.log(
  //     `currently targeting ${helperTarget} (provides ${armies[helperTarget]} troops)`
  //   );
  // } else if (this.target !== -1) {
  //   this.target = mainTarget;
  //   this.target;
  // }
  const moves = [-1, 1, -width, width];

  // go toward a specific this.target if specified
  if (this.target !== -1) {
    console.log();
    console.log(`surrounding this.target weights`);
    const bestDist = moves
      .map((move) => this.headIndex + move)
      .reduce(
        (min, endIndex) => {
          let weight = 0;
          let distToTarget = eDist(endIndex, this.target);
          weight += distToTarget;

          // overweight previously visited squares
          if (this.currPath.has(endIndex)) {
            weight += size * this.currPath.get(endIndex);
          }

          // overweight main this.target if helper this.target is current
          if (/* helperTarget !== -1 && */ endIndex === this.target) {
            weight += size * size;
          }

          // underweight my tiles
          // overweight other tiles
          const semiPerimeter = width + height;
          if (terrain[endIndex] === this.playerIndex) {
            weight -= armies[endIndex] / (semiPerimeter - distToTarget);
          } else {
            weight += armies[endIndex];
          }

          // underweight this.target
          if (endIndex === this.target) {
            weight = Number.MIN_SAFE_INTEGER;
          }

          console.log(
            `direction: ${endIndex - this.headIndex} weight: ${weight} freq: ${
              this.currPath[endIndex]
            }`
          );
          if (weight < min.weight) {
            return { endIndex: endIndex, weight: weight };
          } else {
            return min;
          }
        },
        { weight: Number.MAX_SAFE_INTEGER }
      );
    nextIndex = bestDist.endIndex;
    console.log();
  }
};

module.exports = dijkstra;
