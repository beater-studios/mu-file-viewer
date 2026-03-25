<?php
$pageTitle = 'Home';
$activeNav = 'home';
include __DIR__ . '/includes/header.php';
?>

<div class="home-hero">
    <h1>MU File Viewer</h1>
    <p>Web-based viewer for MU Online game assets</p>

    <div class="home-cards">
        <a href="tga.php" class="home-card">
            <span class="home-card-icon">TGA</span>
            <span class="home-card-title">TGA Textures</span>
            <span class="home-card-desc">View .tga texture files</span>
        </a>
        <a href="fbx.php" class="home-card">
            <span class="home-card-icon">FBX</span>
            <span class="home-card-title">FBX 3D Models</span>
            <span class="home-card-desc">View .fbx 3D models</span>
        </a>
        <a href="glb.php" class="home-card">
            <span class="home-card-icon">GLB</span>
            <span class="home-card-title">GLB 3D Models</span>
            <span class="home-card-desc">View .glb / glTF models</span>
        </a>
        <a href="bmd.php" class="home-card">
            <span class="home-card-icon">BMD</span>
            <span class="home-card-title">BMD 3D Models</span>
            <span class="home-card-desc">View MU Online .bmd models</span>
        </a>
        <a href="images.php" class="home-card">
            <span class="home-card-icon">IMG</span>
            <span class="home-card-title">Images</span>
            <span class="home-card-desc">View jpg, png, bmp</span>
        </a>
        <a href="mu-textures.php" class="home-card">
            <span class="home-card-icon">OZJ</span>
            <span class="home-card-title">MU Textures</span>
            <span class="home-card-desc">View .ozj, .ozb, .ozt, .mmk</span>
        </a>
        <a href="audio.php" class="home-card">
            <span class="home-card-icon">WAV</span>
            <span class="home-card-title">Audio</span>
            <span class="home-card-desc">Play .wav, .ogg files</span>
        </a>
        <a href="fonts.php" class="home-card">
            <span class="home-card-icon">Aa</span>
            <span class="home-card-title">Fonts</span>
            <span class="home-card-desc">Preview .ttf, .woff, .woff2 fonts</span>
        </a>
    </div>
</div>

<?php include __DIR__ . '/includes/footer.php'; ?>
