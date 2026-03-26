<?php
require_once __DIR__ . '/config.php';

$pageTitle = 'BMD';
$activeNav = 'bmd';

$realRoot = realpath($FILES_ROOT);
$bmdFiles = [];

if ($realRoot && is_dir($realRoot)) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($realRoot, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($iterator as $file) {
        if (strtolower($file->getExtension()) === 'bmd') {
            $relativePath = substr($file->getPathname(), strlen($realRoot) + 1);
            $size = $file->getSize();
            $bmdFiles[] = ['path' => $relativePath, 'size' => $size];
        }
    }
    usort($bmdFiles, function($a, $b) {
        return strnatcasecmp($a['path'], $b['path']);
    });
}

include __DIR__ . '/includes/header.php';
?>

<h2>BMD 3D Models</h2>
<p class="root-path">Root: <code><?php echo htmlspecialchars($FILES_ROOT); ?></code></p>

<?php if (!empty($bmdFiles)): ?>
<p class="file-count"><?php echo count($bmdFiles); ?> BMD file(s) found</p>
<div class="file-grid" id="file-grid">
    <?php foreach ($bmdFiles as $file): ?>
        <div class="file-card bmd-card" data-file="<?php echo htmlspecialchars($file['path']); ?>" data-name="<?php echo htmlspecialchars(basename($file['path'])); ?>" data-size="<?php echo $file['size']; ?>">
            <div class="file-placeholder fbx-icon">BMD</div>
            <div class="file-name" title="<?php echo htmlspecialchars($file['path']); ?>"><?php echo htmlspecialchars(basename($file['path'])); ?></div>
            <div class="file-path"><?php echo htmlspecialchars(dirname($file['path']) === '.' ? '' : dirname($file['path'])); ?></div>
        </div>
    <?php endforeach; ?>
</div>
<?php else: ?>
<div class="empty-state">
    <p>No BMD files found.</p>
</div>
<?php endif; ?>

<!-- BMD Viewer Modal -->
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

<script src="js/group-toggle.js"></script>
<script src="js/selection.js"></script>
<script src="js/bmd-parser.js"></script>
<script type="importmap">
{
    "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
    }
}
</script>
<script type="module" src="js/bmd-app.js"></script>

<?php include __DIR__ . '/includes/footer.php'; ?>
