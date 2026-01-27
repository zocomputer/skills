---
name: Generate QR code with optional image
description: Generates a QR code from any URL, and optionally overlays a custom image in the center
metadata:
  author: Zo
  category: Official
  emoji: 📱
---

# Generate QR Code with Optional Image

Generate a QR code from a URL. Optionally overlay a custom logo/image on the center with a white background.

## Parameters

- `url` (string, required): The URL to encode in the QR code
- `image_path` (string, optional): Path to custom image to overlay (PNG, JPG, etc.)
- `output_path` (string, optional): Where to save the QR code. Defaults to `file Images/qr_code.png`
- `overlay_size_percent` (int, optional): Overlay size as percentage of QR code (default: 25)

## Usage Examples

**Basic QR code (no image):**

```markdown
url: https://zo.computer
```

**With custom logo:**

```markdown
url: https://zo.computer
image_path: /home/workspace/Images/logo.png
output_path: /home/workspace/Images/zo_qr_with_logo.png
overlay_size_percent: 25
```

## Implementation

First, ensure dependencies are installed:

```bash
pip install qrcode[pil] pillow -q
```

Then generate the QR code:

```python
import qrcode
from PIL import Image
from pathlib import Path

url = "https://zo.computer"
image_path = None  # Set to image path if using overlay
output_path = "/home/workspace/Images/qr_code.png"
overlay_size_percent = 25

output_path = Path(output_path)
output_path.parent.mkdir(parents=True, exist_ok=True)

# Use HIGH error correction if we're adding an overlay
error_correction = qrcode.constants.ERROR_CORRECT_H if image_path else qrcode.constants.ERROR_CORRECT_L

qr = qrcode.QRCode(
    version=1,
    error_correction=error_correction,
    box_size=10,
    border=4,
)
qr.add_data(url)
qr.make(fit=True)

qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')

# If custom image provided, overlay it
if image_path and Path(image_path).exists():
    custom_img = Image.open(image_path).convert('RGBA')
    qr_width, qr_height = qr_img.size

    # Calculate overlay size
    overlay_size = int(qr_width * (overlay_size_percent / 100))
    custom_img = custom_img.resize((overlay_size, overlay_size), Image.Resampling.LANCZOS)

    # Create white background for overlay
    white_bg = Image.new('RGB', (overlay_size, overlay_size), 'white')

    # Paste custom image on white background (handles transparency)
    if custom_img.mode == 'RGBA':
        white_bg.paste(custom_img, (0, 0), custom_img)
    else:
        white_bg.paste(custom_img, (0, 0))

    # Composite onto center of QR code
    offset = (qr_width - overlay_size) // 2
    qr_img.paste(white_bg, (offset, offset))

qr_img.save(output_path)
print(f"QR code saved to {output_path}")
```

