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

  // set starting point depending if last move was dead end
  crown = generals[playerIndex];
  // console.log('crown at ', crown);
  if (index === -1) {
    index = crown;
  }

  // underweight blank tiles
  terrain.map((t, i) => {
    if (t === TILE_EMPTY) {
      weightMap[i] = -1;
    }
  });

  // underweight paths to opponent
  let opponent = generals.find((g) => g !== playerIndex);
  const opRow = Math.floor(opponent / width);
  const opCol = opponent % width;
  if (opponent !== -1) {
    for (let i = 0; i < size; ++i) {
      if (Math.floor(i / width) === opRow) {
        weightMap[i] = -5 * (width - Math.abs((i % width) - opCol));
      }
      if (i % width === opCol) {
        weightMap[i] = -5 * (height - Math.abs(Math.floor(i / width) - opRow));
      }
    }
    weightMap[opponent] = -5 * size;
  }

  // give mountains infinite weight
  // underweight higher tiles
  terrain.map((t, i) => {
    if (t === TILE_MOUNTAIN) {
      weightMap[i] = Number.MAX_SAFE_INTEGER;
    } else if (t === playerIndex) {
      weightMap[i] = Math.floor(size / armies[i]);
    }
  });

  if (opponent !== -1 && terrain[index] !== playerIndex) {
    resetHead = true;
  }

  // use largest tile as starting index unless current head is still available
  if (armies[index] <= 1 || resetHead) {
    const myArmy = terrain
      .map((t, i) => (t === playerIndex ? i : -1))
      .filter((t) => t !== -1);

    index = myArmy.reduce((max, tile) => {
      if (armies[tile] > armies[max]) {
        return tile;
      } else {
        return max;
      }
    });
    currPath = [index];
  }

  // row and col of curr square
  const row = Math.floor(index / width);
  const col = index % width;

  // crown position
  const crownRow = Math.floor(crown / width);
  const crownCol = crown % width;

  // adjust move vector based on crown quadrant
  const up = crownRow < Math.floor(height / 2);
  const left = crownCol < Math.floor(width / 2);
  const vertical = [-width, width];
  const sides = [-1, 1];
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

  // reset head if stuck
  if (moves.length === 1) {
    resetHead = true;
  }

  // calc move with lowest weight
  const lowestWeightMove =
    index +
    moves.reduce((min, move) => {
      let possibleMove = index + move;

      let extraWeight = 0;

      if (currPath.indexOf(possibleMove) >= 0) {
        extraWeight += size;
      }

      if (cities.indexOf(possibleMove) >= 0) {
        if (armies[index] > armies[possibleMove] + 1) {
          extraWeight += -2 * size;
        } else {
          extraWeight += 2 * size;
        }
      }

      if (cities.indexOf(possibleMove))
        console.log(`weight: ${weightMap[possibleMove] + extraWeight}`);

      return weightMap[possibleMove] + extraWeight < weightMap[index + min]
        ? move
        : min;
    });

  currPath.push(lowestWeightMove);
  // weightMap[lowestWeightMove] += 5;
  socket.emit('attack', index, lowestWeightMove);
  index = lowestWeightMove;
  moves = [];
});

leaveGame = () => {
  socket.emit('leave_game');
  console.log('left game');
  socket.disconnect();
  socket.connect();
};

socket.on('game_lost', () => leaveGame());
socket.on('game_win', () => leaveGame());
