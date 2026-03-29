import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { IotaClient, getFullnodeUrl } from "@iota/iota-sdk/client";
import { getFaucetHost, requestIotaFromFaucetV0 } from "@iota/iota-sdk/faucet";
import { decodeIotaPrivateKey } from "@iota/iota-sdk/cryptography";
import dotenv from "dotenv";

dotenv.config();

export class WalletService {
  private keypair: Ed25519Keypair;
  private signer: any;
  private iotaClient: IotaClient;

  constructor() {
    const privateKey = process.env.PRIVATE_KEY;
    
    if (privateKey) {
      try {
        if (privateKey.startsWith('iotaprivkey1')) {
          const { schema, secretKey } = decodeIotaPrivateKey(privateKey);
          if (schema !== 'ED25519') throw new Error(`Unsupported schema`);
          this.keypair = Ed25519Keypair.fromSecretKey(secretKey);
        } else {
          const privateKeyBytes = Buffer.from(privateKey, 'base64');
          this.keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
        }
      } catch (error) {
        console.error("❌ Invalid private key in env", error);
        this.keypair = this.generateNewKeypair();
      }
    } else {
      this.keypair = this.generateNewKeypair();
    }

    // Mock dello signer per la simulation mode
    this.signer = {} as any;
    this.iotaClient = new IotaClient({ 
      url: process.env.NETWORK_URL || getFullnodeUrl("testnet")
    });
  }

  private generateNewKeypair(): Ed25519Keypair {
    const kp = Ed25519Keypair.generate();
    console.log("New Private Key:", kp.getSecretKey());
    console.log("New Address:", kp.toIotaAddress());
    return kp;
  }

  getKeypair() { return this.keypair; }
  getSigner() { return this.signer; }
  getIotaClient() { return this.iotaClient; }
  getAddress() { return this.keypair.toIotaAddress(); }

  async ensureFunds(): Promise<void> {
    try {
      const balance = await this.iotaClient.getBalance({ owner: this.getAddress() });
      if (balance.totalBalance === "0") {
        console.log("⏳ Richiesta token Testnet Faucet IOTA...");
        try {
          let success = false;
          for (let i = 0; i < 3; i++) {
             try {
                await requestIotaFromFaucetV0({ host: getFaucetHost("testnet"), recipient: this.getAddress() });
                success = true; break;
             } catch(e) {
                console.log("Faucet err, rigenero", e);
                await new Promise(r => setTimeout(r, 10000));
             }
          }
          if (!success) throw new Error("Faucet failure");
          console.log("⏳ Attendo transazione IOTA Faucet...");
          await new Promise(resolve => setTimeout(resolve, 15000));
        } catch(e) {
           console.error("Errore Faucet. Nessun fondo Testnet.");
        }
      } else {
        console.log(`✅ Faucet Funds OK (${balance.totalBalance})`);
      }
    } catch (error) {
      console.error("❌ Error ensuring funds:", error);
    }
  }
}
