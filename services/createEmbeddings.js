const createEmbeddings = async (openai, text) =>
  await openai.embeddings.create({
    input: text,
    model: "text-embedding-ada-002",
    // encoding_format: "float"
  });

module.exports = createEmbeddings;
// text-embedding-3-small // latest embedding model
