const Game = require('./GameState');

const getNextIndex = (player, game) => {
  const { headIndex, headSize, currPath } = player;
  const {
    playerIndex,
    width,
    height,
    size,
    cities,
    armies,
    terrain,
    center,
    avgTileSize,
    eDist,
    isValidMove,
  } = game;

  console.log(`spreading`);
  // order moves based on center of army
  const up = center.row < Math.floor(height / 2);
  const left = center.col < Math.floor(width / 2);
  let vMoves = up ? [width, -width] : [-width, width];
  let hMoves = left ? [1, -1] : [-1, 1];
  let moves;
  if (Math.random() < 0.5) {
    moves = [vMoves[0], hMoves[0], vMoves[1], hMoves[1]];
  } else {
    moves = [hMoves[0], vMoves[0], hMoves[1], vMoves[1]];
  }

  // filter out illegal moves
  moves = moves.filter((move) => isValidMove(headIndex, headIndex + move));
  // filter out moves into mountains
  moves = moves.filter((m) => terrain[headIndex + m] !== Game.TILE_MOUNTAIN);

  const calcWeight = (index) => {
    let weight = 0;

    // add weight to previous squares in path
    if (currPath.has(index)) {
      weight += size * currPath.get(index);
    }

    // avoid stepping over 1s
    // underweight blank tiles
    if (terrain[index] === playerIndex && armies[index] === 1) {
      weight += size;
    } else if (
      terrain[index] === Game.TILE_EMPTY &&
      cities.indexOf(index) === -1
    ) {
      weight -= size;
    }

    // if city mine, decrease its weight
    // if not, avoid unless capturable
    if (cities.indexOf(index) >= 0) {
      if (terrain[index] === playerIndex) {
        weight -= armies[index];
      } else {
        if (armies[headIndex] > armies[index] + 2) {
          weight -= 2 * size;
        } else {
          weight += size * size;
        }
      }
    }

    // underweight reasonably high tiles if headSize is small
    if (
      terrain[index] === playerIndex &&
      armies[index] > 1 &&
      headSize < avgTileSize
    ) {
      weight -= armies[index];
    }

    return weight;
  };

  return moves
    .map((move) => headIndex + move)
    .reduce((bestNextIndex, nextIndex) => {
      const moveWeight = calcWeight(nextIndex);
      const currBestMoveWeight = calcWeight(bestNextIndex);
      return moveWeight < currBestMoveWeight ? nextIndex : bestNextIndex;
    });
};

exports.getNextIndex = getNextIndex;
