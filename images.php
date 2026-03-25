<?php
require_once __DIR__ . '/config.php';

$pageTitle = 'Images';
$activeNav = 'images';
$pageJS = ['js/images-app.js'];

$realRoot = realpath($FILES_ROOT);
$imageFiles = [];
$imageExtensions = ['jpg', 'jpeg', 'png', 'bmp', 'ico', 'webp', 'gif', 'svg'];

if ($realRoot && is_dir($realRoot)) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($realRoot, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($iterator as $file) {
        if (in_array(strtolower($file->getExtension()), $imageExtensions)) {
            $relativePath = substr($file->getPathname(), strlen($realRoot) + 1);
            $imageFiles[] = ['path' => $relativePath, 'size' => $file->getSize()];
        }
    }
    usort($imageFiles, function($a, $b) {
        return strnatcasecmp($a['path'], $b['path']);
    });
}

include __DIR__ . '/includes/header.php';
?>

<h2>Images</h2>
<p class="root-path">Root: <code><?php echo htmlspecialchars($FILES_ROOT); ?></code></p>

<?php if (!empty($imageFiles)): ?>
<p class="file-count"><?php echo count($imageFiles); ?> image(s) found</p>
<div class="file-grid" id="file-grid">
    <?php foreach ($imageFiles as $file): ?>
        <div class="file-card img-card" data-file="<?php echo htmlspecialchars($file['path']); ?>" data-name="<?php echo htmlspecialchars(basename($file['path'])); ?>" data-size="<?php echo $file['size']; ?>">
            <div class="file-placeholder">Loading...</div>
            <div class="file-name" title="<?php echo htmlspecialchars($file['path']); ?>"><?php echo htmlspecialchars(basename($file['path'])); ?></div>
            <div class="file-path"><?php echo htmlspecialchars(dirname($file['path']) === '.' ? '' : dirname($file['path'])); ?></div>
        </div>
    <?php endforeach; ?>
</div>
<?php else: ?>
<div class="empty-state">
    <p>No images found.</p>
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
