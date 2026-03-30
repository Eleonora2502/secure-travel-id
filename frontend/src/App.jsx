import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Shield,
  ArrowLeft,
  HelpCircle,
  Fingerprint,
  Upload,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  Focus,
  Lock,
  Target,
  Camera,
  Keyboard
} from 'lucide-react';
import './index.css';
import logoImg from './assets/Logo_Secure_travel_id.png';

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
          <h2>A React Rendering Error Occurred!</h2>
          <p><strong>Details:</strong> {this.state.error?.toString()}</p>
          <pre style={{ fontSize: '10px', overflowX: 'auto' }}>{this.state.info?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [view, setView] = useState('home'); // 'home', 'client', 'host', 'overview'
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Client states
  const fileInputRef = useRef(null);
  const [notarizedToken, setNotarizedToken] = useState(''); // combine(notarizationId, fileHash)
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loadingText, setLoadingText] = useState('');

  // Host states
  const [hostInput, setHostInput] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  // References
  const html5QrCodeRef = useRef(null);
  const isScanningRef = useRef(false);

  const resetState = () => {
    setNotarizedToken('');
    setQrDataUrl('');
    setHostInput('');
    setValidationResult(null);
    setShowManualInput(false);
    setCopied(false);
    stopScanner();
  };

  const handleBack = () => {
    setView('home');
    resetState();
  };

  // Host QR Scanner Logic
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    // Check if DOM element exists
    const readerElement = document.getElementById('reader-custom');
    if (!readerElement) {
      console.error('Reader element not found in DOM');
      alert('Scanner UI not ready. Please try again.');
      return;
    }

    // Clean up old instance first
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.error('Cleanup before start:', e);
      }
      html5QrCodeRef.current = null;
    }

    try {
      html5QrCodeRef.current = new Html5Qrcode('reader-custom');
      isScanningRef.current = true;

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Prevent multiple triggers while stopping
          if (!isScanningRef.current) return;
          isScanningRef.current = false;

          setHostInput(decodedText);
          handleHostVerifyLogic(decodedText);
          stopScanner();
        },
        () => {
          // ignore constant background errors from seeking QR code
        }
      );
      setIsScanning(true);
    } catch (err) {
      console.error('Camera start error:', err);
      setIsScanning(false);
      isScanningRef.current = false;
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.clear();
        } catch (e) { }
        html5QrCodeRef.current = null;
      }
      alert('Could not start camera. Please check permissions.');
    }
  };

  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      isScanningRef.current = false;
      try {
        html5QrCodeRef.current.stop().then(() => {
          if (html5QrCodeRef.current) {
            html5QrCodeRef.current.clear();
            html5QrCodeRef.current = null;
          }
          setIsScanning(false);
        }).catch((e) => {
          console.error('Stop scanner error', e);
          // Ensure cleanup on error
          html5QrCodeRef.current = null;
          setIsScanning(false);
        });
      } catch (e) {
        console.error('Stop error:', e);
        html5QrCodeRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const toggleManualInput = () => {
    if (isScanning) stopScanner();
    setShowManualInput(!showManualInput);
  };

  // CLIENT FLOW: Upload document and Notarize
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setLoadingText('Computing local document fingerprint...');
    try {
      const formData = new FormData();
      formData.append('document', file);

      // Simulate step 1 
      await new Promise(r => setTimeout(r, 800));
      setLoadingText('Notarizing on IOTA Tangle...');

      const response = await fetch(`/api/notarize`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Errore Notarizzazione');

      setLoadingText('Generating cryptographically secure QR code...');
      const combinedToken = `${data.notarizationId}::${data.fileHash}`;
      setNotarizedToken(combinedToken);

      try {
        const url = await QRCode.toDataURL(combinedToken, { width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' } });
        setQrDataUrl(url);
      } catch (err) {
        console.error("QR Code Error:", err);
      }
    } catch (err) {
      console.error(err);
      alert("Errore: " + err.message);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        try { fileInputRef.current.value = ''; } catch (e) { }
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(notarizedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // HOST FLOW: Verify Notarization
  const handleHostVerifyLogic = async (tokenString) => {
    if (!tokenString) return;
    setIsLoading(true);
    try {
      const parts = tokenString.split('::');
      if (parts.length !== 2) throw new Error("Invalid Secure Travel ID format");

      const response = await fetch(`/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notarizationId: parts[0], providedHash: parts[1] }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setValidationResult({ success: true, msg: "Verified. Hash matches on-chain record." });
      } else {
        setValidationResult({ success: false, msg: data.error || "Error: Document hash does not match any valid record on IOTA. The document may have been tampered with." });
      }
    } catch (err) {
      console.error(err);
      setValidationResult({ success: false, msg: "Error: " + err.message + " (IOTA Verification Failed)" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-layout">

      {/* Navbar matching screenshot */}
      <nav className="trustpass-navbar">
        <div className="nav-brand" onClick={handleBack}>
          <img src={logoImg} alt="Secure Travel ID" className="nav-logo" />
          Secure Travel ID
        </div>

        <div className="nav-actions">
          <button className="icon-button" onClick={() => setView('overview')} title="Project Overview">
            <HelpCircle size={20} />
          </button>
        </div>
      </nav>

      <main className="main-content">

        {/* HOMEPAGE */}
        {view === 'home' && (
          <div className="home-layout">
            <div className="home-text-section">
              <div className="fingerprint-icon">
                <img src={logoImg} alt="Secure Travel ID Logo" className="hero-logo" />
              </div>
              <h1>Own your identity,<br />notarize it on IOTA.</h1>
              <p>Protect your sensitive documents with verifiable cryptographic proofs on the IOTA Tangle.</p>
            </div>

            <div className="home-card-section">
              <div className="action-card">
                <button className="btn-primary" onClick={() => setView('client')}>
                  <Shield size={20} /> I am a Traveler
                </button>

                <div className="divider">OR</div>

                <button className="btn-outline" onClick={() => setView('host')}>
                  <Focus size={20} color="var(--accent-gold)" /> I am a Host
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CLIENT VIEW */}
        {view === 'client' && (
          <div className="center-container">
            <div className="view-header">
              <h2>Notarize Identity</h2>
              <p>Generate a secure SHA-256 fingerprint locally on your device.</p>
            </div>

            {!notarizedToken && !isLoading && (
              <>
                <div className="dashed-box" onClick={() => fileInputRef.current.click()}>
                  <div className="icon-wrapper">
                    <Upload size={32} />
                  </div>
                  <h3>Tap to upload ID</h3>
                  <p>Image or PDF. We process this locally.</p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <div className="solid-info-box">
                  <Shield size={20} color="var(--text-muted)" />
                  <span>Your document data will be hashed and <strong>never leave your device</strong>.</span>
                </div>
              </>
            )}

            {isLoading && (
              <div className="client-loading-container">
                <div className="scanning-icon-container">
                  <img src={logoImg} alt="Scanning Logo" className="base-fingerprint" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                  <div className="scanning-beam"></div>
                </div>
                <h3 className="loading-title">Scanning & Notarizing</h3>
                <p className="loading-text">{loadingText}</p>
                <div className="cyber-progress-bar">
                  <div className="cyber-progress-fill"></div>
                </div>
              </div>
            )}

            {notarizedToken && !isLoading && (
              <div style={{ textAlign: 'center', animation: 'fadeIn 0.3s' }}>
                <div className="dashed-box" style={{ cursor: 'default', padding: '2rem' }}>
                  <img src={qrDataUrl} width={200} height={200} alt="QR Code" style={{ borderRadius: '12px', marginBottom: '1.5rem' }} />
                  <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', wordBreak: 'break-all' }}>
                    {notarizedToken}
                  </p>
                  <button className="btn-outline" onClick={copyToClipboard} style={{ width: 'auto', padding: '0.75rem 1.5rem', margin: '0 auto' }}>
                    {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
                    {copied ? 'Copied!' : 'Copy Token'}
                  </button>
                </div>

                <div className="solid-info-box" style={{ marginTop: '1.5rem' }}>
                  <Shield size={20} color="var(--success-color)" />
                  <span>Show this QR code to your host. They will verify your identity on-chain.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* HOST VIEW */}
        {view === 'host' && (
          <div className="center-container">
            <div className="view-header">
              <h2>Host Verification</h2>
              <p>Scan a TrustPass QR code to verify cryptographically.</p>
            </div>

            {!validationResult && !isLoading && (
              <div className="host-scanner-container">

                {/* Custom Scanner UI */}
                {!showManualInput ? (
                  <div className="scanner-presentation-box">
                    <div className="scanner-viewport-wrapper">
                      <div id="reader-custom" className={`scanner-viewport ${isScanning ? 'active' : ''}`}></div>
                      {!isScanning && (
                        <div className="scanner-idle" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', background: '#000', justifyContent: 'center' }}>
                          <Focus size={48} color="var(--accent-gold)" style={{ opacity: 0.6 }} />
                          <p>Ready to verify identity</p>
                        </div>
                      )}
                    </div>

                    {!isScanning ? (
                      <button className="btn-primary" onClick={startScanner} style={{ width: '80%', margin: '0 auto 1.5rem', background: 'var(--accent-gold)', color: 'black' }}>
                        <Camera size={20} />
                        Start Scanning
                      </button>
                    ) : (
                      <button className="btn-outline" onClick={stopScanner} style={{ width: '80%', margin: '0 auto 1.5rem', borderColor: 'var(--error-color)', color: 'var(--error-color)' }}>
                        <XCircle size={20} />
                        Cancel
                      </button>
                    )}

                    <div className="manual-toggle-text" onClick={toggleManualInput}>
                      <Keyboard size={14} /> Enter code manually instead
                    </div>
                  </div>
                ) : (
                  <div className="manual-input-box">
                    <h3 style={{ margin: '0 0 1rem 0', fontWeight: '500' }}>Manual Entry</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Paste the Secure Travel ID token provided by the traveler.</p>
                    <input
                      className="input-area"
                      style={{ padding: '1rem', marginBottom: '1rem' }}
                      value={hostInput}
                      onChange={e => setHostInput(e.target.value)}
                      placeholder="Paste ID::Hash"
                    />
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button className="btn-outline" style={{ flex: 1 }} onClick={toggleManualInput}>
                        Cancel
                      </button>
                      <button className="btn-primary" style={{ flex: 1, background: 'var(--accent-gold)', color: 'black' }} onClick={() => handleHostVerifyLogic(hostInput)}>
                        Verify
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

            {isLoading && (
              <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                <Loader2 size={48} className="loader" color="var(--accent-gold)" style={{ margin: '0 auto 1rem' }} />
                <p>Checking IOTA ledger...</p>
              </div>
            )}

            {validationResult && !isLoading && (
              <div className={`status-box ${validationResult.success ? '' : 'error'} fade-in`}>
                {validationResult.success ? <CheckCircle size={64} style={{ margin: '0 auto 1rem' }} /> : <XCircle size={64} style={{ margin: '0 auto 1rem' }} />}
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>
                  {validationResult.success ? 'Document Verified' : 'Verification Failed'}
                </h3>
                <p style={{ margin: 0, opacity: 0.9 }}>{validationResult.msg}</p>

                <button
                  className="btn-outline"
                  style={{ marginTop: '2rem', borderColor: 'currentColor', color: 'currentColor' }}
                  onClick={() => {
                    setValidationResult(null);
                    setHostInput('');
                    if (!showManualInput) startScanner();
                  }}
                >
                  Scan Another Code
                </button>
              </div>
            )}
          </div>
        )}

        {/* OVERVIEW VIEW */}
        {view === 'overview' && (
          <div className="overview-layout">
            <div className="overview-header">
              <span className="label">Project Overview</span>
              <h1>Secure Travel ID</h1>
              <p>Digital Identity Notarization for Travel Check-in. Replace insecure document sharing with verifiable on-chain cryptographic proofs.</p>
            </div>

            <div className="overview-grid">
              <div className="overview-card">
                <Target size={32} className="card-icon" />
                <h3>The Problem</h3>
                <p>Travelers are currently forced to send photos of sensitive documents (ID cards, passports) to unknown hosts via WhatsApp or email, completely losing control over their data footprint.</p>
              </div>

              <div className="overview-card blue-icon">
                <Lock size={32} className="card-icon" />
                <h3>The Solution</h3>
                <p>Secure Travel ID replaces raw document sharing with verifiable, untampered proofs notarized on the IOTA blockchain. Hosts verify a cryptographic guarantee instead of collecting JPEGs.</p>
              </div>
            </div>

            <button className="btn-outline" style={{ marginTop: '3rem', width: 'max-content', padding: '1rem 2rem', margin: '3rem auto 0' }} onClick={handleBack}>
              Return to App
            </button>
          </div>
        )}

      </main>
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