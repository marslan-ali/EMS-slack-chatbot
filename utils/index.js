const OpenAI = require("openai");
const { DataAPIClient } = require("@datastax/astra-db-ts");
require("dotenv/config");

const createOpenAiInstance = () => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return openai;
};

const createAstraDbInstance = () => {
  const {
    ASTRA_DB_APPLICATION_TOKEN,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_NAMESPACE,
  } = process.env;
  const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
  const astraDb = client.db(ASTRA_DB_API_ENDPOINT, {
    namespace: ASTRA_DB_NAMESPACE,
  });

  return astraDb;
};

const createDocContext = (documents) => `
START CONTEXT
${documents?.map((doc) => doc.content).join("\n")}
END CONTEXT
`;

const createDocContextEMS = (documents) => `
START CONTEXT
${documents
  ?.map((doc) => {
    return doc.embeddingText;
  })
  .join("\n")}
END CONTEXT
`;

const createRagPrompt = (message, docContext) => [
  {
    role: "system",
    content: `You are a highly knowledgeable assistant providing straightforward answers based on company policies. Keep responses short, accurate, and aligned with the context. Format responses using markdown where applicable.
        ${docContext} 
        If the answer is not provided in the context, the AI assistant will say, "Answer not found in company policy.".`,
  },
  { role: "user", content: message },
];

const createRagPromptEMS = (message, docContext) => [
  {
    role: "system",
    content: `You are an expert assistant trained to answer questions based on payroll data. Keep responses short, accurate, and aligned with the context. Format responses using markdown where applicable.
        ${docContext} 
        If the answer is not provided in the context, the AI assistant will say, "Answer not found in EMS DB.".`,
  },
  { role: "user", content: message },
];

const createRagPrompForDates = (message) => [
  {
    role: "system",
    content: `Extract any dates from the sentence. Sentence: ${message} .Format them as YYYY-MM-DDTHH:mm:ss.sss+HH:mm, If Year is not found then consider it current year. If no dates are found, return null. Convert extracted dates into a MongoDB query using new Date(date) and return only the query like { $gte: new Date(date), $lte: new Date(date) }`,
  },
  { role: "user", content: message },
];

const getResponseFromOpenAIChat = async (openai, ragPrompt) =>
  await openai.chat.completions.create({
    model: "gpt-4o",
    messages: ragPrompt,
  });

// Function to convert string to query object
const convertDateStringToQuery = (dateString) => {
  // const regex = /new Date\("([^"]+)"\)/g; // Only for double string comparison
  const regex = /new Date\(['"]([^'"]+)['"]\)/g; // For both single and double string comparison
  const matches = [...dateString.matchAll(regex)];

  if (matches.length === 0) {
    return null; // No valid dates in the string
  }

  const query = {};
  matches.forEach((match, index) => {
    if (index === 0) query.$gte = new Date(match[1]);
    if (index === 1) query.$lte = new Date(match[1]);
  });
  console.log("query", query);
  return query;
};

module.exports = {
  createOpenAiInstance,
  createAstraDbInstance,
  createDocContext,
  createRagPrompt,
  getResponseFromOpenAIChat,
  createDocContextEMS,
  createRagPromptEMS,
  createRagPrompForDates,
  convertDateStringToQuery,
};
