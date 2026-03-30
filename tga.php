<?php
require_once __DIR__ . '/config.php';

$pageTitle = 'TGA';
$activeNav = 'tga';
$pageJS = ['js/download-utils.js', 'js/priority-queue.js', 'js/group-toggle.js', 'js/selection.js', 'js/tga-parser.js', 'js/tga-app.js'];

$realRoot = realpath($FILES_ROOT);
$tgaFiles = [];

if ($realRoot && is_dir($realRoot)) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($realRoot, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($iterator as $file) {
        if (strtolower($file->getExtension()) === 'tga') {
            $relativePath = substr($file->getPathname(), strlen($realRoot) + 1);
            $tgaFiles[] = $relativePath;
        }
    }
    sort($tgaFiles, SORT_NATURAL | SORT_FLAG_CASE);
}

include __DIR__ . '/includes/header.php';
?>

<h2>TGA Textures</h2>
<p class="root-path">Root: <code><?php echo htmlspecialchars($FILES_ROOT); ?></code></p>

<?php if (!empty($tgaFiles)): ?>
<p class="file-count"><?php echo count($tgaFiles); ?> TGA file(s) found</p>
<div class="file-grid" id="file-grid">
    <?php foreach ($tgaFiles as $file): ?>
        <div class="file-card" data-file="<?php echo htmlspecialchars($file); ?>" data-name="<?php echo htmlspecialchars(basename($file)); ?>">
            <div class="file-placeholder">Loading...</div>
            <div class="file-name" title="<?php echo htmlspecialchars($file); ?>"><?php echo htmlspecialchars(basename($file)); ?></div>
            <div class="file-path"><?php echo htmlspecialchars(dirname($file) === '.' ? '' : dirname($file)); ?></div>
        </div>
    <?php endforeach; ?>
</div>
<?php else: ?>
<div class="empty-state">
    <p>No TGA files found.</p>
</div>
<?php endif; ?>

<!-- Modal -->
<div class="modal-overlay" id="modal">
    <div class="modal-content">
        <div class="modal-header">
            <span class="modal-filename" id="modal-filename"></span>
            <button class="modal-close" id="modal-close">&times;</button>
        </div>
        <div class="modal-canvas" id="modal-canvas"></div>
        <div class="modal-info" id="modal-info"></div>
    </div>
</div>

<?php include __DIR__ . '/includes/footer.php'; ?>
