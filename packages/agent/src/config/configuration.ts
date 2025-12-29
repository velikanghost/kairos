export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  indexer: {
    graphqlUrl: process.env.INDEXER_GRAPHQL_URL || 'http://localhost:8080/v1/graphql',
  },

  blockchain: {
    chainId: parseInt(process.env.CHAIN_ID || '11155111', 10),
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
    contracts: {
      poolManager: process.env.POOL_MANAGER_ADDRESS || '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543',
      positionManager: process.env.POSITION_MANAGER_ADDRESS || '0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4',
      universalRouter: process.env.UNIVERSAL_ROUTER_ADDRESS || '0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b',
    },
  },

  encryption: {
    secretKey: process.env.ENCRYPTION_SECRET_KEY,
  },

  pimlico: {
    apiKey: process.env.PIMLICO_API_KEY,
  },

  scheduler: {
    checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES || '1', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
});
