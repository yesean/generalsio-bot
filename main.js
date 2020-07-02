// only for the first time
// set username for bot
// socket.emit("set_username", user_id, username);

// main.js
const io = require('socket.io-client');
const { verify } = require('crypto');

const socket = io('http://botws.generals.io');
//
// define user id and username
const user_id = 'seans_bot';
const username = '[Bot] seans_bot';

// join custom game
const custom_game_id = 'benis';

socket.on('disconnect', () => {
  console.error('Disconnected from server.');
  process.exit(1);
});

socket.on('connect', () => {
  console.log('Connected to server.');
  socket.emit('join_private', custom_game_id, user_id);
  socket.emit('set_force_start', custom_game_id, true);
  console.log(
    `Joined custom game at http://bot.generals.io/games/${encodeURIComponent(
      custom_game_id
    )}`
  );
});

// terrain constants
const TILE_EMPTY = -1;
const TILE_MOUNTAIN = -2;
const TILE_FOG = -3;
const TILE_FOG_OBSTACLE = -4;

// game data
let playerIndex;
let generals;
let cities = [];
let map = [];
let index = -1;
let currPath = [];
let moves;
let flip = false;
let resetHead = false;
let target = -1;
let highTiles = [];
let helperTarget = -1;
let mainTarget = -1;
let mainTargetTurnDuration = 0;
let head;
let foundGenerals = [];
let terrain;
let width, height;

// filter out unreachable cities
reachableTile = (tile) => {
  return (
    terrain[tile - 1] >= TILE_EMPTY ||
    terrain[tile + 1] >= TILE_EMPTY ||
    terrain[tile - width] >= TILE_EMPTY ||
    terrain[tile + width] >= TILE_EMPTY ||
    terrain[tile] >= 0
  );
};

eDist = (s, e) =>
  Math.sqrt(
    Math.pow(Math.floor(e / width) - Math.floor(s / width), 2) +
      Math.pow((e % width) - (s % width), 2)
  );

mDist = (s, e) =>
  Math.abs(Math.floor(e / width) - Math.floor(s / width)) +
  Math.abs((e % width) - (s % width));

patch = (old, diff) => {
  let out = [];
  let i = 0;
  while (i < diff.length) {
    // matching
    if (diff[i]) {
      out.push(...old.slice(out.length, out.length + diff[i]));
    }
    ++i;
    // mismatching
    if (i < diff.length && diff[i]) {
      out.push(...diff.slice(i + 1, i + 1 + diff[i]));
    }
    i += 1 + diff[i];
  }
  return out;
};

socket.on('game_start', (data) => {
  playerIndex = data.playerIndex;
  let replay_url = `http://bot.generals.io/replays/${encodeURIComponent(
    data.replay_id
  )}`;
  console.log(
    `Game starting! The replay will be available after the game at ${replay_url}`
  );
});

