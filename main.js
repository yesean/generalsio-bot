// only for the first time
// set username for bot
// socket.emit("set_username", user_id, username);

// main.js
const io = require('socket.io-client');

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
let moves = [];
let flip = false;
let resetHead = false;
let target = -1;
let visitedHighTiles = [];
const maxCities = 2;
let highTiles = [];

patch = (old, diff) => {
  let out = [];
  let i = 0;
  while (i < diff.length) {
    // matching
    if (diff[ i ]) {
      out.push(...old.slice(out.length, out.length + diff[ i ]));
    }
    ++i;
    // mismatching
    if (i < diff.length && diff[ i ]) {
      out.push(...diff.slice(i + 1, i + 1 + diff[ i ]));
    }
    i += 1 + diff[ i ];
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
  const width = map[ 0 ];
  const height = map[ 1 ];
  const size = width * height;

  // update army values
  const armies = map.slice(2, size + 2);

  // update terrain values
  const terrain = map.slice(size + 2, size + 2 + size);

  // set starting point depending if last move was dead end
  crown = generals[ playerIndex ];

  // initialize index
  if (index === -1) {
    index = crown;
    weightMap[ crown ] = 0;
  }

  // keep track of high tiles
  highTiles = terrain.filter(t => t === playerIndex).sort((a, b) => armies[ b ] - armies[ a ]);

  // reset head if head goes to one
  resetHead = false;
  if (armies[ index ] <= 1 || terrain[ index ] !== playerIndex) {
    resetHead = true;
  }

  // // target cities
  const turn = data.turn;
  const numOwnedCities = cities.filter(c => terrain[ c ] === playerIndex).length;
  // if (target === -1 && turn % 10 === 0 && numOwnedCities < Math.floor(turn / 100) && numOwnedCities < maxCities && cities.length >= Math.floor(turn / 100)) {
  //   console.log(`at turn ${turn}`);
  //   console.log(`currently own ${numOwnedCities} cities`);
  //   target = cities.find(city => terrain[ city ] === TILE_EMPTY);
  //   if (typeof target === 'undefined') {
  //     target = -1;
  //   }
  //   console.log(`targeting city ${target}`);
  //   console.log('\n');
  // }

  // use largest tile as starting index unless current head is still available
  if (resetHead) {
    const myArmy = terrain
      .map((t, i) => (t === playerIndex ? i : -1))
      .filter((t) => t !== -1);

    index = myArmy.reduce((max, tile) => {
      if (armies[ tile ] > armies[ max ]) {
        return tile;
      } else {
        return max;
      }
    });
    currPath = [];
    currPath[ index ] = 1;
    weightMap[ index ]++;
  }

  // row and col of curr square
  const row = Math.floor(index / width);
  const col = index % width;

  // center position
  const numTroops = terrain.filter(t => t === playerIndex).length;
  const avgRow = Math.floor(terrain.reduce((sum, tile, i) => (tile === playerIndex) ? sum + Math.floor(i / width) : sum, 0) / numTroops);
  const avgCol = Math.floor(terrain.reduce((sum, tile, i) => (tile === playerIndex) ? sum + i % width : sum, 0) / numTroops);
  const center = avgRow * width + avgCol;   // based on center of army

  // underweight blank tiles
  terrain.map((t, i) => {
    if (t === TILE_EMPTY || t === TILE_FOG) {
      weightMap[ i ] = -10;
    }
  });

  // underweight paths to opponent
  let opponent = generals.find((g) => g !== playerIndex);
  const opRow = Math.floor(opponent / width);
  const opCol = opponent % width;

  // give mountains infinite weight
  // underweight higher tiles
  terrain.map((t, i) => {
    if (t === TILE_MOUNTAIN) {
      weightMap[ i ] = Number.MAX_SAFE_INTEGER;
    }
  });

  // adjust move vector based on center quadrant
  const up = avgRow < Math.floor(height / 2);
  const left = avgCol < Math.floor(width / 2);
  const vertical = [ -width, width ];
  const sides = [ -1, 1 ];
  if (flip) {
    if (up) {
      moves.push(vertical.pop());
    } else {
      moves.push(vertical.shift());
    }
    if (left) {
      moves.push(sides.pop());
    } else {
      moves.push(sides.shift());
    }
    moves.push(vertical.pop());
    moves.push(sides.pop());
  } else {
    if (left) {
      moves.push(sides.pop());
    } else {
      moves.push(sides.shift());
    }
    if (up) {
      moves.push(vertical.pop());
    } else {
      moves.push(vertical.shift());
    }
    moves.push(sides.pop());
    moves.push(vertical.pop());
  }
  flip = !flip;   // move in a diagonal pattern

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

  console.log(`surrounding cells have weights: `);

  let bestEndIndex =
    moves
      .map(move => {
        let endIndex = index + move;
        let extraWeight = 0;

        // add weight to previous squares in path
        if (currPath[ endIndex ] > 0) {
          extraWeight = size * currPath[ endIndex ];
        }

        // if possible try to capture a city
        // add weight to cities
        if (cities.indexOf(endIndex) >= 0) {
          if (armies[ index ] > armies[ endIndex ] + 1) {
            extraWeight += -1;
          } else {
            extraWeight += size;
          }
        }

        const avgTroops = Math.floor(terrain.map((sum, tile, i) => tile === playerIndex ? sum + armies[ i ] : sum, 0) / numTroops);
        if (armies[ endIndex ] > 1 && terrain[ endIndex ] === playerIndex && armies[ index ] < avgTroops) {
          extraWeight -= armies[ endIndex ];
        }

        if (terrain[ endIndex ] !== playerIndex && terrain[ endIndex ] > 0) {
          if (turn > 200) {
            extraWeight -= size;
          } else {
            extraWeight -= 1.5;
          }
        }

        return { 'endIndex': endIndex, 'weight': weightMap[ endIndex ] + extraWeight };
      })
      .reduce((min, move) => {
        console.log(move.weight);

        return move.weight < min.weight
          ? move
          : min;
      }, { 'weight': Number.MAX_SAFE_INTEGER })
      .endIndex;

  console.log('\n');

  // go to high tiles when seeking general
  if (opponent !== -1) {
    target = opponent;

    if (armies[ index ] < armies[ opponent ] && target === -1) {
      target = highTiles.find(tile => visitedHighTiles.indexOf(tile) === -1);
      visitedHighTiles.push(target);
    }
  }



  const targetRow = Math.floor(target / width);
  const targetCol = target % width;

  if (target !== -1) {
    bestEndIndex =
      moves.map(move => index + move).reduce((min, endIndex) => {
        const row = Math.floor(endIndex / width);
        const col = endIndex % width;
        let distToOp = Math.abs(row - targetRow) + Math.abs(col - targetCol);
        // console.log(`dist to target: ${distToOp}`);
        if (terrain[ endIndex ] === TILE_MOUNTAIN) {
          distToOp = Number.MAX_SAFE_INTEGER;
        }
        if (currPath[ endIndex ] > 0) {
          distToOp += size;
        }
        if (distToOp < min.distToOp) {
          return { 'endIndex': endIndex, 'distToOp': distToOp };
        } else {
          return min;
        }
      }, { 'distToOp': Number.MAX_SAFE_INTEGER })
        .endIndex;
  }

  if (target !== -1 && bestEndIndex === target) {
    // if (!(cities.indexOf(target) >= 0 && terrain[ target ] !== playerIndex)) {
    //   target = -1;
    // console.log(`targeting finished`);
    // console.log('\n');
    // }
    target = -1;
  }

  if (currPath[ bestEndIndex ]) {
    currPath[ bestEndIndex ]++;
  } else {
    currPath[ bestEndIndex ] = 1;
  }
  weightMap[ bestEndIndex ]++;
  socket.emit('attack', index, bestEndIndex);
  index = bestEndIndex;
  moves = [];
});

leaveGame = () => {
  socket.emit('leave_game');
  console.log('left game');
  socket.close();
  socket.connect();
};

socket.on('game_lost', () => leaveGame());
socket.on('game_win', () => leaveGame());
