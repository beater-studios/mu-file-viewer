<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['files']) || !is_array($input['files'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request body']);
    exit;
}

$realRoot = realpath($FILES_ROOT);
if (!$realRoot) {
    http_response_code(500);
    echo json_encode(['error' => 'Invalid FILES_ROOT']);
    exit;
}

$deleted = [];
$failed = [];

foreach ($input['files'] as $requestedFile) {
    $requestedFile = str_replace(['..', "\0"], '', $requestedFile);
    $fullPath = $FILES_ROOT . '/' . $requestedFile;
    $realPath = realpath($fullPath);

    if (
        !$realPath ||
        strpos($realPath, $realRoot) !== 0 ||
        !is_file($realPath)
    ) {
        $failed[] = $requestedFile;
        continue;
    }

    if (@unlink($realPath)) {
        $deleted[] = $requestedFile;
    } else {
        $failed[] = $requestedFile;
    }
}

echo json_encode(['deleted' => $deleted, 'failed' => $failed]);
