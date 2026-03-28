<?php
require_once __DIR__ . '/config.php';

$pageTitle = 'Audio';
$activeNav = 'audio';
$pageJS = ['js/download-utils.js', 'js/group-toggle.js', 'js/selection.js', 'js/audio-app.js'];

$realRoot = realpath($FILES_ROOT);
$audioFiles = [];

if ($realRoot && is_dir($realRoot)) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($realRoot, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );

    foreach ($iterator as $file) {
        if (in_array(strtolower($file->getExtension()), ['wav', 'ogg'])) {
            $relativePath = substr($file->getPathname(), strlen($realRoot) + 1);
            $audioFiles[] = ['path' => $relativePath, 'size' => $file->getSize()];
        }
    }
    usort($audioFiles, function($a, $b) {
        return strnatcasecmp($a['path'], $b['path']);
    });
}

function formatFileSize($bytes) {
    if ($bytes < 1024) return $bytes . ' B';
    if ($bytes < 1024 * 1024) return round($bytes / 1024, 1) . ' KB';
    return round($bytes / (1024 * 1024), 1) . ' MB';
}

include __DIR__ . '/includes/header.php';
?>

<h2>Audio</h2>
<p class="root-path">Root: <code><?php echo htmlspecialchars($FILES_ROOT); ?></code></p>

<?php if (!empty($audioFiles)): ?>
<p class="file-count"><?php echo count($audioFiles); ?> audio file(s) found</p>
<div class="audio-list" id="audio-list">
    <?php foreach ($audioFiles as $file): ?>
        <div class="audio-item" data-file="<?php echo htmlspecialchars($file['path']); ?>">
            <button class="audio-play-btn" title="Play">&#9654;</button>
            <div class="audio-details">
                <div class="audio-name"><?php echo htmlspecialchars(basename($file['path'])); ?></div>
                <div class="audio-path"><?php echo htmlspecialchars(dirname($file['path']) === '.' ? '' : dirname($file['path'])); ?></div>
            </div>
            <div class="audio-size"><?php echo formatFileSize($file['size']); ?></div>
            <audio preload="none">
                <?php $audioExt = strtolower(pathinfo($file['path'], PATHINFO_EXTENSION)); ?>
                <source src="serve_file.php?file=<?php echo urlencode($file['path']); ?>" type="audio/<?php echo $audioExt === 'ogg' ? 'ogg' : 'wav'; ?>">
            </audio>
        </div>
    <?php endforeach; ?>
</div>
<?php else: ?>
<div class="empty-state">
    <p>No audio files found.</p>
</div>
<?php endif; ?>

<?php include __DIR__ . '/includes/footer.php'; ?>
