import { Request, Response } from "express";
import { NotarizationService } from "../services/notarizationService";
import { CryptoUtils } from "../utils/crypto";

const notarizationService = new NotarizationService();

export class NotarizationController {
  static async notarizeDocument(req: Request, res: Response) {
    try {
      const fileBuffer = req.file?.buffer;
      if (!fileBuffer) {
        return res.status(400).json({ error: "No document provided" });
      }

      // 1. Calcola l'Hash (TrueDoc non carica mai file puri su IOTA, solo hash sicuri)
      const fileHash = CryptoUtils.computeFileHash(fileBuffer);
      const filename = req.file?.originalname || "unknown.ext";
      const metadata = JSON.stringify({ filename, timestamp: new Date().toISOString() });
      
      // 2. Notarizza
      const result = await notarizationService.createDynamicNotarization(fileHash, metadata);

      res.json({ success: true, fileHash, notarizationId: result.notarizationId, digest: result.transactionDigest });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  }

  static async verifyDocument(req: Request, res: Response) {
    try {
      const { notarizationId, providedHash } = req.body;
      if (!notarizationId || !providedHash) {
         return res.status(400).json({ error: "Missing notarizationId or alphanumeric Hash" });
      }

      const verified = await notarizationService.verifyNotarization(notarizationId, providedHash);
      res.json({ success: true, message: verified.message || "Immutable TrueDoc validation guaranteed!" });
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ success: false, error: "Invalid or tampered signature!" });
    }
  }
}
