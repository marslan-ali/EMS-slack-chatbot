const dotenv = require("dotenv");
const { App } = require("@slack/bolt");
const mongoose = require("mongoose");

const {
  createOpenAiInstance,
  createAstraDbInstance,
  createDocContext,
  createRagPrompt,
  getResponseFromOpenAIChat,
  createDocContextEMS,
  createRagPromptEMS,
  createRagPrompForDates,
  convertDateStringToQuery,
} = require("./utils");
const {
  similarityMetrics,
  prefixForVectorCollections,
  payrollCollection,
} = require("./constants");
const {
  checkUserAuthorization,
} = require("./middlewares/checkUserAuthorization");
const createEmbeddings = require("./services/createEmbeddings");
const getCollection = require("./services/getCollection");
const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");
const { MongoDBAtlasVectorSearch } = require("@langchain/mongodb");
const { PromptTemplate } = require("@langchain/core/prompts");

const {
  RunnableSequence,
  RunnablePassthrough,
} = require("@langchain/core/runnables");
const { formatDocumentsAsString } = require("langchain/util/document");
const { StringOutputParser } = require("@langchain/core/output_parsers");

dotenv.config();

const port = process.env.PORT || 8000;
const uri = process.env.MONGODB_URI;

const openai = createOpenAiInstance();
const astraDb = createAstraDbInstance();

mongoose
  .connect(uri)
  .then((conn) => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log(err);
  });

// Initializes your app with your bot token and signing secret
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

/*
  Slack Event Listener for direct message to app. (Having company policy code using astraDB).
  Listener middleware that check the authorization of the user.
  correct the spelling of message for listening the event.
*/
slackApp.event(
  "message",
  checkUserAuthorization,
  async ({ event, client, logger }) => {
    try {
      console.log("event direct message");

      // Generate OpenAI embeddings
      const { data } = await createEmbeddings(openai, event.text);

      /* 
        Fetch similar documents from your collection
        set the prefix and similarity metrics for the vector collection
        1.prefixForVectorCollections: for json data collection name
        2.prefixForPDFVectorCollection: for pdf data collection name
      */

      const collection = await getCollection(
        astraDb,
        `${prefixForVectorCollections + similarityMetrics[0]}`
      );

      const cursor = collection.find(null, {
        sort: {
          $vector: data[0]?.embedding,
        },
        limit: 5,
      });

      const documents = await cursor.toArray();

      // Prepare context for the assistant
      const docContext = createDocContext(documents);

      // Construct prompt for OpenAI Chat
      const ragPrompt = createRagPrompt(event.text, docContext);

      // Get response from OpenAI Chat
      const response = await getResponseFromOpenAIChat(openai, ragPrompt);

      const text =
        response.choices[0]?.message?.content.replaceAll("**", "*") ||
        "Answer not found in company policy.";
      console.log(
        "Response from OpenAI:",
        response.choices[0]?.message?.content
      );
      console.log("Converted Response from OpenAI:", text);

      // Post response in the Slack channel or thread
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: text,
      });
    } catch (error) {
      console.error("Error handling message event:", error);
      logger.error(error);
    }
  }
);

/*
  Slack Event Listener for app_mention. (Having company policy code using astraDB).
  Listener middleware that check the authorization of the user.
  correct the spelling of message for listening the event.
*/
slackApp.event(
  "app_mentionn",
  checkUserAuthorization,
  async ({ event, client, logger }) => {
    try {
      console.log("event, app_mention", event);

      // Generate OpenAI embeddings
      const { data } = await createEmbeddings(openai, event.text);

      /* 
        Fetch similar documents from your collection
        set the prefix and similarity metrics for the vector collection
        1.prefixForVectorCollections: for json data collection name
        2.prefixForPDFVectorCollection: for pdf data collection name
      */
      const collection = await getCollection(
        astraDb,
        `${prefixForVectorCollections + similarityMetrics[0]}`
      );
      console.log(collection);

      const cursor = collection.find(null, {
        sort: {
          $vector: data[0]?.embedding,
        },
        limit: 5,
      });

      const documents = await cursor.toArray();

      // Prepare context for the assistant
      const docContext = createDocContext(documents);

      // Construct prompt for OpenAI Chat
      const ragPrompt = createRagPrompt(event.text, docContext);

      // Get response from OpenAI Chat
      const response = await getResponseFromOpenAIChat(openai, ragPrompt);

      const text =
        response.choices[0]?.message?.content.replaceAll("**", "*") ||
        "Answer not found in company policy.";
      console.log(
        "Response from OpenAI:",
        response.choices[0]?.message?.content
      );
      console.log("Converted Response from OpenAI:", text);

      // Post response in the Slack channel or thread
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: text,
      });
    } catch (error) {
      console.error("Error handling message event:", error);
      logger.error(error);
    }
  }
);

