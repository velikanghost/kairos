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
    chainId: parseInt(process.env.CHAIN_ID || '143', 10),
    rpcUrl: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.network',
    contracts: {
      poolManager: process.env.POOL_MANAGER_ADDRESS || '0x188d586Ddcf52439676Ca21A244753fA19F9Ea8e',
      positionManager: process.env.POSITION_MANAGER_ADDRESS || '0x5b7eC4a94fF9beDb700fb82aB09d5846972F4016',
      kuruDexRouter: process.env.KURU_DEX_ROUTER_ADDRESS || '0xd651346d7c789536ebf06dc72aE3C8502cd695CC',
      kuruMarginAccount: process.env.KURU_MARGIN_ACCOUNT_ADDRESS || '0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5',
    },
  },

  scheduler: {
    checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES || '1', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
});
