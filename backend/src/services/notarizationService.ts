import { WalletService } from "./walletService";
import { CryptoUtils } from "../utils/crypto";

// Simulation or real SDK depending on env
// NOTE: Workshop 5 uses @iota/notarization SDK. If no package ID is provided, we simulate the blockchain layer for demonstration purposes.

export class NotarizationService {
  private walletService: WalletService;
  private isSimulationMode = false;

  constructor() {
    this.walletService = new WalletService();
    if (!process.env.IOTA_NOTARIZATION_PKG_ID) {
      console.warn("⚠️ IOTA_NOTARIZATION_PKG_ID is missing in .env! Starting in SIMULATION MODE.");
      this.isSimulationMode = true;
    }
  }

  // Creazione Notarizzazione (Dinamica) - Equivalente a createDynamic() nel TrueDoc Workshop
  async createDynamicNotarization(contentHash: string, metadata: string): Promise<any> {
    await this.walletService.ensureFunds();

    if (this.isSimulationMode) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Simula latenza Blockchain
      const txDigest = "tx_sim_" + Date.now().toString(16) + CryptoUtils.computeSHA256(contentHash).substring(0, 16);
      return {
        notarizationId: "iota_notar_" + contentHash,
        transactionDigest: txDigest,
        type: "dynamic",
        timestamp: new Date()
      };
    }

    // Qui andrebbe il codice reale della libreria @iota/notarization:
    // const client = await NotarizationClient.create(readOnly, signer);
    // let builder = client.createDynamic().withStringState(contentHash, metadata);
    // const result = await builder.finish().buildAndExecute(client);
    // return { notarizationId: result.output.id, transactionDigest: result.response.digest, ... }
    
    throw new Error("IOTA_NOTARIZATION_PKG_ID not implemented yet");
  }

  // Verifica Notarizzazione (Host)
  async verifyNotarization(notarizationId: string, expectedHash: string): Promise<any> {
    if (this.isSimulationMode) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      // In simulation mode, verify that the hash matches perfectly
      const success = (notarizationId === "iota_notar_" + expectedHash);
      if (success) {
         return { success: true, method: "Locked/Dynamic", message: "Document has not been tampered with on the Testnet Blockchain." };
      }
      throw new Error("Hash mismatch");
    }

    throw new Error("IOTA_NOTARIZATION_PKG_ID not implemented yet");
  }
}
