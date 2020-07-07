class GameState {
  constructor(playerIndex) {
    this.playerIndex = playerIndex;
    this.turn = 0;
    this.scores = [];
    this.generals = [];
    this.crown = 0;
    this.cities = [];
    this.map = [];
    this.width = 0;
    this.height = 0;
    this.size = 0;
    this.foundGenerals = [];
    this.armies = [];
    this.terrain = [];
    this.myScore = [];
    this.numOwnedCities = 0;
    this.centerIndex = [];
    this.avgTileSize = 0;
  }

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

  // update game state
  update(data) {
    // game data
    this.turn = data.turn;
    this.scores = data.scores;
    this.generals = data.generals;
    this.crown = this.generals[this.playerIndex];

    // map data
    this.cities = patch(this.cities, data.cities_diff);
    this.map = patch(this.map, data.map_diff);
    this.width = this.map[0];
    this.height = this.map[1];
    this.size = this.width * this.height;
    this.armies = this.map.slice(2, size + 2);
    this.terrain = this.map.slice(size + 2, size + 2 + size);

    // my data
    this.myScore = this.scores.find((score) => score.i === this.playerIndex);
    // number of cities I currently own
    this.numOwnedCities = this.cities.filter(
      (city) => this.terrain[city] === this.playerIndex
    ).length;
    // update located generals
    for (const general of this.generals) {
      if (
        general !== -1 &&
        general !== crown &&
        this.foundGenerals.indexOf(general) === -1
      ) {
        this.foundGenerals.push(general);
      }
    }
    const avgs = this.terrain.reduce(
      (acc, tile, index) => {
        if (tile === this.playerIndex) {
          const row = Math.floor(index / width);
          const col = index % width;
          acc[0] += row;
          acc[1] += col;
        }
      },
      [0, 0]
    );
    this.centerIndex = avgs.map(avg / this.myScore.tiles);
    this.avgTileSize = this.myScore.total / this.myScore.tiles;
  }
}

module.exports = GameState;
