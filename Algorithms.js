const Game = require('./GameState.js');
const GameState = require('./GameState.js');

// calculate path to targetIndex with dijkstra's
const dijkstra = (start, end, player, game, targetingEnemy = false) => {
  const { playerIndex } = player;
  const { armies, terrain, cities, width, height, isValidMove } = game;
  let prev = new Map();
  let weights = terrain.map((tile) => Number.MAX_SAFE_INTEGER);
  weights[start] = 1;

  let visited = new Set();
  let pqueue = [start];
  let currIndex;
  const moves = [-1, 1, -width, width];
  while (pqueue.length > 0) {
    currIndex = pqueue.shift();

    // terminate search if targetIndex is found
    // if (currIndex === end) {
    if (
      game.terrain[currIndex] === end &&
      (end !== Game.TILE_EMPTY || !game.cities.includes(currIndex))
    ) {
      break;
    }

    visited.add(currIndex);
    for (const move of moves) {
      // ignore impossible moves
      const nextIndex = currIndex + move;
      if (
        game.mountains.has(nextIndex) ||
        !isValidMove(currIndex, nextIndex) ||
        (end === Game.TILE_EMPTY && game.cities.includes(nextIndex))
      ) {
        continue;
      }

      const moveWeight =
        weights[currIndex] + calcWeight(nextIndex, player, game, targetingEnemy);

      // insert move if it hasn't been explored and costs less than it currently does
      if (!visited.has(nextIndex) && moveWeight < weights[nextIndex]) {
        weights[nextIndex] = moveWeight;
        prev.set(nextIndex, currIndex);

        // remove index if its already in the queue
        const position = pqueue.indexOf(nextIndex);
        if (position !== -1) {
          pqueue.splice(position, 1);
        }
        insert(pqueue, nextIndex, weights);
      }
    }
  }

  // determine shortest path
  const path = [];
  let prevIndex = currIndex;
  while (prevIndex !== undefined) {
    path.unshift(prevIndex);
    prevIndex = prev.get(prevIndex);
  }
  return path;
};

// calculate path to targetIndex with aStar
const aStar = (start, end, player, game, targetingEnemy = false) => {
  const { playerIndex } = player;
  const { armies, terrain, cities, width, height, isValidMove } = game;
  let prev = new Map();
  let weights = terrain.map((tile) => Number.MAX_SAFE_INTEGER);
  weights[start] = 1;

  let visited = new Set();
  let pqueue = [start];
  const moves = [-1, 1, -width, width];
  while (pqueue.length > 0) {
    const currIndex = pqueue.shift();
    visited.add(currIndex);

    // terminate search if targetIndex is found
    if (currIndex === end) {
      break;
    }

    for (const move of moves) {
      // ignore mountains and out of bounds moves and team crowns
      const nextIndex = currIndex + move;
      if (
        game.mountains.has(nextIndex) ||
        !isValidMove(
          currIndex,
          nextIndex ||
            player.team.has(game.generals.findIndex((gen) => gen === nextIndex))
        )
      ) {
        continue;
      }

      const moveWeight =
        weights[currIndex] + calcWeight(nextIndex, player, game, targetingEnemy);

      // insert move if it hasn't been explored and costs less than it currently does
      if (!visited.has(nextIndex) && moveWeight < weights[nextIndex]) {
        weights[nextIndex] = moveWeight;
        prev.set(nextIndex, currIndex);

        // remove index if its already in the queue
        const position = pqueue.indexOf(nextIndex);
        if (position !== -1) {
          pqueue.splice(position, 1);
        }
        insert(pqueue, nextIndex, weights, end, game, targetingEnemy);
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

const calcWeight = (nextIndex, player, game, targetingEnemy = false) => {
  // player tiles are weighted to favor higher tiles
  // fog obstacles are weighted as potential city cost
  // enemy tiles and empty cities are weighted as their capture cost
  // if (game.terrain[nextIndex] === game.playerIndex) {
  let moveWeight = 1;
  // if (player.team.has(game.terrain[nextIndex])) {
  //   if (targetingEnemy) {
  //     moveWeight -= game.armies[nextIndex];
  //   } else {
  //     moveWeight -= Math.floor(game.armies[nextIndex] / game.avgTileSize / 2);
  //   }
  // } else if (game.terrain[nextIndex] === Game.TILE_FOG_OBSTACLE) {
  //   moveWeight += 50; // approx city capture cost
  // } else {
  //   moveWeight += game.armies[nextIndex];
  // }
  if (
    !targetingEnemy &&
    (!player.team.has(game.terrain[nextIndex]) ||
      (game.terrain[nextIndex] === Game.TILE_EMPTY &&
        !game.cities.includes(nextIndex)))
  ) {
    moveWeight += game.armies[nextIndex];
  }
  return moveWeight;
};

const heuristic = (start, end, game) => game.dist(start, end);

// insert tile into priority queue for dijkstra and astar
// targetIndex and game are optional for astar
const insert = (array, index, weights, targetIndex, game, targetingEnemy = false) => {
  const weightScale = targetingEnemy ? 0.3 : 1;
  const heuristicScale = targetingEnemy ? 0.7 : 1;
  let added = false;
  for (let i = 0; i < array.length; ++i) {
    const currIndexHeuristic = targetIndex
      ? heuristic(index, targetIndex, game)
      : 0;
    const pqElemHeuristic = targetIndex
      ? heuristic(array[i], targetIndex, game)
      : 0;
    if (
      weightScale * weights[index] + heuristicScale * currIndexHeuristic <
      weightScale * weights[array[i]] + heuristicScale * pqElemHeuristic
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

exports.dijkstra = dijkstra;
exports.aStar = aStar;
