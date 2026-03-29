import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  Shield, 
  User, 
  Building, 
  ArrowLeft, 
  ScanLine, 
  Camera, 
  Link as LinkIcon, 
  CheckCircle, 
  XCircle,
  Loader2, 
  Copy ,
  FileText
} from 'lucide-react';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    this.setState({ error, info });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', background: 'white', color: 'red', borderRadius: '12px' }}>
          <h2>Si è verificato un Errore di Rendering React!</h2>
          <p><strong>Dettaglio:</strong> {this.state.error?.toString()}</p>
          <pre style={{ fontSize: '10px', overflowX: 'auto' }}>{this.state.info?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [view, setView] = useState('home'); // 'home', 'client', 'host'
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [copied, setCopied] = useState(false);

  // Client states
  const fileInputRef = useRef(null);
  const [notarizedToken, setNotarizedToken] = useState(''); // combine(notarizationId, fileHash)
  const [documentHash, setDocumentHash] = useState(''); // the raw SHA-256 hash
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Host states
  const [hostMode, setHostMode] = useState(''); // 'qr', 'link'
  const [hostInput, setHostInput] = useState('');
  const [validationResult, setValidationResult] = useState(null);

  const resetState = () => {
    setNotarizedToken('');
    setDocumentHash('');
    setQrDataUrl('');
    setHostMode('');
    setHostInput('');
    setValidationResult(null);
    setCopied(false);
  };

  const handleBack = () => {
    setView('home');
    resetState();
  };

  useEffect(() => {
    let scanner = null;
    if (view === 'host' && hostMode === 'qr' && !isLoading && !validationResult) {
       scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
       scanner.render((decodedText) => {
           scanner.clear();
           setHostInput(decodedText);
       }, (err) => {
           // ignore silent scanner warnings
       });
    }
    return () => {
       if (scanner) {
           scanner.clear().catch(e => console.error(e));
       }
    }
  }, [view, hostMode, isLoading, validationResult]);

  // CLIENT FLOW: Upload document and Notarize via TrueDoc (Hash)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setLoadingText('Calcolo impronta Hash e Notarizzazione su IOTA TrueDoc...');
    try {
      const formData = new FormData();
      formData.append('document', file);

      const response = await fetch(`http://127.0.0.1:3001/notarize`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Errore Notarizzazione');

      // The QR code will just contain the string combining ID and Hash
      const combinedToken = `${data.notarizationId}::${data.fileHash}`;
      setNotarizedToken(combinedToken);
      setDocumentHash(data.fileHash);
      
      // Generazione immagine QR sicura
      try {
        const url = await QRCode.toDataURL(combinedToken, { width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
        setQrDataUrl(url);
      } catch (err) {
        console.error("QR Code Error:", err);
      }
    } catch (err) {
      console.error(err);
      alert("Errore caricamento IOTA: " + err.message);
    } finally {
      setIsLoading(false);
      setLoadingText('');
      // FIX CRITICO: Resetta l'input file per far scattare di nuovo onChange sullo stesso file!
      if (fileInputRef.current) {
         try { fileInputRef.current.value = ''; } catch(e) {}
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(notarizedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // HOST FLOW: Verify Notarization
  const handleHostVerify = async () => {
    if (!hostInput) return;
    setIsLoading(true);
    setLoadingText('Verifica Integrità e Scadenza su Blockchain...');
    try {
      const parts = hostInput.split('::');
      if (parts.length !== 2) throw new Error("Formato Token TrueDoc invalido (atteso ID::HASH)");

      const response = await fetch(`http://127.0.0.1:3001/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notarizationId: parts[0], providedHash: parts[1] }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setValidationResult({ success: true, msg: "Documento Immutabile. Non è stato manomesso." });
      } else {
        setValidationResult({ success: false, msg: data.error || "Firma invalida sulla Blockchain!" });
      }
    } catch (err) {
      console.error(err);
      setValidationResult({ success: false, msg: err.message });
    } finally {
      setIsLoading(false);
      setLoadingText('');
    }
  };


  return (
    <div className="wallet-container">
      <div className="wallet-header">
        {view !== 'home' && (
          <button className="back-btn" onClick={handleBack} title="Torna Indietro">
            <ArrowLeft size={24} />
          </button>
        )}
        <h1>TrueDoc Notarization</h1>
        <p>
          {view === 'home' && 'Scegli il tuo ruolo per continuare'}
          {view === 'client' && 'Area Cliente (Notarizzazione File)'}
          {view === 'host' && 'Area Host (Verifica Hash)'}
        </p>
      </div>

      {view === 'home' && (
        <div className="roles-grid fade-in">
          <div className="role-card" onClick={() => setView('client')}>
            <div className="role-icon"><FileText size={32} /></div>
            <div className="role-info">
              <h2>Protocolla un File</h2>
              <p>Carica un documento per generare l'Hash e renderlo Immutabile su IOTA</p>
            </div>
          </div>
          
          <div className="role-card" onClick={() => setView('host')}>
            <div className="role-icon"><Building size={32} /></div>
            <div className="role-info">
              <h2>Sono un Host</h2>
              <p>Verifica che il documento ricevuto al check-in sia originale</p>
            </div>
          </div>
        </div>
      )}

      {view === 'client' && (
        <div className="client-view fade-in">
          {!notarizedToken && !isLoading && (
            <div style={{ textAlign: 'center' }}>
              <div className="scanner-animation" style={{ animation: 'none', background: 'transparent' }}>
                 <ScanLine size={48} opacity={0.5} />
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileUpload}
              />
              <button className="wallet-btn" onClick={() => fileInputRef.current.click()}>
                <ScanLine size={20} />
                Carica File per la Notarizzazione
              </button>
              <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Nessun file verrà caricato online! Ne leggeremo solo l'impronta crittografica (Hash) per registrarla sulla Blockchain.
              </p>
            </div>
          )}

          {isLoading && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div className="scanner-animation">
                <div className="scanner-line"></div>
                <ScanLine size={48} />
              </div>
              <p style={{ color: 'var(--accent)', fontWeight: '600' }}>{loadingText}</p>
            </div>
          )}

          {notarizedToken && !isLoading && (
            <div className="fade-in">
              <div style={{ textAlign: 'center', color: 'var(--success)', fontWeight: '600', marginBottom: '1rem' }}>
                <CheckCircle size={40} style={{ margin: '0 auto 0.5rem' }} />
                Documento Notarizzato con Successo!
              </div>
              
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Impronta Hash (SHA-256) Registrata:</p>
                <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--accent)' }}>
                  {documentHash}
                </div>
              </div>

              <div className="qr-container">
                 {/* QR CODE containing the TrueDoc Token */}
                 {qrDataUrl && <img src={qrDataUrl} width={200} height={200} alt="QR Code" style={{ borderRadius: '8px' }} />}
              </div>

              <div className="jwt-link-box">
                <LinkIcon size={16} color="var(--accent)" style={{flexShrink: 0}} />
                <div className="jwt-text" title={notarizedToken}>{notarizedToken}</div>
                <button className="copy-btn" onClick={copyToClipboard} title="Copia Token TrueDoc">
                  {copied ? <CheckCircle size={14}/> : <Copy size={14}/>}
                  {copied ? 'Copiato' : 'Copia'}
                </button>
              </div>
              <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Mostra questo QR Code (o copia il Token) all'Hotel. Dimostra che il file non è stato manomesso.
              </p>
            </div>
          )}
        </div>
      )}

      {view === 'host' && (
        <div className="host-view fade-in">
          {!hostMode && !validationResult && !isLoading && (
             <div className="roles-grid">
               <div className="role-card" onClick={() => setHostMode('qr')}>
                 <div className="role-icon"><Camera size={28} /></div>
                 <div className="role-info">
                   <h2>Scansiona QR Code</h2>
                   <p>Usa la fotocamera per scannerizzare il QR del Cliente</p>
                 </div>
               </div>
               <div className="role-card" onClick={() => setHostMode('link')}>
                 <div className="role-icon"><LinkIcon size={28} /></div>
                 <div className="role-info">
                   <h2>Inserisci Token Hash</h2>
                   <p>Incolla manualmente il Token TrueDoc</p>
                 </div>
               </div>
             </div>
          )}

          {hostMode === 'link' && !validationResult && !isLoading && (
            <div className="fade-in">
              <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Inserisci il Token (ID::Hash) fornito dal Cliente:
              </div>
              <textarea 
                className="input-field" 
                rows={4} 
                style={{ resize: 'none' }}
                placeholder="iota_notar_..."
                value={hostInput}
                onChange={e => setHostInput(e.target.value)}
              />
              <div className="flex-gap">
                <button className="wallet-btn outline" onClick={() => setHostMode('')}>Annulla</button>
                <button className="wallet-btn" onClick={handleHostVerify} disabled={!hostInput}>
                  <Shield size={18} /> Valida Integrità
                </button>
              </div>
            </div>
          )}

          {hostMode === 'qr' && !validationResult && !isLoading && (
            <div className="fade-in" style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Inquadra il QR Code del Cliente tramite Truedoc:
              </div>
              
              <div id="reader" style={{ width: '100%', maxWidth: '400px', margin: '0 auto', background: 'white', border: '1px solid var(--accent)', borderRadius: '12px', overflow: 'hidden' }}></div>
              
              {hostInput && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
                   <p style={{ color: 'var(--success)', fontWeight: 'bold' }}>QR Code Rilevato con Successo!</p>
                   <p style={{ wordBreak: 'break-all', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{hostInput}</p>
                </div>
              )}

              <div className="flex-gap" style={{ marginTop: '1rem' }}>
                <button className="wallet-btn outline" onClick={() => { setHostMode(''); setHostInput(''); }}>Annulla</button>
                <button className="wallet-btn" onClick={handleHostVerify} disabled={!hostInput}>
                  <Shield size={18} /> Procedi e Valida
                </button>
              </div>
            </div>
          )}

          {isLoading && (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
               <Loader2 size={48} className="loader" color="var(--accent)" style={{ margin: '0 auto 1rem' }} />
               <p style={{ color: 'var(--accent)', fontWeight: '600' }}>{loadingText}</p>
            </div>
          )}

          {validationResult && !isLoading && (
            <div className={`status-badge ${validationResult.success ? '' : 'error'} fade-in`}>
              {validationResult.success ? <CheckCircle size={48} /> : <XCircle size={48} />}
              <div>
                <strong>{validationResult.success ? 'File Originale (Su IOTA)' : 'Hash Non Valido!'}</strong>
                <p style={{ fontSize: '0.9rem', color: 'currentColor', marginTop: '0.5rem', opacity: 0.8 }}>
                  {validationResult.msg}
                </p>
              </div>
              
              <button 
                className="wallet-btn outline" 
                style={{ marginTop: '1rem' }}
                onClick={() => { setValidationResult(null); setHostInput(''); setHostMode(''); }}
              >
                Nuova Scansione
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}