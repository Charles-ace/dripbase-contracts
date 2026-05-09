# DripBase

A minimal onchain tipping system. Send ETH tips to any wallet address with an optional message.

Deployed on **Base** (OP Stack / EVM-compatible).

## Project Structure

```
contracts/
  DripBase.sol       — Core tipping contract
scripts/
  deploy.js          — Deployment script for Base Sepolia
test/
  DripBase.test.js   — Full test suite
hardhat.config.js    — Hardhat configuration (Base Sepolia & Mainnet)
.env.example         — Environment variable template
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in your environment variables
cp .env.example .env

# 3. Compile the contract
npm run compile

# 4. Run tests
npm test

# 5. Deploy to Base Sepolia
npm run deploy:base-sepolia
```

## Contract Interface

### `tip(address recipient, string message)`

Send ETH to any recipient with an optional message.

- **msg.value**: Amount of ETH to tip (must be > 0)
- **recipient**: Wallet address to receive the tip
- **message**: Short note or username tag (can be empty)

### Event: `TipSent`

```solidity
event TipSent(
    address indexed sender,
    address indexed recipient,
    uint256 amount,
    string message
);
```

## Environment Variables

| Variable              | Description                         | Required |
| --------------------- | ----------------------------------- | -------- |
| `DEPLOYER_PRIVATE_KEY`| Deployer wallet private key         | Yes      |
| `BASE_SEPOLIA_RPC_URL`| Base Sepolia RPC endpoint           | No       |
| `BASESCAN_API_KEY`    | Basescan API key for verification   | No       |

## License

MIT
