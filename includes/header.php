<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MU File Viewer<?php echo isset($pageTitle) ? ' - ' . htmlspecialchars($pageTitle) : ''; ?></title>
    <link rel="stylesheet" href="css/style.css">
    <?php if (isset($pageCSS)): ?>
        <?php foreach ($pageCSS as $css): ?>
            <link rel="stylesheet" href="<?php echo htmlspecialchars($css); ?>">
        <?php endforeach; ?>
    <?php endif; ?>
</head>
<body>
<nav class="main-nav">
    <div class="nav-inner">
        <a href="index.php" class="nav-brand">MU File Viewer</a>
        <div class="nav-links">
            <a href="tga.php" class="nav-link<?php echo (isset($activeNav) && $activeNav === 'tga') ? ' active' : ''; ?>">TGA</a>
            <a href="fbx.php" class="nav-link<?php echo (isset($activeNav) && $activeNav === 'fbx') ? ' active' : ''; ?>">FBX</a>
            <a href="glb.php" class="nav-link<?php echo (isset($activeNav) && $activeNav === 'glb') ? ' active' : ''; ?>">GLB</a>
            <a href="bmd.php" class="nav-link<?php echo (isset($activeNav) && $activeNav === 'bmd') ? ' active' : ''; ?>">BMD</a>
            <a href="images.php" class="nav-link<?php echo (isset($activeNav) && $activeNav === 'images') ? ' active' : ''; ?>">Images</a>
            <a href="mu-textures.php" class="nav-link<?php echo (isset($activeNav) && $activeNav === 'mu-textures') ? ' active' : ''; ?>">MU Textures</a>
            <a href="audio.php" class="nav-link<?php echo (isset($activeNav) && $activeNav === 'audio') ? ' active' : ''; ?>">Audio</a>
            <a href="fonts.php" class="nav-link<?php echo (isset($activeNav) && $activeNav === 'fonts') ? ' active' : ''; ?>">Fonts</a>
        </div>
    </div>
</nav>
<div class="container">
