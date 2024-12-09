require("dotenv/config");
const mongoose = require("mongoose");
const { createOpenAiInstance } = require("../utils");
const createEmbeddings = require("../services/createEmbeddings");
const { OpenAIEmbeddings } = require("@langchain/openai");
const {
  payrollCollection,
  adjustmentCollection,
  employeeCollection,
} = require("../constants");

const uri = process.env.MONGODB_URI;

const openai = createOpenAiInstance();

/*
  First Method without langchain (remove the limit(100) to process all documents)
  Create embeddings for the payroll collection documents and store them in the database.
  NOT USED THIS FUNCTION.(just for testing)
*/
async function main() {
  try {
    const conn = await mongoose.connect(uri);
    console.log("Connected to MongoDB");
    // console.log(dbConn, "dbConn")

    const db = mongoose.connection.db;
    console.log(db.databaseName, "db name");

    const payrollsCollection =
      mongoose.connection.collection(payrollCollection);

    const documents = await payrollsCollection
      .find({
        $or: [
          {
            embedding: {
              $exists: false,
            },
          },
          {
            embeddingText: {
              $exists: false,
            },
          },
        ],
      })
      .limit(100)
      .toArray();
    console.log("Documents:", documents.length);

    for await (const doc of documents) {
      const updatedDoc = {
        ...doc,
      };
      if (doc?.adjustments?.length > 0) {
        updatedDoc.adjustments = await db
          .collection(adjustmentCollection)
          .find({
            _id: {
              $in: doc?.adjustments,
            },
          })
          .toArray();
      }
      const employeeData = await db.collection(employeeCollection).findOne(
        {
          _id: new mongoose.Types.ObjectId(doc?.employee_id),
        },
        {
          projection: {
            bank_name: 1,
            account_No: 1,
          },
        } // Include only `bank_name` and `account_No`
      );
      updatedDoc.bank_name = employeeData?.bank_name || "";
      updatedDoc.account_no = employeeData?.account_No || "";
      delete updatedDoc.created_at;
      delete updatedDoc.embedding;
      delete updatedDoc.embeddingText;

      console.log(updatedDoc, "updatedDoc");
      console.log(doc, "doc");

      const paragrapph = createStringOfKeyValue(updatedDoc);

      const { data } = await createEmbeddings(openai, paragrapph);

      doc["embedding"] = data[0]?.embedding;
      doc["embeddingText"] = paragrapph;

      await payrollsCollection.replaceOne(
        {
          _id: doc._id,
        },
        doc
      );
    }
    console.log("Embeddings generated and stored.");
    return;
  } catch (err) {
    console.error("Error:", err);
  } finally {
    mongoose.disconnect();
  }
}

