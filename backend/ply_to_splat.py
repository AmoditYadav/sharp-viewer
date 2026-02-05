"""
PLY to SPLAT Converter
Converts Gaussian Splat PLY files to the .splat format used by @react-three/drei
"""
import struct
import numpy as np
from pathlib import Path


def convert_ply_to_splat(ply_path: str, output_path: str = None) -> str:
    """
    Convert a Gaussian Splat PLY file to .splat format.
    
    Args:
        ply_path: Path to input .ply file
        output_path: Path for output .splat file (optional, defaults to same name with .splat extension)
    
    Returns:
        Path to the generated .splat file
    """
    ply_path = Path(ply_path)
    
    if output_path is None:
        output_path = ply_path.with_suffix('.splat')
    else:
        output_path = Path(output_path)
    
    # Read PLY header and parse vertex count
    with open(ply_path, 'rb') as f:
        header = b''
        while True:
            line = f.readline()
            header += line
            if b'end_header' in line:
                break
        
        # Parse header for vertex count
        header_str = header.decode('utf-8', errors='ignore')
        vertex_count = 0
        for line in header_str.split('\n'):
            if line.startswith('element vertex'):
                vertex_count = int(line.split()[-1])
                break
        
        if vertex_count == 0:
            raise ValueError("Could not determine vertex count from PLY header")
        
        print(f"Converting {vertex_count} splats from PLY to SPLAT format...")
        
        # Read all vertex data
        # Gaussian Splat PLY format: x, y, z, nx, ny, nz, f_dc_0-2, f_rest_0-44, opacity, scale_0-2, rot_0-3
        # Total: 62 floats per vertex
        
        try:
            # Try reading as standard gaussian splat format (62 floats)
            vertex_data = np.frombuffer(
                f.read(vertex_count * 62 * 4), 
                dtype=np.float32
            ).reshape(vertex_count, 62)
        except ValueError:
            # Fall back to simpler format detection
            f.seek(len(header))
            remaining = f.read()
            floats_per_vertex = len(remaining) // (vertex_count * 4)
            f.seek(len(header))
            vertex_data = np.frombuffer(
                f.read(vertex_count * floats_per_vertex * 4),
                dtype=np.float32
            ).reshape(vertex_count, floats_per_vertex)
        
        # Extract relevant properties
        # Position: x, y, z (indices 0, 1, 2)
        positions = vertex_data[:, 0:3]
        
        # Color (SH DC component, indices 6, 7, 8)
        if vertex_data.shape[1] > 8:
            colors_sh = vertex_data[:, 6:9]
            # Convert SH coefficients to RGB
            colors = (colors_sh * 0.28209479177387814 + 0.5).clip(0, 1)
        else:
            colors = np.ones((vertex_count, 3)) * 0.5
        
        # Opacity (sigmoid of raw value)
        if vertex_data.shape[1] > 54:
            opacity_raw = vertex_data[:, 54]
            opacity = 1.0 / (1.0 + np.exp(-opacity_raw))
        else:
            opacity = np.ones(vertex_count) * 0.8
        
        # Scale (exp of raw values)
        if vertex_data.shape[1] > 57:
            scale_raw = vertex_data[:, 55:58]
            scale = np.exp(scale_raw)
        else:
            scale = np.ones((vertex_count, 3)) * 0.01
        
        # Rotation quaternion
        if vertex_data.shape[1] > 61:
            rot = vertex_data[:, 58:62]
            # Normalize quaternion
            rot_norm = np.linalg.norm(rot, axis=1, keepdims=True)
            rot = rot / (rot_norm + 1e-8)
        else:
            rot = np.zeros((vertex_count, 4))
            rot[:, 0] = 1.0  # Identity quaternion
    
    # Write .splat file
    # Format: 32 bytes per splat
    # 12 bytes position (3 floats)
    # 4 bytes color (RGBA uint8)  
    # 12 bytes scale (3 floats)
    # 4 bytes unused/padding
    
    with open(output_path, 'wb') as f:
        for i in range(vertex_count):
            # Position (3 floats = 12 bytes)
            f.write(struct.pack('fff', *positions[i]))
            
            # Scale (3 floats = 12 bytes)
            f.write(struct.pack('fff', *scale[i]))
            
            # Color RGBA (4 bytes)
            r = int(colors[i, 0] * 255)
            g = int(colors[i, 1] * 255)
            b = int(colors[i, 2] * 255)
            a = int(opacity[i] * 255)
            f.write(struct.pack('BBBB', r, g, b, a))
            
            # Rotation quaternion (4 bytes as signed int8)
            # Normalize to -128..127 range
            qw = int(rot[i, 0] * 127)
            qx = int(rot[i, 1] * 127)
            qy = int(rot[i, 2] * 127)
            qz = int(rot[i, 3] * 127)
            f.write(struct.pack('bbbb', qw, qx, qy, qz))
    
    print(f"Converted to: {output_path}")
    return str(output_path)


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python ply_to_splat.py <input.ply> [output.splat]")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else None
    convert_ply_to_splat(input_path, output_path)
