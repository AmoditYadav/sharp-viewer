import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FileCode, FileImage, RefreshCw, Box } from 'lucide-react';
import clsx from 'clsx';

export default function Dashboard({ onSelectFile, selectedFile }) {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [volumeData, setVolumeData] = useState(null);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/files');
            setFiles(res.data);
        } catch (err) {
            console.error("Failed to fetch files", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    useEffect(() => {
        if (selectedFile && selectedFile.type === 'model') {
            // Fetch volume data
            axios.get(`/api/calculate-volume/${selectedFile.name}`)
                .then(res => setVolumeData(res.data))
                .catch(err => console.error(err));
        } else {
            setVolumeData(null);
        }
    }, [selectedFile]);

    return (
        <div className="flex flex-col h-full bg-surface border-r border-white/10 w-80">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <h2 className="font-bold text-lg text-white">Files</h2>
                <button onClick={fetchFiles} className="p-2 hover:bg-white/10 rounded-full transition">
                    <RefreshCw size={16} className={clsx(loading && "animate-spin")} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {files.length === 0 && !loading && (
                    <div className="text-muted text-xs text-center mt-10 p-4">
                        No output files found.<br />Upload an image to start!
                    </div>
                )}

                {files.map(file => (
                    <div
                        key={file.name}
                        onClick={() => onSelectFile(file)}
                        className={clsx(
                            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition text-sm",
                            selectedFile?.name === file.name ? "bg-primary/20 text-primary border border-primary/30" : "hover:bg-white/5 text-muted hover:text-white"
                        )}
                    >
                        {file.type === 'model' ? <FileCode size={18} /> : <FileImage size={18} />}
                        <div className="flex-1 truncate">
                            <div className="font-medium truncate">{file.name}</div>
                            <div className="text-xs opacity-60">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Upload Section */}
            <div className="p-4 border-t border-white/10">
                <label className="flex items-center justify-center w-full p-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg cursor-pointer transition text-primary text-sm font-medium gap-2">
                    <span>Upload Image</span>
                    <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                            if (e.target.files?.[0]) {
                                const formData = new FormData();
                                formData.append('file', e.target.files[0]);
                                try {
                                    setLoading(true);
                                    await axios.post('/api/upload', formData, {
                                        headers: { 'Content-Type': 'multipart/form-data' }
                                    });

                                    // Trigger ComfyUI workflow
                                    await axios.post('/api/process', { filename: e.target.files[0].name });
                                    alert("File uploaded and Pipeline triggered!");

                                    fetchFiles(); // Refresh list
                                } catch (err) {
                                    alert("Upload failed");
                                    console.error(err);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }}
                    />
                </label>
            </div>

            {/* Stats Panel */}
            {volumeData && (
                <div className="p-4 border-t border-white/10 bg-black/20">
                    <h3 className="text-xs font-semibold text-muted uppercase mb-3 flex items-center gap-2">
                        <Box size={14} /> Analysis Report
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted">Extrapolated Vol:</span>
                            <span className="font-mono text-accent">{volumeData.volume_hull_units.toFixed(2)} u³</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">BBox Vol:</span>
                            <span className="font-mono">{volumeData.volume_bbox_units.toFixed(2)} u³</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted">Points:</span>
                            <span className="font-mono">{volumeData.point_count.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
