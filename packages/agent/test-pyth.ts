/**
 * Test script to verify Pyth Network oracle integration using Hermes API
 *
 * Pyth uses a PULL oracle model:
 * 1. Fetch latest price data from Hermes API (off-chain)
 * 2. Submit price update to Pyth contract (on-chain) with fee
 * 3. Read the price from contract
 *
 * For read-only access, we'll use Hermes API directly
 */

// Pyth Hermes API endpoint
const HERMES_API = 'https://hermes.pyth.network';

// ETH/USD Price Feed ID from Pyth
const ETH_USD_FEED_ID =
  '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';

interface PythPrice {
  id: string;
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
  ema_price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
}

async function testPythHermesAPI() {
  console.log('🔍 Testing Pyth Network via Hermes API\n');
  console.log('Hermes API:', HERMES_API);
  console.log('Price Feed ID:', ETH_USD_FEED_ID);
  console.log('Asset: ETH/USD\n');

  try {
    // Fetch latest price from Hermes API
    const url = `${HERMES_API}/v2/updates/price/latest?ids[]=${ETH_USD_FEED_ID}`;

    console.log('📡 Fetching from Hermes API...\n');

    const startTime = Date.now();
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    if (!data.parsed || data.parsed.length === 0) {
      throw new Error('No price data returned from Hermes');
    }

    const priceData: PythPrice = data.parsed[0];

    // Convert price with exponent
    const price = BigInt(priceData.price.price);
    const expo = priceData.price.expo;
    const actualPrice = Number(price) * Math.pow(10, expo);

    const conf = BigInt(priceData.price.conf);
    const confidence = Number(conf) * Math.pow(10, expo);

    const publishTime = priceData.price.publish_time;
    const ageSeconds = Math.floor(Date.now() / 1000) - publishTime;

    console.log(`✅ SUCCESS (${duration}ms)\n`);
    console.log('📊 Price Data:');
    console.log(`   Price: $${actualPrice.toFixed(2)}`);
    console.log(`   Confidence: ±$${confidence.toFixed(2)}`);
    console.log(`   Exponent: ${expo}`);
    console.log(`   Published: ${new Date(publishTime * 1000).toISOString()}`);
    console.log(`   Age: ${ageSeconds}s ago`);

    if (ageSeconds > 60) {
      console.log(
        `   ⚠️  WARNING: Price is ${ageSeconds}s old (> 60s stale threshold)`,
      );
    }

    console.log('\n📈 EMA Price:');
    const emaPrice =
      Number(BigInt(priceData.ema_price.price)) *
      Math.pow(10, priceData.ema_price.expo);
    console.log(`   EMA Price: $${emaPrice.toFixed(2)}`);

    console.log('\n\n✅ Pyth Hermes API is working correctly!');
    console.log('\nℹ️  For production use:');
    console.log('   1. Always check price age before using');
    console.log('   2. Handle stale prices gracefully');
    console.log('   3. Never use hardcoded fallback prices');
    console.log(
      '   4. Consider using confidence intervals for risk management',
    );

    return actualPrice;
  } catch (error: any) {
    console.error('❌ FAILED');
    console.error(`Error: ${error.message}`);
    throw error;
  }
}

// Run the test
testPythHermesAPI()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
