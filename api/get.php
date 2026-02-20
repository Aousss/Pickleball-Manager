<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$file = 'data.json';

if (file_exists($file)) {
    echo file_get_contents($file);
} else {
    echo "{}";
}
?>
