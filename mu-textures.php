<?php
require_once __DIR__ . '/config.php';

$pageTitle = 'MU Textures';
$activeNav = 'mu-textures';
$pageJS = ['js/download-utils.js', 'js/group-toggle.js', 'js/selection.js', 'js/tga-parser.js', 'js/ozg-parser.js', 'js/dds-parser.js', 'js/oz-parser.js', 'js/mu-textures-app.js'];

$realRoot = realpath($FILES_ROOT);
$ozFiles = [];
$ozExtensions = ['ozj', 'ozj2', 'ozb', 'ozt', 'mmk', 'ozp', 'ozd'];

if ($realRoot && is_dir($realRoot)) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($realRoot, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($iterator as $file) {
        if (in_array(strtolower($file->getExtension()), $ozExtensions)) {
            $relativePath = substr($file->getPathname(), strlen($realRoot) + 1);
            $ozFiles[] = ['path' => $relativePath, 'size' => $file->getSize()];
        }
    }
    usort($ozFiles, function($a, $b) {
        return strnatcasecmp($a['path'], $b['path']);
    });
}

include __DIR__ . '/includes/header.php';
?>

<h2>MU Textures (OZJ / OZB / OZT / MMK / OZP / OZD)</h2>
<p class="root-path">Root: <code><?php echo htmlspecialchars($FILES_ROOT); ?></code></p>

<?php if (!empty($ozFiles)): ?>
<p class="file-count"><?php echo count($ozFiles); ?> file(s) found</p>
<div class="file-grid" id="file-grid">
    <?php foreach ($ozFiles as $file): ?>
        <div class="file-card oz-card" data-file="<?php echo htmlspecialchars($file['path']); ?>" data-name="<?php echo htmlspecialchars(basename($file['path'])); ?>" data-size="<?php echo $file['size']; ?>">
            <div class="file-placeholder">Loading...</div>
            <div class="file-name" title="<?php echo htmlspecialchars($file['path']); ?>"><?php echo htmlspecialchars(basename($file['path'])); ?></div>
            <div class="file-path"><?php echo htmlspecialchars(dirname($file['path']) === '.' ? '' : dirname($file['path'])); ?></div>
        </div>
    <?php endforeach; ?>
</div>
<?php else: ?>
<div class="empty-state">
    <p>No OZJ/OZB/OZT/MMK files found.</p>
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
