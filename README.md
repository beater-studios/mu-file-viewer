# MU File Viewer

Web-based file viewer for MU Online game assets. Browse and preview textures, 3D models, images, audio and fonts directly in your browser.

## Supported Formats

| Category | Formats |
|----------|---------|
| **Textures (TGA)** | .tga (uncompressed + RLE, 24/32-bit) |
| **3D Models (FBX)** | .fbx (via Three.js FBXLoader) |
| **3D Models (GLB)** | .glb (via Three.js GLTFLoader, with textures) |
| **3D Models (BMD)** | .bmd (MU Online proprietary, encrypted v12/v15) |
| **MU Textures** | .ozj, .ozj2, .ozb, .ozt, .mmk (MU Online proprietary wrappers) |
| **MU Encrypted Textures (OZD)** | .ozd (DDS textures encrypted with dual-cipher ModulusDecrypt) |
| **MU Encrypted Packages (OZP)** | .ozp (OZJ-wrapped images encrypted with ModulusDecrypt) |
| **DDS Textures** | Uncompressed (BGRA/BGR) and compressed (DXT1/DXT3/DXT5) |
| **Images** | .jpg, .jpeg, .png, .bmp, .ico, .webp, .gif, .svg |
| **Audio** | .wav, .ogg, .mp3 |
| **Fonts** | .ttf, .woff, .woff2, .otf, .eot |

## Requirements

- PHP 7.4+

## Usage

1. Clone the repository:
```bash
git clone https://github.com/davydmaker/mu-file-viewer.git
cd mu-file-viewer
```

2. Edit `config.php` and set the path to your MU Online files:
```php
$FILES_ROOT = '/path/to/your/mu-online/files';
```

3. Start the PHP built-in server:
```bash
php -S localhost:8080
```

4. Open http://localhost:8080 in your browser.

## Features

- Recursive file scanning across all subdirectories
- Lazy loading with concurrency control (optimized for PHP built-in server)
- Dark theme optimized for game asset viewing
- 3D model viewer with orbit controls (rotate, zoom, pan)
- BMD animation playback
- Audio player with play/pause controls and duration display
- Font preview with sample text
- File download buttons on all asset types
- Group toggle (collapse/expand by directory)
- Multi-select with batch download
- MU Online proprietary format decoding (OZJ/OZB/OZT/MMK/BMD)
- OZD/OZP dual-cipher decryption with 8 block cipher implementations
- DDS texture rendering (DXT1/DXT3/DXT5 + uncompressed)
- EOT font extraction (embedded TrueType from Microsoft EOT containers)

## OZD/OZP Decryption

OZD and OZP files use a dual-cipher encryption scheme called **ModulusDecrypt**. Each file selects two of eight block ciphers — one for the header and one for the payload. All eight ciphers are fully implemented:

| Cipher | Block Size | Key Size | Standard |
|--------|-----------|----------|----------|
| TEA | 8 bytes | 16 bytes | Wheeler & Needham, 1994 |
| ThreeWay | 12 bytes | 12 bytes | Daemen, 1993 |
| CAST-128 | 8 bytes | 16 bytes | RFC 2144 |
| RC5-32/16 | 8 bytes | 16 bytes | Rivest, 1994 |
| RC6-32/20 | 16 bytes | 16 bytes | Rivest et al., 1998 |
| MARS | 16 bytes | 16 bytes | IBM, AES candidate |
| IDEA | 8 bytes | 16 bytes | Lai & Massey, 1991 |
| GOST 28147-89 | 8 bytes | 32 bytes | Soviet/Russian standard |

## Utility Scripts

- `list-unknown-types.sh` — Lists file types in your assets directory that are not yet handled by the viewer. Useful for identifying new formats to support.

## Sample Assets

Don't have MU Online files? Clone one of these repos into the `samples/` directory to try the viewer:

| Repository | Content |
|-----------|---------|
| [sven-n/MuMain](https://github.com/sven-n/MuMain) | MU Online client source with BMD models, TGA/OZJ textures, WAV audio |
| [afrokick/muonlinejs](https://github.com/afrokick/muonlinejs) | Web client with GLB models, OGG audio, PNG textures, OZJ/OZT maps |
| [Balgas/muonline](https://github.com/Balgas/muonline) | Unity project with FBX models, fonts, textures |
| [ptr0x-real/xMuPP](https://github.com/ptr0x-real/xMuPP) | Server + tools with MMK thumbnails, EOT/OTF fonts |
| [MUnique/OpenMU](https://github.com/MUnique/OpenMU) | Open source server with web assets and fonts |

Clone one or more into `samples/`:

```bash
cd samples
git clone https://github.com/sven-n/MuMain.git
git clone https://github.com/afrokick/muonlinejs.git
```

Then point `$FILES_ROOT` in `config.php` to `samples/` to browse all of them, or to a specific repo folder.

## Credits

- BMD parser based on [xulek/muonline-bmd-viewer](https://github.com/xulek/muonline-bmd-viewer)
- 3D rendering powered by [Three.js](https://threejs.org/)
- OZD/OZP decryption ported from [VDraven/MuClientTools16](https://github.com/VDraven/MuClientTools16) (ModulusDecrypt algorithm)
- Block cipher implementations verified against [Crypto++](https://github.com/weidai11/cryptopp) (Wei Dai, public domain) — used as reference for CAST-128 S-boxes/key schedule, ThreeWay round functions, MARS 3-phase structure, IDEA key inversion, and RC6 decryption
- CAST-128 S-boxes from [RFC 2144](https://www.rfc-editor.org/rfc/rfc2144) (C. Adams, 1997)

## License

[MIT](LICENSE)
