<?php
require_once __DIR__ . '/config.php';

$pageTitle = 'Fonts';
$activeNav = 'fonts';
$pageJS = ['js/group-toggle.js', 'js/selection.js', 'js/fonts-app.js'];

$realRoot = realpath($FILES_ROOT);
$fontFiles = [];

if ($realRoot && is_dir($realRoot)) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($realRoot, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($iterator as $file) {
        if (in_array(strtolower($file->getExtension()), ['ttf', 'woff', 'woff2', 'otf', 'eot'])) {
            $relativePath = substr($file->getPathname(), strlen($realRoot) + 1);
            $fontFiles[] = ['path' => $relativePath, 'size' => $file->getSize()];
        }
    }
    usort($fontFiles, function($a, $b) {
        return strnatcasecmp($a['path'], $b['path']);
    });
}

function formatFontSize($bytes) {
    if ($bytes < 1024) return $bytes . ' B';
    if ($bytes < 1024 * 1024) return round($bytes / 1024, 1) . ' KB';
    return round($bytes / (1024 * 1024), 1) . ' MB';
}

include __DIR__ . '/includes/header.php';
?>

<h2>Fonts</h2>
<p class="root-path">Root: <code><?php echo htmlspecialchars($FILES_ROOT); ?></code></p>

<?php if (!empty($fontFiles)): ?>
<p class="file-count"><?php echo count($fontFiles); ?> font(s) found</p>
<div class="font-list" id="font-list">
    <?php foreach ($fontFiles as $i => $file): ?>
        <?php $fontId = 'custom-font-' . $i; ?>
        <div class="font-item" data-file="<?php echo htmlspecialchars($file['path']); ?>" data-font-id="<?php echo $fontId; ?>">
            <div class="font-header">
                <div class="font-details">
                    <div class="font-name"><?php echo htmlspecialchars(basename($file['path'])); ?></div>
                    <div class="font-path"><?php echo htmlspecialchars(dirname($file['path']) === '.' ? '' : dirname($file['path'])); ?></div>
                </div>
                <div class="font-size"><?php echo formatFontSize($file['size']); ?></div>
            </div>
            <div class="font-preview">
                <div class="font-sample-lg">ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
                <div class="font-sample-lg">abcdefghijklmnopqrstuvwxyz</div>
                <div class="font-sample-lg">0123456789 !@#$%&*()+-=</div>
                <div class="font-sample-xl">The quick brown fox jumps over the lazy dog</div>
            </div>
        </div>
    <?php endforeach; ?>
</div>
<?php else: ?>
<div class="empty-state">
    <p>No font files found.</p>
</div>
<?php endif; ?>

<?php include __DIR__ . '/includes/footer.php'; ?>
