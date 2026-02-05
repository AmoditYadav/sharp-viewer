"""
Medical 3D Splat Viewer - Backend
FastAPI server bridging the UI with ComfyUI
"""
import os
import glob
import time
import json
import uuid
import requests
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn

# ============================================================================
# CONFIGURATION
# ============================================================================
COMFYUI_URL = "http://127.0.0.1:8188"
COMFYUI_OUTPUT = r"D:\sharp-viewer\comfy\assets"
COMFYUI_INPUT = r"C:\Users\pc\Documents\ComfyUI\input"
WORKFLOW_PATH = r"d:\sharp viewer\workflow\sharp_exif.json"
FRONTEND_DIST = Path("../frontend/dist")

# ============================================================================
# APP SETUP
# ============================================================================
app = FastAPI(title="Medical 3D Splat Viewer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================
def find_latest_ply(timeout: int = 180):
    """
    Poll the output directory for new PLY file.
    Returns path when found or None on timeout.
    """
    start_time = time.time()
    initial_files = set(glob.glob(os.path.join(COMFYUI_OUTPUT, "*.ply")))
    
    while time.time() - start_time < timeout:
        current_files = set(glob.glob(os.path.join(COMFYUI_OUTPUT, "*.ply")))
        new_files = current_files - initial_files
        
        if new_files:
            return list(new_files)[0]
        
        time.sleep(2)
    
    return None


def get_prompt_result(prompt_id: str, timeout: int = 180):
    """
    Poll ComfyUI history for prompt completion.
    Returns the outputs including extrinsics/intrinsics from PreviewGaussian node.
    """
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        try:
            r = requests.get(f"{COMFYUI_URL}/history/{prompt_id}", timeout=5)
            if r.status_code == 200:
                history = r.json()
                if prompt_id in history:
                    outputs = history[prompt_id].get("outputs", {})
                    
                    # Look for PreviewGaussian output (node 8 in our workflow)
                    if "8" in outputs:
                        preview_output = outputs["8"]
                        
                        extrinsics = preview_output.get("extrinsics", [None])[0]
                        intrinsics = preview_output.get("intrinsics", [None])[0]
                        ply_file = preview_output.get("ply_file", [None])[0]
                        
                        print(f"[API] Found PreviewGaussian output:")
                        print(f"[API]   - PLY file: {ply_file}")
                        print(f"[API]   - Has extrinsics: {extrinsics is not None}")
                        print(f"[API]   - Has intrinsics: {intrinsics is not None}")
                        
                        if intrinsics:
                            print(f"[API]   - Intrinsics sample: fx={intrinsics[0][0] if intrinsics else 'N/A'}")
                        
                        return {
                            "extrinsics": extrinsics,
                            "intrinsics": intrinsics,
                            "ply_file": ply_file,
                        }
                    else:
                        # Node 8 not in outputs yet - check if workflow completed
                        status = history[prompt_id].get("status", {})
                        if status.get("completed", False):
                            print(f"[API] Workflow completed but no node 8 output found")
                            print(f"[API] Available outputs: {list(outputs.keys())}")
                            return None
        except Exception as e:
            print(f"[API] Error checking history: {e}")
        
        time.sleep(2)
    
    return None


# ============================================================================
# API ENDPOINTS
# ============================================================================
@app.get("/api/health")
async def health_check():
    """Check if ComfyUI is running"""
    try:
        r = requests.get(f"{COMFYUI_URL}/system_stats", timeout=3)
        return {"status": "ok", "comfyui": r.status_code == 200}
    except:
        return {"status": "ok", "comfyui": False}

@app.get("/api/files")
async def list_output_files():
    """List all PLY files from ComfyUI output"""
    if not os.path.exists(COMFYUI_OUTPUT):
        return []
    
    files = []
    for fp in glob.glob(os.path.join(COMFYUI_OUTPUT, "*.ply")):
        name = os.path.basename(fp)
        stat = os.stat(fp)
        files.append({
            "name": name,
            "path": f"/files/{name}",
            "size": stat.st_size,
            "modified": stat.st_mtime,
            "type": "model"
        })
    
    files.sort(key=lambda x: x['modified'], reverse=True)
    return files

@app.get("/files/{filename}")
async def serve_file(filename: str):
    """Serve a file from ComfyUI output"""
    path = os.path.join(COMFYUI_OUTPUT, filename)
    if not os.path.exists(path):
        raise HTTPException(404, "File not found")
    return FileResponse(path)

@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image to ComfyUI input directory"""
    os.makedirs(COMFYUI_INPUT, exist_ok=True)
    
    # Save with unique prefix to avoid collisions
    filename = f"{int(time.time())}_{file.filename}"
    filepath = os.path.join(COMFYUI_INPUT, filename)
    
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)
    
    return {"filename": filename, "path": filepath}

@app.post("/api/process-single")
async def process_single_image(data: dict):
    """
    Process a single image through ComfyUI workflow.
    Returns the path to the generated PLY file with camera parameters.
    """
    filename = data.get("filename")
    if not filename:
        raise HTTPException(400, "Filename required")
    
    if not os.path.exists(WORKFLOW_PATH):
        raise HTTPException(500, f"Workflow file not found: {WORKFLOW_PATH}")
    
    # Load and modify workflow
    with open(WORKFLOW_PATH) as f:
        workflow = json.load(f)
    
    # Update image input node (node 9 in sharp_exif.json)
    if "9" in workflow:
        workflow["9"]["inputs"]["image"] = filename
    else:
        raise HTTPException(500, "Invalid workflow structure - node 9 not found")
    
    # Send to ComfyUI
    try:
        client_id = str(uuid.uuid4())
        payload = {"prompt": workflow, "client_id": client_id}
        r = requests.post(f"{COMFYUI_URL}/prompt", json=payload, timeout=10)
        
        if r.status_code != 200:
            raise HTTPException(500, f"ComfyUI error: {r.text}")
        
        prompt_id = r.json().get("prompt_id")
        print(f"[API] Queued prompt {prompt_id} for {filename}")
        
        # Poll for PLY completion
        ply_path = find_latest_ply(timeout=180)
        
        if not ply_path:
            raise HTTPException(500, "Timeout waiting for PLY output (3 minutes)")
        
        ply_name = os.path.basename(ply_path)
        print(f"[API] Generated PLY: {ply_name}")
        
        # Try to get camera parameters from ComfyUI history
        result = get_prompt_result(prompt_id, timeout=30)
        extrinsics = result.get("extrinsics") if result else None
        intrinsics = result.get("intrinsics") if result else None
        
        if extrinsics or intrinsics:
            print(f"[API] Got camera params - extrinsics: {extrinsics is not None}, intrinsics: {intrinsics is not None}")
        
        return {
            "ply": f"/files/{ply_name}",
            "filename": ply_name,
            "extrinsics": extrinsics,
            "intrinsics": intrinsics
        }
        
    except requests.exceptions.Timeout:
        raise HTTPException(504, "ComfyUI request timed out")

# ============================================================================
# VOLUME CALCULATION LOGIC
# ============================================================================
try:
    import numpy as np
    from plyfile import PlyData
    from scipy.spatial import ConvexHull
    import open3d as o3d
    HAS_VOLUME_DEPS = True
except ImportError:
    print("[WARN] Volume calculation dependencies missing. Install plyfile, scipy, open3d.")
    HAS_VOLUME_DEPS = False

def calculate_splat_volume(ply_path, opacity_threshold=0.2):
    """
    Calculate volume of Gaussian Splat using Alpha-Filtered Convex Hull algorithm.
    1. Load PLY and extract XYZ + Opacity
    2. Filter points with opacity < threshold
    3. Remove statistical outliers (noise)
    4. Calculate Convex Hull volume
    """
    if not HAS_VOLUME_DEPS:
        raise ImportError("Missing dependencies: plyfile, scipy, open3d")
        
    # 1. Load the PLY file
    try:
        plydata = PlyData.read(ply_path)
    except Exception as e:
        print(f"Error reading PLY {ply_path}: {e}")
        return 0.0
    
    # Extract properties
    xyz = np.stack((plydata['vertex']['x'], 
                    plydata['vertex']['y'], 
                    plydata['vertex']['z']), axis=-1)
    
    # Check for opacity field
    if 'opacity' in plydata['vertex']:
        opacity = plydata['vertex']['opacity']
        # Apply sigmoid if values are raw logits (common in splats)
        # However, check range first. If all > 0, might typically be pre-activated or not.
        # Standard 3DGS often stores opacity as logits.
        # But some exporters might export [0,1]. 
        # Heuristic: if any value < 0, assume logits.
        if (opacity < 0).any():
             opacity = 1 / (1 + np.exp(-opacity)) 
    elif 'alpha' in plydata['vertex']:
        opacity = plydata['vertex']['alpha']
    else:
        # Fallback
        opacity = np.ones(len(xyz))

    # 2. FILTER: Keep only "solid" points
    mask = opacity > opacity_threshold
    solid_points = xyz[mask]
    
    if len(solid_points) < 4:
        return 0.0 # Not enough points for volume

    # 3. CLEAN: Remove outliers using Open3D
    try:
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(solid_points)
        
        # Remove points further away from neighbors
        cl, ind = pcd.remove_statistical_outlier(nb_neighbors=20, std_ratio=2.0)
        clean_points = np.asarray(cl.points)
    except Exception as e:
        print(f"Open3D Error: {e}")
        clean_points = solid_points # Fallback to solid points if O3D fails

    if len(clean_points) < 4:
        return 0.0

    # 4. WRAP: Calculate Convex Hull Volume
    try:
        hull = ConvexHull(clean_points)
        volume = hull.volume
        return volume
    except Exception as e:
        print(f"Volume Calc Error: {e}")
        return 0.0

@app.post("/api/analyze-growth")
async def analyze_growth(data: dict):
    """
    Calculate volume growth between two PLY files.
    Payload: {"file1": "day1.ply", "file2": "day2.ply", "threshold": 0.2}
    """
    if not HAS_VOLUME_DEPS:
        raise HTTPException(500, "Server missing volume calculation dependencies")

    file1 = data.get("file1")
    file2 = data.get("file2")
    threshold = data.get("threshold", 0.5) # User mentioned 0.5 in text
    
    if not file1 or not file2:
        raise HTTPException(400, "Both file1 and file2 are required")
        
    path1 = os.path.join(COMFYUI_OUTPUT, file1)
    path2 = os.path.join(COMFYUI_OUTPUT, file2)
    
    if not os.path.exists(path1) or not os.path.exists(path2):
        raise HTTPException(404, "One or both files not found in output directory")
        
    vol1 = calculate_splat_volume(path1, threshold)
    vol2 = calculate_splat_volume(path2, threshold)
    
    growth = 0.0
    if vol1 > 0:
        growth = ((vol2 - vol1) / vol1) * 100
        
    return {
        "file1": file1,
        "volume1": vol1,
        "file2": file2,
        "volume2": vol2,
        "growth_percentage": growth
    }

# ============================================================================
# STATIC FILE SERVING (Frontend)
# ============================================================================
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="static")

# ============================================================================
# MAIN
# ============================================================================
if __name__ == "__main__":
    print("=" * 60)
    print("Medical 3D Splat Viewer - Backend")
    print(f"ComfyUI Output: {COMFYUI_OUTPUT}")
    print(f"ComfyUI Input: {COMFYUI_INPUT}")
    print(f"Workflow: {WORKFLOW_PATH}")
    print(f"Server: http://localhost:8000")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000)
