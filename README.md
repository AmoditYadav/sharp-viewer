# Sharp Viewer: 3D Gaussian Splatting for Medical Imaging

**A hobbyist proof-of-concept exploring the use of Gaussian Splatting for organic medical data visualization.**

## Overview
Sharp Viewer is a specialized 3D viewer designed to render and analyze Gaussian Splat models (.splat) converted from medical imaging data. It features a React-based frontend for visualization and a FastAPI backend for processing and volume analytics.

## Features
-   **High-Fidelity Rendering:** Uses Gaussian Splatting to represent soft tissue boundaries more naturally than traditional meshes.
-   **Volume Analysis:** Estimates the volume of biological structures using convex hull algorithms on filtered splats.
-   **Growth Tracking:** Compare two scans to calculate volume changes (e.g., tumor growth).
-   **Medical Tools:** Heatmap visualization, opacity slicing, and measurement tools.

## Prerequisites
-   **Python 3.10+**
-   **Node.js 18+**
-   **ComfyUI** (Important: this is where the project runs)

## Installation

### 1. Backend Setup
The backend handles file processing and analytics.

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

pip install -r requirements.txt
```

### 2. Frontend Setup
The frontend is a modern React application.

```bash
cd frontend
npm install
```

## Usage

### Starting the Application
You can use the provided batch script to start both services:
```bash
start_app.bat
```

Or run them manually:

**Backend:**
```bash
cd backend
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm run dev
```

Open your browser to `http://localhost:5173` (or the port shown in your terminal).

## Disclaimer
**This software is for educational and experimental purposes only.** It is NOT a certified medical device and should not be used for diagnosis, treatment planning, or any clinical procedures.
