class Gather {
  constructor() {
    this.gatherPath = [];
  }

  getAttack = () => {};

  calcGather = () => {};

  isGathering = (player, game) => {
    return this.gatherPath.length > 1;
  };
}

module.exports = Gather;
