<?php
require_once __DIR__ . '/config.php';

$requestedFile = isset($_GET['file']) ? $_GET['file'] : '';
$requestedFile = str_replace(['..', "\0"], '', $requestedFile);

$allowedExtensions = ['tga', 'fbx', 'glb', 'bmd', 'jpg', 'jpeg', 'png', 'bmp', 'ico', 'webp', 'gif', 'svg', 'ozj', 'ozj2', 'ozb', 'ozt', 'mmk', 'ozp', 'ozd', 'wav', 'ogg', 'ttf', 'woff', 'woff2', 'otf', 'eot'];

$contentTypes = [
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'bmp'  => 'image/bmp',
    'ico'  => 'image/x-icon',
    'webp' => 'image/webp',
    'gif'  => 'image/gif',
    'svg'  => 'image/svg+xml',
    'wav'  => 'audio/wav',
    'tga'  => 'application/octet-stream',
    'fbx'  => 'application/octet-stream',
    'glb'  => 'model/gltf-binary',
    'ogg'  => 'audio/ogg',
    'ttf'  => 'font/ttf',
    'woff' => 'font/woff',
    'woff2'=> 'font/woff2',
    'otf'  => 'font/otf',
    'eot'  => 'application/vnd.ms-fontobject',
];

$fullPath = $FILES_ROOT . '/' . $requestedFile;
$realPath = realpath($fullPath);
$realRoot = realpath($FILES_ROOT);

$ext = strtolower(pathinfo($realPath ?: '', PATHINFO_EXTENSION));

if (
    !$realPath ||
    !$realRoot ||
    strpos($realPath, $realRoot) !== 0 ||
    !in_array($ext, $allowedExtensions) ||
    !is_file($realPath)
) {
    http_response_code(404);
    exit('File not found');
}

header('Content-Type: ' . ($contentTypes[$ext] ?? 'application/octet-stream'));
header('Content-Length: ' . filesize($realPath));
header('Cache-Control: public, max-age=86400');
readfile($realPath);
