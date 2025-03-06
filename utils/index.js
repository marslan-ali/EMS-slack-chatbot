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

/**
 * Classifies a given message into one of two categories: "company policy" or "EMS DB".
 *
 * @param {Object} openai - The OpenAI instance used to interact with the OpenAI API.
 * @param {string} message - The message to be classified.
 * @returns {Promise<string>} - The classification result, either "company policy" or "EMS DB".
 */
const classifyMessage = async (openai, message) => {
  const prompt = [
    {
      role: "system",
      content: `
      You are an intelligent assistant trained to classify messages into one of two categories: "company policy" or "EMS DB." Follow these instructions carefully:
      1. Classify a message as company policy if it pertains to:
        - Company rules, regulations, or organizational policies.
        - Leave encashment, general guidelines, or standard procedures.

      2. Classify a message as EMS DB if it involves:
        - Employee management systems or databases.
        - Topics such as roles, leaves, payroll, salary, or related database queries.

      3. Use tone, keywords, and context to infer the category, even if the message does not explicitly mention "EMS" or "policy." Identify the underlying intent of the message.

      **Examples for better understanding:**
      - "What is the job role of?" → EMS DB
      - "What are the working hours?" → company policy
      - "How is leave encashment calculated?" → company policy
      - "Can I check the leave balance in the system?" → EMS DB

      Now, classify the following message:
      "${message}"
      `,
    },
    { role: "user", content: message },
  ];

  const response = await getResponseFromOpenAIChat(openai, prompt);
  return response.choices[0].message.content.trim();
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
  classifyMessage,
};