socket.on('game_update', (data) => {
  const turn = data.turn;
  console.log(`at turn ${turn}`);

  cities = patch(cities, data.cities_diff);
  map = patch(map, data.map_diff);
  generals = data.generals;

  // map dimensions
  width = map[0];
  height = map[1];
  const size = width * height;

  // update army values
  const armies = map.slice(2, size + 2);

  // update terrain values
  terrain = map.slice(size + 2, size + 2 + size);

  // set crown location
  const crown = generals[playerIndex];

  // initialize index
  if (index === -1) {
    index = crown;
    // weightMap[crown] = 0;
  }

  head = armies[index];

  cities = cities.filter((c) => reachableTile(c));
  const myCities = cities.filter((c) => terrain[c] === playerIndex);

  // update game state
  const [myArmy, rowSum, colSum] = terrain.reduce(
    (acc, t, i) => {
      if (t === playerIndex) {
        acc[0].push(i);
      }
      acc[1] += Math.floor(i / width);
      acc[2] += i % width;
      return acc;
    },
    [[], 0, 0]
  );
  const highTileStack = myArmy.slice().sort((a, b) => armies[a] - armies[b]);

  const myScore = data.scores.find((s) => s.i === playerIndex);
  const numTroops = myScore.total;
  const numTiles = myScore.tiles;
  const avgTroopSize = Math.floor(numTroops / numTiles);

  const avgRow = Math.floor(rowSum / numTiles);
  const avgCol = Math.floor(colSum / numTiles);
  const center = avgRow * width + avgCol; // based on center of army

  // reset head if helper target is occupied
  if (
    index === helperTarget ||
    (helperTarget !== -1 && mainTarget !== -1 && head > armies[mainTarget] + 2)
  ) {
    helperTarget = -1;
    currPath = [];
    console.log('helper targeting finished');
  }

  // reset head if main target is captured
  if (mainTarget !== -1 && terrain[mainTarget] === playerIndex) {
    if (foundGenerals.length > 0 && mainTarget === foundGenerals[0]) {
      console.log(`captured crown at index ${foundGenerals.shift()}!`);
    }
    mainTarget = -1;
    // mainTargetTurnDuration = 0;
    currPath = [];
    console.log('main targeting finished');
  }

  // if (mainTargetTurnDuration === 50) {
  //   mainTarget = -1;
  // }

  // if (mainTarget !== -1) {
  //   mainTargetTurnDuration++;
  // }

  // cache located generals
  for (const g of generals) {
    if (g !== -1 && g !== crown && foundGenerals.indexOf(g) === -1) {
      foundGenerals.push(g);
    }
  }

  console.log(`generals: ${generals}`);
  console.log(`found generals: ${foundGenerals}`);

  console.log(`head: ${head}`);
  console.log(`avg troop size: ${avgTroopSize}`);
  console.log(`index: ${index}`);
  console.log(`terrain[index]: ${terrain[index]}`);
  console.log(`playerindex: ${playerIndex}`);
  console.log(`head < avgtroop: ${head < avgTroopSize}`);
  console.log(
    `terrain[index] !== playerindex: ${terrain[index] !== playerIndex}`
  );
  if (head < avgTroopSize || terrain[index] !== playerIndex) {
    resetHead = true;
  }

  // use largest tile as starting index unless current head is still available
  if (resetHead) {
    let nextHead;
    do {
      nextHead = highTileStack.pop();
    } while (nextHead === helperTarget || nextHead === index);
    index = nextHead;
    currPath = [];
    currPath[index] = 1;
    head = armies[index];
    console.log(`resetting head to ${head}`);
    resetHead = false;
  }

  const row = Math.floor(index / width);
  const col = index % width;

  const up = avgRow < Math.floor(height / 2);
  const left = avgCol < Math.floor(width / 2);
  let vMoves = up ? [-width, width] : [width, -width];
  let hMoves = left ? [-1, 1] : [1, -1];
  if (flip) {
    moves = [vMoves[0], hMoves[0], vMoves[1], hMoves[1]];
  } else {
    moves = [hMoves[0], vMoves[0], hMoves[1], vMoves[1]];
  }
  flip = !flip;

  // filter out illegal moves
  if (row === 0) {
    moves = moves.filter((m) => m !== -width);
  }
  if (row === height - 1) {
    moves = moves.filter((m) => m !== width);
  }
  if (col === 0) {
    moves = moves.filter((m) => m !== -1);
  }
  if (col === width - 1) {
    moves = moves.filter((m) => m !== 1);
  }

  // filter out moves into mountains
  moves = moves.filter((m) => terrain[index + m] !== TILE_MOUNTAIN);

  let bestEndIndex;
  const bestMove = moves
    .map((move) => {
      let endIndex = index + move;
      let weight = 0;

      // add weight to previous squares in path
      if (typeof currPath[endIndex] !== 'undefined') {
        weight += size * currPath[endIndex];
      }

      // avoid stepping over 1s
      // underweight blank tiles
      if (terrain[endIndex] === playerIndex && armies[endIndex] === 1) {
        weight += size;
      } else if (
        terrain[endIndex] === TILE_EMPTY &&
        cities.indexOf(endIndex) === -1
      ) {
        weight -= size;
      }

      // if city mine, decrease its weight
      // if not, avoid unless capturable
      if (cities.indexOf(endIndex) >= 0) {
        if (terrain[endIndex] === playerIndex) {
          weight -= armies[endIndex];
        } else {
          if (armies[index] > armies[endIndex] + 2) {
            weight -= 2 * size;
          } else {
            weight += size * size;
          }
        }
      }

      // underweight reasonably high tiles if head is small
      if (
        terrain[endIndex] === playerIndex &&
        armies[endIndex] > 1 &&
        head < avgTroopSize
      ) {
        weight -= armies[endIndex];
      }

      // underweight low enemy tiles
      if (terrain[endIndex] !== playerIndex && terrain[endIndex] >= 0) {
        // after turn 200, underweight enemy tiles
        if (turn > 200) {
          weight -= size / armies[endIndex];
        } else {
          weight += armies[endIndex];
        }
      }

      const distToCenter = Math.abs(row - avgRow) + Math.abs(col - avgCol);
      weight -= distToCenter;

      return {
        endIndex: endIndex,
        weight: weight,
      };
    })
    .reduce(
      (min, move) => {
        return move.weight < min.weight ? move : min;
      },
      { weight: Number.MAX_SAFE_INTEGER }
    );
  bestEndIndex = bestMove.endIndex;

  // used to determine the number troops needed for takeover
  let targetingEnemyTerritory = false;

  // always stop nearby enemies
  const closeEnemy = terrain.reduce((closest, t, i) => {
    if (t !== playerIndex && t >= 0 && eDist(crown, i) < 10) {
      if (closest === -1) {
        return i;
      } else {
        return eDist(crown, i) < eDist(crown, closest) ? i : closest;
      }
    } else {
      return closest;
    }
  }, -1);
  if (closeEnemy !== -1 && mainTarget !== closeEnemy) {
    console.log(`stopping close enemies at index ${closeEnemy}`);
    currPath = [];
    mainTarget = closeEnemy;
  }

  // if possible try to attack enemy crown
  if (mainTarget === -1) {
    if (foundGenerals.length > 0) {
      console.log(`resetting for op crown`);
      currPath = [];
      mainTarget = foundGenerals[0];
    }
  }

  // if possible try to target enemy territory
  let enemyTerritory;
  if (mainTarget === -1) {
    enemyTerritory = terrain.reduce((closest, tile, i) => {
      if (tile !== playerIndex && tile >= 0 && reachableTile(i)) {
        if (closest === -1) {
          return i;
        } else {
          return eDist(index, i) < eDist(index, closest) ? i : closest;
        }
      } else {
        return closest;
      }
    }, -1);
    if (enemyTerritory !== -1) {
      console.log(`resetting for enemy territory`);
      targetingEnemyTerritory = true;
      currPath = [];
      mainTarget = enemyTerritory;
      console.log(
        `enemy territory is ${eDist(
          index,
          enemyTerritory
        )} units away from index`
      );
    }
  }

  // if possible target cities
  if (mainTarget === -1) {
    const numOwnedCities = myCities.length;
    if (
      numOwnedCities < Math.floor(turn / 75) &&
      cities.length > numOwnedCities
    ) {
      currPath = [];
      console.log(`resetting for cities`);
      mainTarget = cities
        .filter((c) => terrain[c] !== playerIndex && c !== -1)
        .reduce((min, c) => (eDist(crown, c) < eDist(crown, min) ? c : min));
    }
  }

  // if head is too small and far away, reset head
  if (
    mainTarget !== -1 &&
    head < armies[mainTarget] + 2 &&
    eDist(index, mainTarget) < 2 &&
    eDist(crown, index) > 10
  ) {
    resetHead = true;
    console.log(`main target too large, resetting head`);
    console.log();
    return;
  }

  // if target cannot be seen anymore, abandon
  // if (armies[mainTarget] < 0) {
  //   mainTarget = -1;
  //   targetingEnemyTerritory = false;
  // }

  let buffer = 2;
  if (targetingEnemyTerritory && eDist(index, mainTarget) > 1) {
    buffer = 15 * armies[mainTarget];
  }

  // if main target is set, target high tiles if head isn't enough
  if (mainTarget !== -1) {
    console.log(
      `main targeting ${
        closeEnemy !== -1
          ? 'close enemy'
          : foundGenerals.length > 0
          ? 'enemy crown'
          : enemyTerritory !== -1
          ? 'enemy territory'
          : 'city'
      } ${mainTarget} (costs ${armies[mainTarget] + 2} troops) (${eDist(
        crown,
        mainTarget
      )} units away from crown)`
    );
    console.log(`head has ${head} troops`);
    if (helperTarget === -1 && head < armies[mainTarget] + buffer) {
      helperTarget = myArmy
        .filter((i) => i !== index)
        .reduce((best, i) => {
          if (armies[i] <= 1) {
            return best;
          } else {
            const iValue = (2 * armies[i]) / eDist(index, i);
            const bValue = (2 * armies[best]) / eDist(index, best);
            return iValue > bValue ? i : best;
          }
        });
      currPath = [];
      console.log(`resetting for helper`);

      console.log(
        `main target too large (requires ${
          armies[mainTarget] - head + 2
        } more troops)`
      );
    }
  }

  let target = -1;
  if (helperTarget !== -1) {
    target = helperTarget;
    console.log(
      `currently targeting ${helperTarget} (provides ${armies[helperTarget]} troops)`
    );
  } else if (mainTarget !== -1) {
    target = mainTarget;
  }
  const targetRow = Math.floor(target / width);
  const targetCol = target % width;

  // go toward a specific target if specified
  if (target !== -1) {
    console.log();
    console.log(`surrounding target weights`);
    const bestDist = moves
      .map((move) => index + move)
      .reduce(
        (min, endIndex) => {
          let weight = 0;
          let distToTarget = eDist(endIndex, target);
          weight += distToTarget;

          // overweight previously visited squares
          if (typeof currPath[endIndex] !== 'undefined') {
            weight += size * currPath[endIndex];
          }

          // overweight main target if helper target is current
          if (helperTarget !== -1 && endIndex === mainTarget) {
            weight += size * size;
          }

          // underweight my tiles
          // overweight other tiles
          const semiPerimeter = width + height;
          if (terrain[endIndex] === playerIndex) {
            weight -= armies[endIndex] / (semiPerimeter - distToTarget);
          } else {
            weight += armies[endIndex];
          }

          // underweight target
          if (endIndex === target) {
            weight = Number.MIN_SAFE_INTEGER;
          }

          console.log(
            `direction: ${endIndex - index} weight: ${weight} freq: ${
              currPath[endIndex]
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
    bestEndIndex = bestDist.endIndex;
  }
  console.log();

  if (typeof currPath[bestEndIndex] === 'undefined') {
    currPath[bestEndIndex] = 1;
  } else {
    currPath[bestEndIndex]++;
  }

  socket.emit('attack', index, bestEndIndex);
  console.log(`going to index ${bestEndIndex}`);
  index = bestEndIndex;
  console.log();
});

leaveGame = () => {
  socket.emit('leave_game');
  console.log('left game');
  socket.disconnect();
};

socket.on('game_lost', () => leaveGame());
socket.on('game_won', () => leaveGame());
