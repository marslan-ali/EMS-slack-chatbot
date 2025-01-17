# EMS ChatBot

A Slack-based chatbot powered by OpenAI's GPT-4 that provides information about company policies and payroll data using RAG (Retrieval Augmented Generation) approach.

## Demo 1

![Policy Query Demo](demo/chat_01.gif)

## Demo 2

![Payroll Query Demo](demo/chat_02.gif)

## Features

### 1. Slack Integration
- Responds to direct messages and mentions in Slack channels
- Secure user authorization system to restrict access to authorized personnel only
- Threaded conversation support

### 2. Dual Knowledge Base Integration

#### Company Policies
- Vector search implementation using AstraDB
- Supports multiple similarity metrics (cosine, euclidean, dot_product)
- Processes and indexes both JSON and PDF policy documents
- Real-time policy information retrieval

#### Payroll System
- MongoDB Atlas Vector Search integration
- Advanced payroll data querying capabilities
- Supports complex date-based queries
- Processes employee salary information, adjustments, and bank details

### 3. Natural Language Processing
- Powered by OpenAI's GPT-4 for natural language understanding
- Text embedding using OpenAI's text-embedding-ada-002 model
- Context-aware responses based on retrieved documents

### 4. Data Management

#### Document Processing
- Automatic text chunking for optimal processing
- PDF document parsing and vectorization
- JSON data processing and embedding generation

#### Vector Search Capabilities
- Efficient similarity search using vector embeddings
- Support for multiple similarity metrics
- Optimized batch processing for large datasets

## Setup and Installation

1. Clone the repository
2. Install dependencies: npm install
3. Configure environment variables in `.env`:

- OPENAI_API_KEY=your_openai_api_key
- SLACK_BOT_TOKEN=your_slack_bot_token
- SLACK_SIGNING_SECRET=your_slack_signing_secret
- MONGODB_URI=your_mongodb_uri
- ASTRA_DB_APPLICATION_TOKEN=your_astra_token
- ASTRA_DB_API_ENDPOINT=your_astra_endpoint
- ASTRA_DB_NAMESPACE=your_astra_namespace


## Available Scripts

- `npm run start:dev` - Start the application in development mode with nodemon
- `npm run start` - Start the application in production mode
- `npm run seed` - Create embeddings for company policies and store in AstraDB
- `npm run embed` - Create embeddings for EMS Payroll Collection

## Usage Examples

The chatbot can answer questions about:
1. Company Policies
2. Employee Salary Information
3. Payroll History
4. Leave Balance
5. Salary Deductions

Example queries:

"What is the company's leave policy?"
"Give me [employee] salary count from [start_date] to [end_date]"
"What was the last month when [employee] received Salary?"
"In [month] [year] how many remaining leaves [employee] had?"



## Security Features

- User authorization middleware
- Secure API key management
- Protected routes and collections

## Technical Architecture

- Node.js backend
- Slack Bolt Framework for Slack integration
- MongoDB Atlas for payroll data storage
- AstraDB for company policy storage
- OpenAI API for natural language processing
- LangChain for RAG implementation

## Dependencies

- @slack/bolt - Slack app framework
- @langchain/openai - LangChain OpenAI integration
- @datastax/astra-db-ts - AstraDB client
- mongoose - MongoDB ODM
- pdf-parse - PDF processing
- dotenv - Environment variable management

## License

ISC
