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
let weightMap = [];
let moves;
let flip = false;
let resetHead = false;
let target = -1;
const maxCities = 5;
let highTiles = [];
let targetStack = [];
let mainTarget = -1;

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
    weightMap[crown] = 0;
  }

  // update game state
  const turn = data.turn;
  const myArmy = terrain
    .map((t, i) => ({ tile: t, index: i }))
    .filter((t) => t.tile === playerIndex)
    .map((t) => t.index);
  const myCities = cities.filter((c) => terrain[c] === playerIndex);
  const highTileStack = myArmy.sort((a, b) => armies[a] - armies[b]).slice();

  const row = Math.floor(index / width);
  const col = index % width;
  const numTroops = myArmy.length;
  const avgRow = Math.floor(
    myArmy.reduce((sum, t) => sum + Math.floor(t.index / width), 0) / numTroops
  );
  const avgCol = Math.floor(
    myArmy.reduce((sum, t) => sum + (t.index % width), 0) / numTroops
  );
  const center = avgRow * width + avgCol; // based on center of army

  // underweight paths to opponent
  const opponent = generals.find((g) => g !== crown);

  const opRow = Math.floor(opponent / width);
  const opCol = opponent % width;

  // reset head if head goes to one
  resetHead = false;
  if (armies[index] <= 1 || terrain[index] !== playerIndex) {
    resetHead = true;
  }

  // use largest tile as starting index unless current head is still available
  if (resetHead) {
    index = highTileStack.pop();
    currPath = [];
    currPath[index] = 1;
    weightMap[index]++;
  }

  const head = armies[index];

  console.log(`head at ${index} with ${head} troops`);

  // give mountains infinite weight
  // underweight blank tiles
  terrain.map((t, i) => {
    if (t === TILE_MOUNTAIN) {
      weightMap[i] = Number.MAX_SAFE_INTEGER;
    } else if (t === TILE_EMPTY || t === TILE_FOG) {
      weightMap[i] = -1;
    }
  });

  // adjust move vector based on center quadrant
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

  // console.log(`surrounding cells have weights: `);
  let bestEndIndex = moves
    .map((move) => {
      let endIndex = index + move;
      let extraWeight = 0;

      // add weight to previous squares in path
      if (currPath[endIndex] > 0) {
        extraWeight = size * currPath[endIndex];
      }

      // if possible try to capture a city
      // add weight to cities
      if (cities.indexOf(endIndex) >= 0) {
        if (armies[index] > armies[endIndex] + 1) {
          extraWeight += -1;
        } else {
          extraWeight += size;
        }
      }

      // underweight reasonably high tiles
      const avgTroops =
        Math.floor(
          myArmy.reduce((sum, t) => sum + armies[t.index]),
          0
        ) / numTroops;
      if (
        armies[endIndex] > 1 &&
        terrain[endIndex] === playerIndex &&
        armies[index] < avgTroops
      ) {
        extraWeight -= armies[endIndex];
      }

      // underweight low enemy tiles
      if (myArmy.indexOf(endIndex) === -1) {
        // after turn 200, try to attack enemy territory at all costs
        if (turn > 200) {
          extraWeight -= size;
        } else {
          extraWeight += armies[endIndex];
        }
      }

      return { endIndex: endIndex, weight: weightMap[endIndex] + extraWeight };
    })
    .reduce(
      (min, move) => {
        // console.log(move.weight);

        return move.weight < min.weight ? move : min;
      },
      { weight: Number.MAX_SAFE_INTEGER }
    ).endIndex;

  // console.log('\n');

  // target cities
  const numOwnedCities = myCities.length;
  if (
    mainTarget === -1 &&
    turn % 10 === 0 &&
    numOwnedCities < Math.floor(turn / 100) &&
    numOwnedCities < maxCities &&
    cities.length > numOwnedCities
  ) {
    console.log(`at turn ${turn}`);
    console.log(`currently own ${numOwnedCities} cities`);
    console.log(`curently ${cities.length} cities visible`);
    mainTarget = cities.find((city) => terrain[city] === TILE_EMPTY);
    // if (typeof target === 'undefined') {
    //   mainTarget = -1;
    // }
  }

  // when possible try to attack enemy crown
  if (opponent !== -1 && mainTarget === -1) {
    console.log(`main targeting enemy crown`);
    mainTarget = opponent;
  }

  if (mainTarget !== -1) {
    if (targetStack.length === 0 && head + 2 < armies[mainTarget]) {
      targetStack.push(highTileStack.pop());
    }
    console.log(
      `main targeting ${
        generals.indexOf(mainTarget) >= 0 ? 'general' : 'city'
      } ${mainTarget} (costs ${armies[mainTarget]} troops)`
    );
  }

  let target = -1;
  const targetRow = Math.floor(target / width);
  const targetCol = target % width;
  if (targetStack.length > 0) {
    // calculate target tile
    target = targetStack[targetStack.length - 1];
    console.log(`targeting tile ${target} (contains ${armies[target]} troops)`);
  } else {
    target = mainTarget;
  }

  // go toward a specific target if specified
  if (target !== -1) {
    const bestDist = moves
      .map((move) => index + move)
      .reduce(
        (min, endIndex) => {
          const row = Math.floor(endIndex / width);
          const col = endIndex % width;
          let distToTarget =
            Math.abs(row - targetRow) + Math.abs(col - targetCol);
          if (currPath[endIndex] > 0) {
            distToTarget += size * currPath[endIndex];
          }
          if (terrain[endIndex] === TILE_MOUNTAIN) {
            distToTarget = Number.MAX_SAFE_INTEGER;
          }
          if (distToTarget < min.distToTarget) {
            return { endIndex: endIndex, distToTarget: distToTarget };
          } else {
            return min;
          }
        },
        { distToTarget: Number.MAX_SAFE_INTEGER }
      );
    bestEndIndex = bestDist.endIndex;
    console.log(`${bestDist.distToTarget} units away from target`);
  }

  if (target === bestEndIndex) {
    targetStack.pop();
    console.log('targeting finished');
  }

  if (mainTarget === bestEndIndex) {
    mainTarget = -1;
    console.log('main targeting finished');
  }

  if (currPath[bestEndIndex]) {
    currPath[bestEndIndex]++;
  } else {
    currPath[bestEndIndex] = 1;
  }
  weightMap[bestEndIndex]++;
  // console.log('attacking from ', index, ' to ', bestEndIndex)
  socket.emit('attack', index, bestEndIndex);
  index = bestEndIndex;
  console.log();
});

leaveGame = () => {
  socket.emit('leave_game');
  console.log('left game');
  socket.close();
  socket.connect();
};

socket.on('game_lost', () => leaveGame());
socket.on('game_win', () => leaveGame());
