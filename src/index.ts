import { config } from "dotenv";
import { IBundler, Bundler } from "@biconomy/bundler";
import {
  BiconomySmartAccountV2,
  DEFAULT_ENTRYPOINT_ADDRESS,
} from "@biconomy/account";
import { ethers } from "ethers";
import { ChainId } from "@biconomy/core-types";
import {
  ECDSAOwnershipValidationModule,
  DEFAULT_ECDSA_OWNERSHIP_MODULE,
} from "@biconomy/modules";
import { PaymasterMode } from "@biconomy/paymaster";
config();

const bundler: IBundler = new Bundler({
  bundlerUrl:
    process.env.BUNDLER_URL ||
    "https://bundler.biconomy.io/api/v2/420/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44",
  chainId: ChainId.OPTIMISM_GOERLI_TESTNET,
  entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
});

const provider = new ethers.providers.JsonRpcProvider(
  process.env.RPC_URL || "https://optimism-goerli.publicnode.com"
);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);

async function initializeSmartAccount() {
  const module = await ECDSAOwnershipValidationModule.create({
    signer: wallet,
    moduleAddress: DEFAULT_ECDSA_OWNERSHIP_MODULE,
  });

  let biconomyAccount = await BiconomySmartAccountV2.create({
    chainId: ChainId.OPTIMISM_GOERLI_TESTNET,
    bundler: bundler,
    entryPointAddress: DEFAULT_ENTRYPOINT_ADDRESS,
    defaultValidationModule: module,
    activeValidationModule: module,
  });

  // Log the EOA owner's address and the Smart Account address
  console.log("EOA Owner Address:", wallet.address);
  console.log(
    "Smart Account Address:",
    await biconomyAccount.getAccountAddress()
  );

  return biconomyAccount;
}

async function buildUserOp(smartAccount: BiconomySmartAccountV2) {
  try {
    const transaction = {
      to: "0x1fD06f088c720bA3b7a3634a8F021Fdd485DcA42",
      data: "0x",
      value: ethers.utils.parseEther("0.01"),
    };

    const userOp = await smartAccount.buildUserOp([transaction]);
    userOp.paymasterAndData = "0x";
    return userOp;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error building user operation:", error.message);
    }
  }
}

async function submitUserOp() {
  try {
    // Initialize your Smart Account
    const smartAccount = await initializeSmartAccount();

    // Build the user operation
    const userOp = await buildUserOp(smartAccount);
    if (!userOp) {
      console.error("Error: Could not create the user operation.");
      return;
    }

    // Send the user operation and wait for the transaction to complete
    const userOpResponse = await smartAccount.sendUserOp(userOp);
    const transactionDetails = await userOpResponse.wait(5);

    console.log("See your transaction details here:");
    console.log(
      `https://https://goerli-optimism.etherscan.io/tx/${transactionDetails.receipt.transactionHash}`
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Transaction Error:", error.message);
    }
  }
}

async function mintNFT() {
  // Create and initialize the smart account
  const smartAccount = await initializeSmartAccount();
  // Retrieve the address of the initialized smart account
  const address = await smartAccount.getAccountAddress();
  // Define the interface for interacting with the NFT contract
  const nftInterface = new ethers.utils.Interface([
    "function safeMint(address _to)",
  ]);
  // Encode the data for the 'safeMint' function call with the smart account address
  const data = nftInterface.encodeFunctionData("safeMint", [address]);
  // Specify the address of the NFT contract
  const nftAddress = "0x1758f42Af7026fBbB559Dc60EcE0De3ef81f665e";

  // Define the transaction to be sent to the NFT contract
  const transaction = {
    to: nftAddress,
    data: data,
  };

  // Build a partial User Operation (UserOp) with the transaction and set it to be sponsored
  let partialUserOp = await smartAccount.buildUserOp([transaction], {
    paymasterServiceData: {
      mode: PaymasterMode.SPONSORED,
    },
  });

  // Try to execute the UserOp and handle any errors
  try {
    // Send the UserOp through the smart account
    const userOpResponse = await smartAccount.sendUserOp(partialUserOp);
    // Wait for the transaction to complete and retrieve details
    const transactionDetails = await userOpResponse.wait();
    // Log the transaction details URL and the URL to view minted NFTs
    console.log(`View Minted NFTs: https://testnets.opensea.io/${address}`);
    console.log(
      `Transaction Details: https://mumbai.polygonscan.com/tx/${transactionDetails.receipt.transactionHash}`
    );
  } catch (e) {
    // Log any errors encountered during the transaction
    console.log("Error encountered: ", e);
  }
}

// submitUserOp();
