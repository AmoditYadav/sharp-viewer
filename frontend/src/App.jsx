import React, { useState, useEffect } from 'react';
import ViewerCanvas from './components/ViewerCanvas';

/**
 * Medical 3D Splat Viewer
 * Upload images → ComfyUI generates PLY → Display directly using gsplat.js
 */
export default function App() {
  // Image uploads
  const [image1, setImage1] = useState(null);
  const [image2, setImage2] = useState(null);
  const [image1Preview, setImage1Preview] = useState(null);
  const [image2Preview, setImage2Preview] = useState(null);

  // Generated PLY with camera parameters
  const [model1, setModel1] = useState(null);
  const [model2, setModel2] = useState(null);

  // State
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('Upload two images to analyze');
  const [error, setError] = useState(null);
  const [comfyOnline, setComfyOnline] = useState(false);

  // Check ComfyUI health
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        setComfyOnline(data.comfyui);
      } catch {
        setComfyOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle image selection
  const handleImage1 = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage1(file);
      setImage1Preview(URL.createObjectURL(file));
      setModel1(null);
    }
  };

  const handleImage2 = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage2(file);
      setImage2Preview(URL.createObjectURL(file));
      setModel2(null);
    }
  };

  // Process images
  const handleProcess = async () => {
    if (!image1 || !image2) {
      setError('Please select both images');
      return;
    }

    if (!comfyOnline) {
      setError('ComfyUI is not running. Start it first.');
      return;
    }

    setProcessing(true);
    setError(null);
    setStatus('Uploading images...');

    try {
      // Upload image 1
      const formData1 = new FormData();
      formData1.append('file', image1);
      const upload1 = await fetch('/api/upload', { method: 'POST', body: formData1 });
      const result1 = await upload1.json();
      const filename1 = result1.filename;

      // Upload image 2
      const formData2 = new FormData();
      formData2.append('file', image2);
      const upload2 = await fetch('/api/upload', { method: 'POST', body: formData2 });
      const result2 = await upload2.json();
      const filename2 = result2.filename;

      setStatus('Processing Day 1 in ComfyUI (this may take a few minutes)...');

      // Process Day 1
      const proc1 = await fetch('/api/process-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filename1 })
      });

      if (!proc1.ok) {
        const err = await proc1.json();
        throw new Error(err.detail || 'Failed to process Day 1');
      }

      const result1Data = await proc1.json();
      // Store PLY with camera parameters
      setModel1({
        ply: result1Data.ply,
        extrinsics: result1Data.extrinsics,
        intrinsics: result1Data.intrinsics,
        filename: result1Data.filename
      });

      setStatus('Processing Day 2 in ComfyUI...');

      // Process Day 2
      const proc2 = await fetch('/api/process-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: filename2 })
      });

      if (!proc2.ok) {
        const err = await proc2.json();
        throw new Error(err.detail || 'Failed to process Day 2');
      }

      const result2Data = await proc2.json();
      setModel2({
        ply: result2Data.ply,
        extrinsics: result2Data.extrinsics,
        intrinsics: result2Data.intrinsics,
        filename: result2Data.filename
      });

      setStatus('Done! Models loaded.');

    } catch (err) {
      console.error(err);
      setError(err.message);
      setStatus('Error occurred');
    } finally {
      setProcessing(false);
    }
  };

  // Volume calculation state
  const [calculatingVolume, setCalculatingVolume] = useState(false);
  const [volumeResult, setVolumeResult] = useState(null);

  // Calculate volume growth
  const handleCalculateVolume = async () => {
    if (!model1 || !model2) return;

    setCalculatingVolume(true);
    setError(null);
    setStatus('Calculating volumetric growth...');

    try {
      const res = await fetch('/api/analyze-growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file1: model1.filename,
          file2: model2.filename,
          threshold: 0.2 // Default threshold
        })
      });

      if (!res.ok) {
        throw new Error('Failed to calculate volume');
      }

      const data = await res.json();
      setVolumeResult(data);
      setStatus('Volume calculation complete.');
    } catch (err) {
      console.error(err);
      setError('Volume calculation failed');
    } finally {
      setCalculatingVolume(false);
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            3D Growth Analyzer
          </h1>
        </div>

        <div className="sidebar-content">
          {/* Day 1 Upload */}
          <div className="upload-section">
            <h3 className="section-title">Day 1</h3>
            <label className="upload-area">
              {image1Preview ? (
                <img src={image1Preview} alt="Day 1" className="preview-image" />
              ) : (
                <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Upload Image</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handleImage1} hidden />
            </label>
          </div>

          {/* Day 2 Upload */}
          <div className="upload-section">
            <h3 className="section-title">Day 2</h3>
            <label className="upload-area">
              {image2Preview ? (
                <img src={image2Preview} alt="Day 2" className="preview-image" />
              ) : (
                <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>Upload Image</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handleImage2} hidden />
            </label>
          </div>

          {/* Process Button */}
          <button
            className="process-button"
            onClick={handleProcess}
            disabled={processing || !image1 || !image2}
          >
            {processing ? (
              <>
                <div className="spinner" />
                Processing...
              </>
            ) : (
              'Generate 3D Models'
            )}
          </button>

          {/* Calculate Volume Button (Only when models available) */}
          {model1 && model2 && (
            <div className="volume-section" style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '20px' }}>
              <button
                className="process-button"
                style={{ background: '#2563eb' }}
                onClick={handleCalculateVolume}
                disabled={calculatingVolume}
              >
                {calculatingVolume ? 'Calculating...' : 'Calculate Volumetric Growth'}
              </button>

              {/* Volume Results */}
              {volumeResult && (
                <div className="volume-results" style={{ marginTop: '15px', background: '#1a1a1a', padding: '10px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ color: '#888' }}>Day 1 Vol:</span>
                    <span>{volumeResult.volume1.toFixed(4)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ color: '#888' }}>Day 2 Vol:</span>
                    <span>{volumeResult.volume2.toFixed(4)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #333', paddingTop: '5px', marginTop: '5px' }}>
                    <span>Growth:</span>
                    <span style={{ color: volumeResult.growth_percentage >= 0 ? '#4ade80' : '#f87171' }}>
                      {volumeResult.growth_percentage > 0 ? '+' : ''}{volumeResult.growth_percentage.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div className="status-area">
            <p className="status-text">{status}</p>
            {error && <p className="error-text">{error}</p>}
          </div>
        </div>
      </aside>

      {/* Main Viewer Area */}
      <main className="main-content">
        <div className="viewer-grid">
          <ViewerCanvas
            plyUrl={model1?.ply}
            extrinsics={model1?.extrinsics}
            intrinsics={model1?.intrinsics}
            filename={model1?.filename}
            label="Day 1"
          />
          <ViewerCanvas
            plyUrl={model2?.ply}
            extrinsics={model2?.extrinsics}
            intrinsics={model2?.intrinsics}
            filename={model2?.filename}
            label="Day 2"
          />
        </div>

        {/* Footer Status */}
        <footer className="footer">
          <span className={`status-indicator ${comfyOnline ? 'online' : 'offline'}`}>
            ComfyUI: {comfyOnline ? 'Online' : 'Offline'}
          </span>
          <span className="model-status">
            {model1 && model2 ? 'Models loaded' : ''}
          </span>
        </footer>
      </main>
    </div>
  );
}
