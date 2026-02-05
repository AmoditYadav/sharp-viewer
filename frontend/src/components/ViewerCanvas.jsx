import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * 3D Gaussian Splat Viewer using the adapted PlyPreview viewer
 * Uses the exact same gsplat.js implementation from comfyui-PlyPreview
 */
export default function ViewerCanvas({ plyUrl, extrinsics, intrinsics, filename, label }) {
    const iframeRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [iframeReady, setIframeReady] = useState(false);
    const pendingLoad = useRef(null);

    // Handle messages from iframe
    useEffect(() => {
        const handleMessage = (event) => {
            const data = event.data;
            if (!data || !data.type) return;

            console.log('[ViewerCanvas] Received message:', data.type);

            if (data.type === 'READY') {
                console.log('[ViewerCanvas] Iframe is ready');
                setIframeReady(true);

                // If we have a pending load, execute it now
                if (pendingLoad.current) {
                    console.log('[ViewerCanvas] Executing pending load');
                    pendingLoad.current();
                    pendingLoad.current = null;
                }
            } else if (data.type === 'LOADED' || data.type === 'MESH_LOADED') {
                console.log('[ViewerCanvas] Model loaded successfully');
                setLoading(false);
                setError(null);
            } else if (data.type === 'ERROR' || data.type === 'MESH_ERROR') {
                console.log('[ViewerCanvas] Error:', data.error);
                setLoading(false);
                setError(data.error || 'Failed to load model');
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Function to send PLY data to iframe
    const sendPLYToIframe = useCallback(async () => {
        if (!plyUrl || !iframeRef.current) return;

        console.log('[ViewerCanvas] Sending PLY to iframe:', plyUrl);
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(plyUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();

            iframeRef.current.contentWindow.postMessage({
                type: 'LOAD_MESH_DATA',
                data: arrayBuffer,
                filename: filename || plyUrl.split('/').pop(),
                extrinsics: extrinsics,
                intrinsics: intrinsics,
                timestamp: Date.now()
            }, '*', [arrayBuffer]);

            console.log('[ViewerCanvas] Sent LOAD_MESH_DATA', {
                size: arrayBuffer.byteLength,
                hasExtrinsics: !!extrinsics,
                hasIntrinsics: !!intrinsics
            });

        } catch (err) {
            console.error('[ViewerCanvas] Error loading PLY:', err);
            setLoading(false);
            setError(err.message);
        }
    }, [plyUrl, extrinsics, intrinsics, filename]);

    // Load PLY when URL changes
    useEffect(() => {
        if (!plyUrl) return;

        if (iframeReady) {
            // Iframe is ready, send immediately
            sendPLYToIframe();
        } else {
            // Store for later when iframe is ready
            console.log('[ViewerCanvas] Storing pending load for:', plyUrl);
            pendingLoad.current = sendPLYToIframe;
        }
    }, [plyUrl, iframeReady, sendPLYToIframe]);

    if (!plyUrl) {
        return (
            <div className="viewer-pane">
                {label && <div className="viewer-label">{label}</div>}
                <div className="viewer-placeholder">
                    No model loaded
                </div>
            </div>
        );
    }

    return (
        <div className="viewer-pane">
            {label && (
                <div className="viewer-label">
                    <span className="label-text">{label}</span>
                    {loading && <span className="label-status">Loading...</span>}
                    {!loading && iframeReady && <span className="label-status loaded">Splat Loaded</span>}
                    {filename && <span className="label-filename">{filename}</span>}
                </div>
            )}
            <iframe
                ref={iframeRef}
                src="/plyviewer/viewer_gaussian.html"
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: '#1a1a1a'
                }}
                title={`3D Viewer - ${label}`}
            />
            {loading && (
                <div className="viewer-loading">
                    <div className="spinner"></div>
                    <span>Loading 3D model...</span>
                </div>
            )}
            {error && (
                <div className="viewer-error">
                    {error}
                </div>
            )}
        </div>
    );
}
