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
  const width = map[0];
  const height = map[1];
  const size = width * height;

  // update army values
  const armies = map.slice(2, size + 2);

  // update terrain values
  const terrain = map.slice(size + 2, size + 2 + size);

  // set crown location
  const crown = generals[playerIndex];

  // initialize index
  if (index === -1) {
    index = crown;
    // weightMap[crown] = 0;
  }

  head = armies[index];

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
  cities = cities.filter((c) => reachableTile(c));

  // update game state
  const myArmy = terrain
    .map((t, i) => ({ tile: t, index: i }))
    .filter((t) => t.tile === playerIndex)
    .map((t) => t.index);
  const myCities = cities.filter((c) => terrain[c] === playerIndex);
  const numTroops = data.scores.find((s) => s.i === playerIndex).total;
  const numTiles = myArmy.length;
  const highTileStack = myArmy.slice().sort((a, b) => armies[a] - armies[b]);
  const myScore = data.scores.find((s) => s.i === playerIndex);
  const avgTroopSize = Math.floor(myScore.total / myScore.tiles);

  const avgRow = Math.floor(
    myArmy.reduce((sum, t) => sum + Math.floor(t / width), 0) / numTiles
  );
  const avgCol = Math.floor(
    myArmy.reduce((sum, t) => sum + (t % width), 0) / numTiles
  );
  const center = avgRow * width + avgCol; // based on center of army

  // reset head if head goes to one

  if (
    index === helperTarget ||
    (helperTarget !== -1 && mainTarget !== -1 && head > armies[mainTarget] + 2)
  ) {
    helperTarget = -1;
    currPath = [];
    console.log('helper targeting finished');
  }

  if (mainTarget !== -1 && terrain[mainTarget] === playerIndex) {
    mainTarget = -1;
    mainTargetTurnDuration = 0;
    currPath = [];
    console.log('main targeting finished');
  }

  // if (mainTargetTurnDuration === 50) {
  //   mainTarget = -1;
  // }

  // if (mainTarget !== -1) {
  //   mainTargetTurnDuration++;
  // }

  // get location of a viable opponent
  let opponent = generals.find(
    (g, i) => i !== playerIndex && g != -1 //&&
    // data.scores.find((s) => s.i === i).total + 100 < numTroops
  );

  console.log(`generals: ${generals}`);
  console.log(`opponent: ${opponent}`);
  const opRow = Math.floor(opponent / width);
  const opCol = opponent % width;
  let opponentSize;
  if (typeof opponent === 'undefined') {
    opponent = -1;
  } else {
    opponentSize = data.scores.find((s) => s.i !== playerIndex).total;
  }

  console.log(`head: ${head}`);
  console.log(`avg troop size: ${avgTroopSize}`);
  console.log(`index: ${index}`);
  console.log(`terrain[index]: ${terrain[index]}`);
  console.log(`playerindex: ${playerIndex}`);
  console.log(`head < avgtroop: ${head < avgTroopSize}`);
  console.log(`terr[ind] !== playerindex: ${terrain[index] !== playerIndex}`);
  if (head < avgTroopSize || terrain[index] !== playerIndex) {
    resetHead = true;
  }

  // use largest tile as starting index unless current head is still available
  if (resetHead) {
    let nextHead;
    do {
      nextHead = highTileStack.pop();
    } while (nextHead === helperTarget);
    index = nextHead;
    currPath = [];
    currPath[index] = 1;
    head = armies[index];
    console.log(`resetting head to ${head}`);
  }

  const row = Math.floor(index / width);
  const col = index % width;

  const up = avgRow < Math.floor(height / 2);
  const left = avgCol < Math.floor(width / 2);
  let vMoves = [-width, width];
  let hMoves = [-1, 1];
  moves = [];
  if (flip) {
    if (up) {
      moves.push(vMoves.pop());
    } else {
      moves.push(vMoves.shift());
    }
    if (left) {
      moves.push(hMoves.pop());
    } else {
      moves.push(hMoves.shift());
    }
    moves.push(vMoves.pop());
    moves.push(hMoves.pop());
  } else {
    if (left) {
      moves.push(hMoves.pop());
    } else {
      moves.push(hMoves.shift());
    }
    if (up) {
      moves.push(vMoves.pop());
    } else {
      moves.push(vMoves.shift());
    }
    moves.push(hMoves.pop());
    moves.push(vMoves.pop());
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

  eDist = (s, e) =>
    Math.sqrt(
      Math.pow(Math.floor(e / width) - Math.floor(s / width), 2) +
        Math.pow((e % width) - (s % width), 2)
    );

  mDist = (s, e) =>
    Math.abs(Math.floor(e / width) - Math.floor(s / width)) +
    Math.abs((e % width) - (s % width));

  // when possible try to attack enemy crown
  if (
    opponent !== -1 &&
    (mainTarget === -1 ||
      (mainTarget !== -1 && generals.indexOf(mainTarget) === -1))
  ) {
    console.log(`reseting for op crown`);
    currPath = [];
    mainTarget = opponent;
  }

  // target cities
  const numOwnedCities = myCities.length;
  if (
    mainTarget === -1 &&
    turn % 10 === 0 &&
    numOwnedCities < Math.floor(turn / 75) &&
    cities.length > numOwnedCities
  ) {
    currPath = [];
    console.log(`resetting for cities`);
    mainTarget = cities
      .filter((c) => terrain[c] !== playerIndex && c !== -1)
      .reduce((min, c) => (eDist(crown, c) < eDist(crown, min) ? c : min));
  }

  // try to target enemy territory
  let targetingEnemyTerritory = false;
  const enemyTerritory = terrain.reduce((min, tile, index) => {
    if (tile !== playerIndex && tile >= 0 && reachableTile(index)) {
      if (min === -1) {
        return index;
      } else {
        return armies[index] < armies[min] ? index : min;
      }
    } else {
      return min;
    }
  }, -1);
  if (enemyTerritory !== -1 && mainTarget === -1) {
    console.log(`resetting for enemy territory`);
    targetingEnemyTerritory = true;
    currPath = [];
    mainTarget = enemyTerritory;
  }

  // stop nearby enemies
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
  if (
    closeEnemy !== -1 &&
    (mainTarget === -1 || (mainTarget !== -1 && eDist(crown, mainTarget) > 10))
  ) {
    targetingEnemyTerritory = false;
    console.log(`stopping close enemies`);
    mainTarget = closeEnemy;
  }

  // const opponentDist = Math.abs(opponent - index);
  // if (
  //   (opponentDist === 1 || opponentDist === width) &&
  //   head > armies[opponent] + 2
  // ) {
  //   mainTarget = opponent;
  // }

  // if target cannot be seen anymore, abandon
  if (armies[mainTarget] < 0) {
    mainTarget = -1;
    targetingEnemyTerritory = false;
  }

  let buffer = 2;
  if (targetingEnemyTerritory) {
    buffer = 5 * armies[mainTarget];
  }

  // if main target is set, target high tiles if head isn't enough
  if (mainTarget !== -1) {
    console.log(
      `main targeting ${
        generals.indexOf(mainTarget) >= 0
          ? 'enemy crown'
          : cities.indexOf(mainTarget) >= 0
          ? 'city'
          : 'enemy territory'
      } ${mainTarget} (costs ${armies[mainTarget] + 2} troops) (${mDist(
        crown,
        mainTarget
      )} units away)`
    );
    console.log(`head has ${head} troops`);
    if (helperTarget === -1 && head < armies[mainTarget] + buffer) {
      let nextTarget;
      console.log(highTileStack.map((t) => armies[t]).join());
      do {
        nextTarget = highTileStack.pop();
      } while (nextTarget === index);
      helperTarget = nextTarget;
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
          if (typeof currPath[endIndex] !== 'undefined') {
            weight += size * currPath[endIndex];
          }
          if (helperTarget !== -1 && endIndex === mainTarget) {
            weight += size * size;
          }

          const semiPerimeter = width + height;
          if (terrain[endIndex] === playerIndex) {
            weight -= armies[endIndex] / (semiPerimeter - distToTarget);
          } else {
            weight += armies[endIndex] / (semiPerimeter - distToTarget);
          }

          // if (terrain[endIndex] === playerIndex && armies[endIndex] > 1) {
          //   weight -= armies[endIndex];
          // }

          // underweight blank tiles
          // if (terrain[endIndex] === TILE_EMPTY) {
          //   if (cities.indexOf(endIndex) >= 0) {
          //     if (head > armies[endIndex] + 2) {
          //       weight -= avgTroopSize;
          //     } else {
          //       weight += avgTroopSize;
          //     }
          //   } else {
          //     weight -= avgTroopSize + distToTarget;
          //   }
          // }

          if (endIndex === target) {
            weight -= size * size;
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
  resetHead = false;
  console.log();
});

leaveGame = () => {
  socket.emit('leave_game');
  console.log('left game');
  socket.disconnect();
};

socket.on('game_lost', () => leaveGame());
socket.on('game_won', () => leaveGame());
