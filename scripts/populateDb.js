const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");

const sampleData = require("./policy.json");
const { createOpenAiInstance, createAstraDbInstance } = require("../utils");
const {
  similarityMetrics,
  prefixForVectorCollections,
  prefixForPDFVectorCollection,
} = require("../constants");
const createEmbeddings = require("../services/createEmbeddings");
const getCollection = require("../services/getCollection");
const fs = require("fs");
const pdf = require("pdf-parse");
const path = require("path");

const currentDir = __dirname;
const filePath = path.join(currentDir, "Policy Manual Shayan Solutions.pdf"); // Enter pdf file path and file name here
console.log(filePath);

const openai = createOpenAiInstance();
const astraDb = createAstraDbInstance();

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});

const createCollection = async (
  prefixForVectorCollections = prefixForVectorCollections,
  similarity_metric = "cosine"
) => {
  try {
    const res = await astraDb.createCollection(
      `${prefixForVectorCollections + similarity_metric}`,
      {
        vector: {
          dimension: 1536,
          metric: similarity_metric,
        },
      }
    );
    console.log(res);
  } catch (e) {
    console.log(e);
    console.log(
      `${prefixForVectorCollections + similarity_metric} already exists`
    );
  }
};

const loadSampleData = async (
  prefixForVectorCollections = prefixForVectorCollections,
  similarity_metric = "cosine"
) => {
  try {
    const collection = await getCollection(
      astraDb,
      `${prefixForVectorCollections + similarity_metric}`
    );

    for await (const { id, title, content } of sampleData) {
      const chunks = await splitter.splitText(content);
      let i = 0;
      for await (const chunk of chunks) {
        const { data } = await createEmbeddings(openai, chunk);

        const res = await collection.insertOne({
          document_id: `${id}-${i}`,
          $vector: data[0]?.embedding,
          id,
          title,
          content: chunk,
        });
        i++;
        console.log(`[${similarity_metric}] ${i}Record added`);
      }
    }
    console.log("data loaded");
  } catch (error) {
    console.log("ERROR**", error);
  }
};

const loadPdfData = async (
  prefixForPDFVectorCollection = prefixForPDFVectorCollection,
  pdfPath,
  similarity_metric = "cosine"
) => {
  try {
    const collection = await getCollection(
      astraDb,
      `${prefixForPDFVectorCollection + similarity_metric}`
    );

    // Read and parse the PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdf(pdfBuffer);

    // Extract text content
    const content = pdfData.text;
    console.log("PDF content extracted.");

    // Split the content into chunks
    const chunks = await splitter.splitText(content);

    let i = 0;
    for await (const chunk of chunks) {
      const { data } = await createEmbeddings(openai, chunk);

      // Insert embeddings into the database
      const res = await collection.insertOne({
        document_id: `pdf-${i}`,
        $vector: data[0]?.embedding,
        id: `pdf-${i}`,
        title: `Policy Document Chunk ${i + 1}`,
        content: chunk,
      });

      i++;
      console.log(`[${similarity_metric}] Chunk ${i} added`);
    }

    console.log("PDF data loaded.");
  } catch (error) {
    console.log("ERROR**", error);
  }
};

/* 
This code creates a collection for each similarity metric and loads JSON file sample data into each collection.
Un-comment the line below to load the JSON data into the vector database.
*/

similarityMetrics.forEach((metric) => {
  createCollection(prefixForVectorCollections, metric).then(() =>
    loadSampleData(prefixForVectorCollections, metric)
  );
});

/* 
This code creates a collection for cosine similarity metric and loads the pdf file data into the collection.
Un-comment the line below to load the pdf data into the vector database.
*/

// createCollection(prefixForPDFVectorCollection, similarityMetrics[0]).then(() =>
//   loadPdfData(prefixForPDFVectorCollection, filePath, similarityMetrics[0])
// );
