const Game = require('./GameState');

class Spread {
  constructor() {
    this.currPath = new Map();
  }

  resetPath = () => {
    this.currPath.clear();
  };

  getAttack = (player, game) => {
    const { playerIndex, resetHead } = player;
    let { headIndex, headSize } = player;
    const {
      width,
      height,
      size,
      cities,
      armies,
      terrain,
      center,
      avgTileSize,
      dist,
      isValidMove,
    } = game;

    console.log(`spreading`);

    // reset head if head becomes too small or swallowed
    if (armies[headIndex] < avgTileSize || terrain[headIndex] !== playerIndex) {
      resetHead();
      headIndex = player.headIndex;
      headSize = player.headSize;
      this.resetPath();
      this.currPath.set(headIndex, 1);
    }
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
    moves = moves.filter(
      (move) => terrain[headIndex + move] !== Game.TILE_MOUNTAIN
    );

    const nextIndex = moves
      .map((move) => headIndex + move)
      .reduce((bestNextIndex, nextIndex) => {
        const moveWeight = this.calcWeight(nextIndex, player, game);
        const currBestMoveWeight = this.calcWeight(bestNextIndex, player, game);
        return moveWeight < currBestMoveWeight ? nextIndex : bestNextIndex;
      });

    // update currpath
    if (this.currPath.has(nextIndex)) {
      this.currPath.set(nextIndex, this.currPath.get(nextIndex) + 1);
    } else {
      this.currPath.set(nextIndex, 1);
    }

    return [headIndex, nextIndex];
  };

  calcWeight = (index, player, game) => {
    const { playerIndex, headIndex, headSize } = player;
    const { cities, size, armies, terrain, avgTileSize } = game;
    let weight = 0;

    // add weight to previous squares in path
    if (this.currPath.has(index)) {
      weight += size * this.currPath.get(index);
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
        if (armies[headIndex] > armies[index] + 1) {
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
}

module.exports = Spread;
