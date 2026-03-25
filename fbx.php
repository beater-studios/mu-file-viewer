<?php
require_once __DIR__ . '/config.php';

$pageTitle = 'FBX';
$activeNav = 'fbx';


$realRoot = realpath($FILES_ROOT);
$fbxFiles = [];

if ($realRoot && is_dir($realRoot)) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($realRoot, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($iterator as $file) {
        if (strtolower($file->getExtension()) === 'fbx') {
            $relativePath = substr($file->getPathname(), strlen($realRoot) + 1);
            $size = $file->getSize();
            $fbxFiles[] = ['path' => $relativePath, 'size' => $size];
        }
    }
    usort($fbxFiles, function($a, $b) {
        return strnatcasecmp($a['path'], $b['path']);
    });
}

include __DIR__ . '/includes/header.php';
?>

<h2>FBX 3D Models</h2>
<p class="root-path">Root: <code><?php echo htmlspecialchars($FILES_ROOT); ?></code></p>

<?php if (!empty($fbxFiles)): ?>
<p class="file-count"><?php echo count($fbxFiles); ?> FBX file(s) found</p>
<div class="file-grid" id="file-grid">
    <?php foreach ($fbxFiles as $file): ?>
        <div class="file-card fbx-card" data-file="<?php echo htmlspecialchars($file['path']); ?>" data-name="<?php echo htmlspecialchars(basename($file['path'])); ?>" data-size="<?php echo $file['size']; ?>">
            <div class="file-placeholder fbx-icon">FBX</div>
            <div class="file-name" title="<?php echo htmlspecialchars($file['path']); ?>"><?php echo htmlspecialchars(basename($file['path'])); ?></div>
            <div class="file-path"><?php echo htmlspecialchars(dirname($file['path']) === '.' ? '' : dirname($file['path'])); ?></div>
        </div>
    <?php endforeach; ?>
</div>
<?php else: ?>
<div class="empty-state">
    <p>No FBX files found.</p>
</div>
<?php endif; ?>

<!-- FBX Viewer Modal -->
<div class="modal-overlay" id="modal">
    <div class="modal-content modal-content-fbx">
        <div class="modal-header">
            <span class="modal-filename" id="modal-filename"></span>
            <button class="modal-close" id="modal-close">&times;</button>
        </div>
        <div class="fbx-viewport" id="fbx-viewport"></div>
        <div class="modal-info" id="modal-info"></div>
    </div>
</div>

<script type="importmap">
{
    "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
    }
}
</script>
<script type="module" src="js/fbx-app.js"></script>

<?php include __DIR__ . '/includes/footer.php'; ?>
