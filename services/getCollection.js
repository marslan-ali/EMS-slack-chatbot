const getCollection = async (astraDb, collectionName) =>
  await astraDb.collection(collectionName);

module.exports = getCollection;
