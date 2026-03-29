import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import { NotarizationController } from "./controllers/notarizationController";

const app = express();
app.use(cors());
app.use(express.json());

// Set up Multer per l'upload in memoria
const upload = multer({ storage: multer.memoryStorage() });

// Le due API IOTA (Notarizzazione vs Identità che usavamo prima)
app.post("/notarize", upload.single("document"), NotarizationController.notarizeDocument);
app.post("/verify", NotarizationController.verifyDocument);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 IOTA TrueDoc Notarization Backend acceso su http://127.0.0.1:${PORT}`);
});
