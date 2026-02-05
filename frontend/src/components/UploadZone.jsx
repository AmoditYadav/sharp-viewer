import React, { useRef } from 'react';

/**
 * Upload Zone Component
 * Drag & drop or click to upload images
 */
export default function UploadZone({ label, file, onFileSelect }) {
    const inputRef = useRef(null);

    const handleClick = () => {
        inputRef.current?.click();
    };

    const handleChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            onFileSelect(selectedFile);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile && droppedFile.type.startsWith('image/')) {
            onFileSelect(droppedFile);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    return (
        <div
            className={`upload-zone ${file ? 'has-file' : ''}`}
            onClick={handleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleChange}
                style={{ display: 'none' }}
            />
            <div className="upload-zone-label">{label}</div>
            {file ? (
                <div className="upload-zone-text">{file.name}</div>
            ) : (
                <>
                    <div className="upload-zone-text">Click or drop image</div>
                    <div className="upload-zone-hint">PNG, JPG up to 10MB</div>
                </>
            )}
        </div>
    );
}
