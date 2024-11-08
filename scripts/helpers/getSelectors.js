function getSelectors(contract) {
  const selectors = Object.values(contract.interface.fragments)
    .filter((fragment) => fragment.type === 'function')
    .filter((fragment) => fragment.name !== 'init')
    .map((fragment) => contract.interface.getFunction(fragment.name).selector);

  return selectors;
}

module.exports = {
  getSelectors,
};
