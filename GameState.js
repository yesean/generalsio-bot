// patch diff array into current array
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

class GameState {
  constructor(playerIndex) {
    this.turn = 0;
    this.cities = [];
    this.map = [];
    this.generals = [];
    this.foundGenerals = [];
    this.scores = [];
  }

  // update game state
  update(data) {
    this.turn = data.turn;
    this.cities = patch(this.cities, data.cities_diff);
    this.map = patch(this.map, data.map_diff);
    this.generals = data.generals;
    this.scores = data.scores;

    // // update located generals
    // for (const g of this.generals) {
    //   if (g !== -1 && g !== crown && this.foundGenerals.indexOf(g) === -1) {
    //     this.foundGenerals.push(g);
    //   }
    // }
  }
}

module.exports = GameState;