/*
  Slack Event Listener for direct message to app. (Having EMS DB and Payrolls collection code).
  Listener middleware that check the authorization of the user.
  First Method without langchain (Having EMS DB code). 
  NOT USED THIS EVENT LISTENER.(just for testing).
  correct the spelling of message for listening the event.
*/
slackApp.event(
  "messagee",
  checkUserAuthorization,
  async ({ event, client, logger }) => {
    try {
      console.log("event direct message");

      // Generate OpenAI embeddings
      const { data } = await createEmbeddings(openai, event.text);

      const db = mongoose.connection.db;

      console.log(db.databaseName, "db name");

      const payrollsCollection =
        mongoose.connection.collection(payrollCollection);

      const documentsCursor = payrollsCollection.aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: data[0]?.embedding,
            numCandidates: 100,
            limit: 4,
          },
        },
      ]);

      // Convert the cursor to an array to get the documents
      const documents = await documentsCursor.toArray();

      // console.log('documents:', documents);

      // Prepare context for the assistant
      const docContext = createDocContextEMS(documents);
      console.log("docContext", docContext);

      // Construct prompt for OpenAI Chat
      const ragPrompt = createRagPromptEMS(event.text, docContext);
      console.log("ragPrompt", ragPrompt);

      // Get response from OpenAI Chat
      const response = await getResponseFromOpenAIChat(openai, ragPrompt);

      const text =
        response.choices[0]?.message?.content.replaceAll("**", "*") ||
        "Answer not found in EMS DB.";
      console.log(
        "Response from OpenAI:",
        response.choices[0]?.message?.content
      );
      console.log("Converted Response from OpenAI:", text);

      // Post response in the Slack channel or thread
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: text,
      });
    } catch (error) {
      console.error("Error handling message event:", error);
      logger.error(error);
    }
  }
);

/*
  Slack Event Listener for direct message to app. (Having EMS DB and Payrolls collection code).
  Listener middleware that check the authorization of the user.
  Second Method with langchain using MongoDBAtlasVectorSearch (Having EMS DB code)
  USED THIS EVENT LISTENER.(currently using this one).
*/
slackApp.event(
  "message",
  checkUserAuthorization,
  async ({ event, client, logger }) => {
    try {
      console.log("event direct message");
      const db = mongoose.connection.db;
      console.log(db.databaseName, "db name");

      const collection = mongoose.connection.db.collection(payrollCollection);

      // Step 1: Initialize OpenAI embeddings and model
      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
      });

      const llm = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        temperature: 0, // Control the randomness of responses
      });

      // Step 2: Initialize MongoDB Vector Store
      const dbConfig = {
        collection: collection,
        indexName: "vector_index", // The name of the Atlas search index to use.
        textKey: "embeddingText", // Field name for the raw text content. Defaults to "text".
        embeddingKey: "embedding", // Field name for the vector embeddings. Defaults to "embedding".
      };
      const vectorStore = new MongoDBAtlasVectorSearch(embeddings, dbConfig);

      const ragPrompt = createRagPrompForDates(event.text);

      // Get response from OpenAI Chat
      const response = await getResponseFromOpenAIChat(openai, ragPrompt);
      const responseText = response.choices[0]?.message?.content;
      console.log("responseText", responseText);

      const retrieverConfig = {
        k: 20,
      };

      if (!responseText.includes("null")) {
        retrieverConfig.filter = {
          preFilter: { salary_date: convertDateStringToQuery(responseText) },
        };
      }

      console.log(retrieverConfig, "retrieverConfig");
      const retriever = vectorStore.asRetriever(retrieverConfig);

      const prompt = PromptTemplate.fromTemplate(
        `You are an expert assistant trained to answer questions based on payroll data(context). You can make the calculations as well according to the question.If the context provided is insufficient to answer the question, respond with: "Answer not found in EMS DB.{context}
        Question: {question}`
      );

      const chain = RunnableSequence.from([
        {
          context: retriever.pipe(formatDocumentsAsString),
          question: new RunnablePassthrough(),
        },
        prompt,
        llm,
        new StringOutputParser(),
      ]);
      const answer = await chain.invoke(event.text);
      console.log("Question: " + event.text);
      console.log("Answer: " + answer);

      // Post response in the Slack channel or thread
      await client.chat.postMessage({
        channel: event.channel,
        thread_ts: event.thread_ts,
        text: answer,
      });
    } catch (error) {
      console.error("Error handling message event:", error);
      logger.error(error);
    }
  }
);

(async () => {
  // Start your app
  await slackApp.start(port);

  console.log(`⚡️ Bolt app is running! PORT: ${port}`);
})();