/*
  Second Method with langchain (remove the limit(300) to process all documents)
  Create embeddings for the payroll collection documents and store them in the database.
  NOT USED THIS FUNCTION.(just for testing)
*/
async function mainUsingLangChain() {
  try {
    const conn = await mongoose.connect(uri);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    console.log(db.databaseName, "db name");

    const payrollsCollection =
      mongoose.connection.collection(payrollCollection);

    const documents = await payrollsCollection
      .find({
        $or: [
          {
            embedding: {
              $exists: false,
            },
          },
          {
            embeddingText: {
              $exists: false,
            },
          },
        ],
      })
      .limit(300)
      .toArray();

    console.log(`Found ${documents.length} documents without embeddings.`);

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    for (const doc of documents) {
      if (doc.adjustments?.length > 0) {
        doc.adjustments = await db
          .collection(adjustmentCollection)
          .find({
            _id: {
              $in: doc.adjustments,
            },
          })
          .toArray();
      }
      const employeeData = await db.collection(employeeCollection).findOne(
        {
          _id: doc.employee_id,
        },
        {
          projection: {
            bank_name: 1,
            account_No: 1,
          },
        }
      );

      doc.bank_name = employeeData?.bank_name || "";
      doc.account_no = employeeData?.account_No || "";
      delete doc.created_at;
      delete doc.embedding;
      delete doc.embeddingText;

      const paragraph = createStringOfKeyValue(doc);
      // console.log(paragraph, "paragraph")

      // Generate embeddings
      const embedding = await embeddings.embedQuery(paragraph);
      // console.log("embedding", embedding)

      // Update document with embeddings
      await payrollsCollection.updateOne(
        {
          _id: doc._id,
        },
        {
          $set: {
            embedding: embedding,
            embeddingText: paragraph,
          },
        }
      );
      console.log("Document updated with embeddings.");
    }
    console.log(`Found ${documents.length} documents without embeddings.`);
    console.log("Embeddings generated and stored.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

/*
  Second Method with langchain (optimized version)
  Used this one for creating embeddings and storing them in the database (optimized version)
  Create embeddings for the payroll collection documents and store them in the database.
*/
async function mainUsingLangChainOptimized() {
  const BATCH_SIZE = 50; // Number of documents to process in parallel
  let batchNumber = 0;
  try {
    // Establish MongoDB connection
    const conn = await mongoose.connect(uri);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    console.log(db.databaseName, "db name");

    const payrollsCollection =
      mongoose.connection.collection(payrollCollection);

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    while (true) {
      const documents = await payrollsCollection
        .find({
          $or: [
            { embedding: { $exists: false } },
            { embeddingText: { $exists: false } },
          ],
        })
        .limit(BATCH_SIZE)
        .toArray();
      console.log(`Found ${documents.length} documents without embeddings.`);
      console.log(
        `Processing batch Number: ${batchNumber} BATCH_SIZE: ${BATCH_SIZE}`
      );
      if (documents.length === 0) break; // Exit if no more documents

      // Process documents in parallel
      await Promise.all(
        documents.map(async (doc) => {
          try {
            // Fetch related adjustments and employee data
            const [adjustments, employeeData] = await Promise.all([
              doc.adjustments?.length > 0
                ? db
                    .collection(adjustmentCollection)
                    .find({ _id: { $in: doc.adjustments } })
                    .toArray()
                : Promise.resolve([]),
              db
                .collection(employeeCollection)
                .findOne(
                  { _id: doc.employee_id },
                  { projection: { bank_name: 1, account_No: 1 } }
                ),
            ]);

            doc.adjustments = adjustments || [];
            doc.bank_name = employeeData?.bank_name || "";
            doc.account_no = employeeData?.account_No || "";
            delete doc.created_at;
            delete doc.embedding;
            delete doc.embeddingText;

            // Generate embeddings
            const paragraph = createStringOfKeyValue(doc);
            const embedding = await embeddings.embedQuery(paragraph);

            // Update document
            await payrollsCollection.updateOne(
              { _id: doc._id },
              {
                $set: {
                  embedding: embedding,
                  embeddingText: paragraph,
                },
              }
            );

            console.log(`Document ${doc._id} updated with embeddings.`);
          } catch (docError) {
            console.error(`Error processing document ${doc._id}:`, docError);
            throw new Error(docError);
          }
        })
      );
      batchNumber++;
    }

    console.log("Embeddings generated and stored for all documents.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB connection closed.");
  }
}

/*
  This function is for creating the vector search index in mongodb atlas for collection.
*/
async function createSearchIndex() {
  try {
    const conn = await mongoose.connect(uri);
    console.log("Connected to MongoDB");

    const db = mongoose.connection.db;
    console.log(db.databaseName, "db name");

    const payrollsCollection =
      mongoose.connection.collection(payrollCollection);

    // Define your Atlas Vector Search Index
    const index = {
      name: "vector_index",
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            numDimensions: 1536,
            path: "embedding",
            similarity: "cosine",
          },
          {
            type: "filter",
            path: "salary_date",
          },
        ],
      },
    };
    // Run the helper method
    const result = await payrollsCollection.createSearchIndex(index);
    console.log(result);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

/*
  DELETE EMBEDDING AND TEXT fields from the documents in the payroll collection.
*/
const deleteEmbeddingsAndEmbeddingField = async () => {
  try {
    const conn = await mongoose.connect(uri);
    console.log("Connected to MongoDB");
    // console.log(dbConn, "dbConn")

    const db = mongoose.connection.db;
    console.log(db.databaseName, "db name");

    const payrollsCollection =
      mongoose.connection.collection(payrollCollection);

    const documents = await payrollsCollection
      .find({
        $or: [
          {
            embedding: {
              $exists: true,
            },
          },
          {
            embeddingText: {
              $exists: true,
            },
          },
        ],
      })
      .toArray();
    console.log(`Found ${documents.length} documents with embeddings.`);
    for (const doc of documents) {
      await payrollsCollection.updateOne(
        {
          _id: doc._id,
        },
        {
          $unset: {
            embedding: "",
            embeddingText: "",
          },
        }
      );
    }
    console.log("Embeddings removed from documents.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
  }
};

function createStringOfKeyValue(data) {
  const options = { day: "2-digit", month: "long", year: "numeric" };
  return Object.entries(data)
    .map(([key, value]) => {
      // Handle special cases for ObjectId, Date, or other types
      if (value instanceof mongoose.Types.ObjectId) {
        return `${key}: ${value.toHexString()}`;
      } else if (value instanceof Date) {
        return `${key}: ${new Date(value).toLocaleDateString(
          "en-GB",
          options
        )}`;
      } else if (Array.isArray(value)) {
        return `${key}: ${
          value.length > 0 ? JSON.stringify(value) : "No items"
        }`;
      } else if (typeof value === "object" && value !== null) {
        return `${key}: ${JSON.stringify(value)}`;
      } else {
        return `${key}: ${value}`;
      }
    })
    .join("\n"); // Combine each key-value pair with a newline for better readability
}

// main(); NOT USED THIS FUNCTION
// mainUsingLangChain(); // NOT USED THIS FUNCTION
mainUsingLangChainOptimized(); // Used this one for creating embeddings and storing them in the database (optimized version)

// createSearchIndex(); // This function is for creating the vector search index in mongodb atlas
// deleteEmbeddingsAndEmbeddingField(); // DELETE EMBEDDING AND TEXT fields from the documents in the payroll collection

// ********Quetions for testing the chat bot*********
// give me abrar salary count from june 2022 to july 2024 (PASS)
// give me raja usman murad salary count from june 2024 to july 2024 (PASS)
// what was the last month when Imran Munawar received Salary?
// what was the most recent salary imran munawar received?
// when imran munawar left from office?
// when is final payroll generated for imran munawar
// In november 2023 how many remaining leaves imran munawar had?
// when imran munawar joined what was his starting salary?
// when imran munawar received his first salary
// give me total of all late arrival deductions for imran munawar
