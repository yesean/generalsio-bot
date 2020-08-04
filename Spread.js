const Game = require('./GameState.js');
const Algorithms = require('./Algorithms.js');

class Spread {
  constructor() {
    this.currPath = new Map();
    this.spreadPath = [];
  }

  resetPath = () => {
    this.currPath.clear();
    this.spreadPath = [];
  };

  getAttack = (player, game) => {
    const { playerIndex, headIndex, headSize, resetHead } = player;
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
    if (this.spreadPath.length > 1) {
      return [this.spreadPath.shift(), this.spreadPath[0]];
    } else {
      console.log('calculating spreadPath to empty tile');
      this.spreadPath = Algorithms.dijkstra(
        player.headIndex,
        Game.TILE_EMPTY,
        player,
        game
      );
      console.log('spreadPath:', this.spreadPath);
      return [this.spreadPath.shift(), this.spreadPath[0]];
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
    if (this.currPath.has(player.headIndex)) {
      this.currPath.set(
        player.headIndex,
        this.currPath.get(player.headIndex) + 1
      );
    } else {
      this.currPath.set(player.headIndex, 1);
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
    // if (terrain[index] === playerIndex && armies[index] === 1) {
    if (player.team.has(terrain[index]) && armies[index] === 1) {
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
      // if (terrain[index] === playerIndex) {
      if (player.team.has(terrain[index])) {
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
      // terrain[index] === playerIndex &&
      player.team.has(terrain[index]) &&
      armies[index] > 1 &&
      headSize < avgTileSize
    ) {
      weight -= armies[index];
    }

    return weight;
  };
}

module.exports = Spread;
